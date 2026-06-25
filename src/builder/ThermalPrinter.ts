import type {
  ConnectionConfig,
  ThermalPrinterOptions,
  TextOptions,
  BarcodeOptions,
  QRCodeOptions,
  ImageOptions,
  TableOptions,
  DividerOptions,
  CutOptions,
  CashDrawerOptions,
  SectionOptions,
  PrintResult,
  PrintOrientation,
  LandscapeElement,
} from '../types';

import { ESCPOSEncoder } from '../encoder/encoder';
import { DEFAULT_PROFILE } from '../utils/profiles';
import { NativePrinter } from '../connection/native';

// ─────────────────────────────────────────────────────────────
//  ThermalPrinter
//
//  Fluent builder API. All content methods return `this`,
//  allowing chaining. Async operations (image) are queued
//  and resolved during .build() / .print().
//
//  Usage:
//    const printer = await ThermalPrinter.connect({ type: 'usb' });
//    await printer
//      .init()
//      .text('Hello', { bold: true, align: 'center' })
//      .barcode('123456789012', { type: 'EAN13' })
//      .cut()
//      .print();
// ─────────────────────────────────────────────────────────────

type SyncStep  = () => number[];
type AsyncStep = () => Promise<number[]>;
type Step = SyncStep | AsyncStep;

type LandscapeStep = () => LandscapeElement | Promise<LandscapeElement>;

export class ThermalPrinter {
  private encoder:         ESCPOSEncoder;
  private options:         ThermalPrinterOptions;
  private steps:           Step[];
  private landscapeSteps:  LandscapeStep[];
  private orientation:     PrintOrientation;

  protected constructor(options: ThermalPrinterOptions = {}) {
    this.options        = options;
    this.orientation    = options.orientation ?? 'portrait';

    this.encoder = new ESCPOSEncoder(
      options.profile ?? DEFAULT_PROFILE,
      options.charset ?? 'CP860',
    );

    this.steps          = [];
    this.landscapeSteps = [];
  }

  // ── Factory ─────────────────────────────────────────────────

  /**
   * Create a printer builder without connecting.
   * Useful for building byte arrays to send through
   * your own transport layer.
   */
  static create(options: ThermalPrinterOptions = {}): ThermalPrinter {
    return new ThermalPrinter(options);
  }

  /**
   * Create a connected printer instance.
   * Requests USB permission on Android if needed.
   */
  static async connect(
    config:  ConnectionConfig,
    options: ThermalPrinterOptions = {},
  ): Promise<ConnectedThermalPrinter> {
    const printer = new ConnectedThermalPrinter(config, options);
    await printer._connect();
    return printer;
  }

  // ── Orientation ─────────────────────────────────────────────

  /**
   * Change print orientation.
   *
   * - portrait  (default): normal top-to-bottom printing
   * - landscape: content rotated 90° — achieved by rasterizing
   *   the full output as a rotated bitmap on models that don't
   *   support ESC V (e.g. Epson TM-T20X II).
   */
  setOrientation(orientation: PrintOrientation): this {
    this.orientation = orientation;
    return this;
  }

  // ── Initialization ───────────────────────────────────────────

  /**
   * Send ESC @ (initialize printer) + codepage setup.
   * Always call this at the start of a new job.
   */
  init(): this {
    this.steps.push(() => this.encoder.init());
    this.landscapeSteps.push(() => ({ type: 'init' as const }));
    return this;
  }

  // ── Text ────────────────────────────────────────────────────

  text(content: string, options?: TextOptions): this {
    this.steps.push(() => this.encoder.text(content, options));
    this.landscapeSteps.push(() => ({
      type:      'text'           as const,
      content:   content         ?? '',
      bold:      options?.bold   ?? false,
      size:      options?.size   ?? 1,
      align:     options?.align  ?? 'left',
      underline: !!options?.underline,
      invert:    options?.invert ?? false,
    }));
    return this;
  }

  /** Convenience: print a blank line */
  newline(): this {
    return this.text('');
  }

  // ── Feed ────────────────────────────────────────────────────

  feed(lines = 1): this {
    this.steps.push(() => this.encoder.feed(lines));
    this.landscapeSteps.push(() => ({ type: 'feed' as const, lines }));
    return this;
  }

  feedDots(dots: number): this {
    this.steps.push(() => this.encoder.feedDots(dots));
    this.landscapeSteps.push(() => ({ type: 'feedDots' as const, dots }));
    return this;
  }

  // ── Divider ─────────────────────────────────────────────────

  divider(options?: DividerOptions): this {
    this.steps.push(() => this.encoder.divider(options));
    this.landscapeSteps.push(() => ({
      type:  'divider' as const,
      style: options?.style ?? 'line',
      char:  options?.char,
    }));
    return this;
  }

  // ── Section header ───────────────────────────────────────────

  section(title: string, options?: Omit<SectionOptions, 'title'>): this {
    this.steps.push(() => this.encoder.section({ title, ...options }));
    const divChar    = options?.dividerChar ?? '-';
    const finalTitle = options?.uppercase ? title.toUpperCase() : title;
    this.landscapeSteps.push(
      () => ({ type: 'divider' as const, style: 'line', char: divChar }),
      () => ({ type: 'text' as const, content: finalTitle, bold: options?.bold ?? true, size: 1, align: 'center', underline: false, invert: false }),
      () => ({ type: 'divider' as const, style: 'line', char: divChar }),
    );
    return this;
  }

  // ── Table row ───────────────────────────────────────────────

  /**
   * Print a row of columns.
   * Column widths are percentages that must sum to 100.
   *
   * Example:
   *   .row([
   *     { text: 'Descrição',    width: 60, align: 'left'  },
   *     { text: 'R$ 1.250,00', width: 40, align: 'right' },
   *   ])
   */
  row(cells: TableOptions['cells'], dividerLine = false): this {
    this.steps.push(() => this.encoder.table({ cells, divider: dividerLine }));
    this.landscapeSteps.push(() => ({
      type:  'row' as const,
      cells: cells.map(c => ({
        text:  c.text  ?? '',
        width: c.width ?? 33,
        align: c.align ?? 'left',
        bold:  c.bold  ?? false,
      })),
    }));
    return this;
  }

  // ── Barcode ─────────────────────────────────────────────────

  /**
   * Print a barcode.
   * For Brazilian boletos, use type: 'ITF' with the 44-digit
   * or 47-digit barcode line.
   *
   * Example:
   *   .barcode('34191090080000008214800082194207197960000125000', {
   *     type: 'ITF',
   *     height: 50,
   *     hriPosition: 'below',
   *   })
   */
  barcode(data: string, options?: BarcodeOptions): this {
    this.steps.push(() => this.encoder.barcode(data, options));
    this.landscapeSteps.push(() => ({
      type:        'barcode'               as const,
      data,
      barcodeType: options?.type          ?? 'CODE128',
      height:      options?.height        ?? 60,
      align:       options?.align         ?? 'center',
      hriPosition: options?.hriPosition   ?? 'below',
    }));
    return this;
  }

  // ── QR Code ─────────────────────────────────────────────────

  qrCode(data: string, options?: QRCodeOptions): this {
    this.steps.push(() => this.encoder.qrCode(data, options));
    this.landscapeSteps.push(() => ({
      type:       'qrcode'              as const,
      data,
      size:       options?.size        ?? 5,
      errorLevel: options?.errorLevel  ?? 'M',
      align:      options?.align       ?? 'center',
    }));
    return this;
  }

  // ── Image ─────────────────────────────────────────────────

  /**
   * Print an image. This step is async (load + rasterize).
   * Supports:
   *   - require('./logo.png')  — local asset
   *   - 'file:///...'         — local file URI
   *   - 'data:image/png;...'  — base64 data URI
   *   - 'https://...'         — remote URL (fetched at build time)
   *
   * In landscape mode, the image is included in the full-page
   * raster so it rotates with the rest of the content.
   */
  image(options: ImageOptions): this {
    this.steps.push(async () => this.encoder.image(options));
    this.landscapeSteps.push(async () => {
      const { widthBytes, heightDots, bytes } = await this.encoder.rasterizeRaw(options);
      return {
        type:      'image' as const,
        bytes,
        widthBytes,
        heightDots,
        align: options.align ?? 'center',
      };
    });
    return this;
  }

  // ── Raw bytes ────────────────────────────────────────────────

  /** Inject arbitrary ESC/POS bytes. Use for commands not yet wrapped. */
  raw(bytes: number[]): this {
    this.steps.push(() => bytes);
    this.landscapeSteps.push(() => ({ type: 'raw' as const }));
    return this;
  }

  // ── Cut ─────────────────────────────────────────────────────

  cut(mode: CutOptions['mode'] = 'full', options?: Omit<CutOptions, 'mode'>): this {
    this.steps.push(() => this.encoder.cut({ mode, ...options }));
    this.landscapeSteps.push(() => ({
      type: 'cut' as const,
      mode: mode ?? 'full',
      feed: options?.feed ?? 3,
    }));
    return this;
  }

  // ── Cash drawer ─────────────────────────────────────────────

  cashDrawer(options?: CashDrawerOptions): this {
    this.steps.push(() => this.encoder.cashDrawer(options));
    // no landscape element — open drawer immediately via the portrait byte path
    return this;
  }

  // ── Build ────────────────────────────────────────────────────

  /**
   * Resolve all steps and return the final byte array.
   * In landscape mode, renders via LandscapeRenderer (Android native Canvas).
   */
  async build(): Promise<Uint8Array> {
    if (this.orientation === 'landscape') {
      return this._buildLandscape();
    }

    const chunks: number[][] = [];

    for (const step of this.steps) {
      const result = step();
      if (result instanceof Promise) {
        chunks.push(await result);
      } else {
        chunks.push(result);
      }
    }

    // Auto-feed + cut if configured
    if (this.options.autoCut) {
      chunks.push(this.encoder.cut({
        mode: this.options.autoCutMode ?? 'full',
        feed: 3,
      }));
    } else if (this.options.feedAfterPrint) {
      chunks.push(this.encoder.feed(this.options.feedAfterPrint));
    }

    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const output   = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }

    return output;
  }

  /**
   * Full-page landscape rasterization (Option A).
   *
   * All content elements are sent to Android's LandscapeRenderer which:
   *  1. Draws each element onto an off-screen Canvas (portrait orientation)
   *  2. Rotates the full canvas 90° CW
   *  3. Returns GS v 0 raster bytes
   *
   * JS wraps with ESC @ init and appends cut if needed.
   */
  private async _buildLandscape(): Promise<Uint8Array> {
    const profile = this.options.profile ?? DEFAULT_PROFILE;

    // Resolve all landscape steps
    const elements: LandscapeElement[] = [];
    let needsCut = false;

    for (const step of this.landscapeSteps) {
      const el = await step();
      if (el.type === 'cut') {
        needsCut = true;
      } else if (el.type !== 'raw' && el.type !== 'init') {
        elements.push(el);
      }
    }

    if (this.options.autoCut) needsCut = true;

    // Native render → GS v 0 bytes
    const rasterBytes = await NativePrinter.renderLandscapeElements(
      elements,
      profile.dotsPerLine,
    );

    // Build full print sequence: init + raster + trailing
    const init = [0x1b, 0x40]; // ESC @ — initialize printer
    const tail = needsCut
      ? this.encoder.cut({ mode: this.options.autoCutMode ?? 'full', feed: 3 })
      : this.options.feedAfterPrint
        ? this.encoder.feed(this.options.feedAfterPrint)
        : [];

    return new Uint8Array([...init, ...rasterBytes, ...tail]);
  }

  /** Reset all queued steps (keep encoder settings) */
  reset(): this {
    this.steps          = [];
    this.landscapeSteps = [];
    return this;
  }
}

// ─────────────────────────────────────────────────────────────
//  ConnectedThermalPrinter
//  Extends ThermalPrinter with actual device I/O
// ─────────────────────────────────────────────────────────────

export class ConnectedThermalPrinter extends ThermalPrinter {
  private config:  ConnectionConfig;
  private native:  NativePrinter;

  constructor(config: ConnectionConfig, options: ThermalPrinterOptions = {}) {
    super(options);
    this.config = config;
    this.native = new NativePrinter();
  }

  /**
   * Wrap an already-open NativePrinter (e.g. from printerManager).
   * The caller owns the connection lifecycle — disconnect() here
   * will also close the manager's connection.
   */
  static fromNative(
    native:  NativePrinter,
    options: ThermalPrinterOptions = {},
  ): ConnectedThermalPrinter {
    const instance = new ConnectedThermalPrinter({} as ConnectionConfig, options);
    (instance as any).native = native;
    return instance;
  }

  async _connect(): Promise<void> {
    await this.native.connect(this.config);
  }

  /**
   * Build the byte buffer and send it to the printer.
   */
  async print(): Promise<PrintResult> {
    const bytes = await this.build();
    const start = Date.now();
    const result = await this.native.write(Array.from(bytes));
    this.reset();
    return {
      ...result,
      durationMs: Date.now() - start,
    };
  }

  async disconnect(): Promise<void> {
    await this.native.disconnect();
  }

  async isConnected(): Promise<boolean> {
    return this.native.isConnected();
  }

  async getStatus() {
    return this.native.getStatus();
  }

  async openCashDrawer(options?: CashDrawerOptions): Promise<boolean> {
    return this.native.openCashDrawer(options ?? {});
  }
}
