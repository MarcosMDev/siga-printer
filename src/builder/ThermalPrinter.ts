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

export class ThermalPrinter {
  private encoder:     ESCPOSEncoder;
  private options:     ThermalPrinterOptions;
  private steps:       Step[];
  private orientation: PrintOrientation;

  protected constructor(options: ThermalPrinterOptions = {}) {
    this.options     = options;
    this.orientation = options.orientation ?? 'portrait';

    this.encoder = new ESCPOSEncoder(
      options.profile ?? DEFAULT_PROFILE,
      options.charset ?? 'CP860',
    );

    this.steps = [];
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
    return this;
  }

  // ── Text ────────────────────────────────────────────────────

  text(content: string, options?: TextOptions): this {
    this.steps.push(() => this.encoder.text(content, options));
    return this;
  }

  /** Convenience: print a blank line */
  newline(): this {
    return this.text('');
  }

  // ── Feed ────────────────────────────────────────────────────

  feed(lines = 1): this {
    this.steps.push(() => this.encoder.feed(lines));
    return this;
  }

  feedDots(dots: number): this {
    this.steps.push(() => this.encoder.feedDots(dots));
    return this;
  }

  // ── Divider ─────────────────────────────────────────────────

  divider(options?: DividerOptions): this {
    this.steps.push(() => this.encoder.divider(options));
    return this;
  }

  // ── Section header ───────────────────────────────────────────

  section(title: string, options?: Omit<SectionOptions, 'title'>): this {
    this.steps.push(() => this.encoder.section({ title, ...options }));
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
  row(cells: TableOptions['cells'], divider = false): this {
    this.steps.push(() => this.encoder.table({ cells, divider }));
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
    return this;
  }

  // ── QR Code ─────────────────────────────────────────────────

  qrCode(data: string, options?: QRCodeOptions): this {
    this.steps.push(() => this.encoder.qrCode(data, options));
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
   * For landscape prints, if orientation is 'landscape', the image
   * is automatically rotated 90° via ImageRasterizer.renderLandscape().
   */
  image(options: ImageOptions): this {
    this.steps.push(async () => {
      if (this.orientation === 'landscape') {
        return this.encoder.imageLandscape(options);
      }
      return this.encoder.image(options);
    });
    return this;
  }

  // ── Raw bytes ────────────────────────────────────────────────

  /** Inject arbitrary ESC/POS bytes. Use for commands not yet wrapped. */
  raw(bytes: number[]): this {
    this.steps.push(() => bytes);
    return this;
  }

  // ── Cut ─────────────────────────────────────────────────────

  cut(mode: CutOptions['mode'] = 'full', options?: Omit<CutOptions, 'mode'>): this {
    this.steps.push(() => this.encoder.cut({ mode, ...options }));
    return this;
  }

  // ── Cash drawer ─────────────────────────────────────────────

  cashDrawer(options?: CashDrawerOptions): this {
    this.steps.push(() => this.encoder.cashDrawer(options));
    return this;
  }

  // ── Build ────────────────────────────────────────────────────

  /**
   * Resolve all steps (including async image loading/rasterizing)
   * and return the final byte array.
   */
  async build(): Promise<Uint8Array> {
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

  /** Reset all queued steps (keep encoder settings) */
  reset(): this {
    this.steps = [];
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
