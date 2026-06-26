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
  PrinterProfile,
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
//  Landscape mode:
//    - Profile has supportsPageMode=true (Epson TM series)
//      → ESC L / ESC T 1 / FF — native printer rotation,
//        full 203 DPI quality, minimal data transfer.
//    - Profile has supportsPageMode=false (generic printers)
//      → Android Canvas bitmap rotation via LandscapeRenderer
//        (fallback — larger data, still correct output).
// ─────────────────────────────────────────────────────────────

type SyncStep  = () => number[];
type AsyncStep = () => Promise<number[]>;
type Step = SyncStep | AsyncStep;

type LandscapeStep = () => LandscapeElement | Promise<LandscapeElement>;

// Approximate dot-height per element for page mode area sizing (203 DPI)
const LINE_DOTS = 28; // text line height + gap

export class ThermalPrinter {
  private encoder:               ESCPOSEncoder;
  private options:               ThermalPrinterOptions;
  private steps:                 Step[];
  private landscapeSteps:        LandscapeStep[];
  private orientation:           PrintOrientation;
  private landscapeEstimatedDots: number; // running estimate for ESC W height

  protected constructor(options: ThermalPrinterOptions = {}) {
    this.options                 = options;
    this.orientation             = options.orientation ?? 'portrait';
    this.landscapeEstimatedDots  = 0;

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
   * - landscape: all content rotated 90°. On Epson TM printers,
   *   uses ESC/POS Page Mode (fast, native 203 DPI quality).
   *   On other printers, falls back to bitmap rasterization.
   */
  setOrientation(orientation: PrintOrientation): this {
    this.orientation = orientation;
    return this;
  }

  // ── Initialization ───────────────────────────────────────────

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

    // Height estimate for page mode area sizing
    const profile   = this.options.profile ?? DEFAULT_PROFILE;
    const chars     = content?.length ?? 1;
    const lines     = Math.max(1, Math.ceil(chars / profile.charsPerLine));
    this.landscapeEstimatedDots += lines * LINE_DOTS * (options?.size ?? 1);

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
    this.landscapeEstimatedDots += lines * LINE_DOTS;
    return this;
  }

  feedDots(dots: number): this {
    this.steps.push(() => this.encoder.feedDots(dots));
    this.landscapeSteps.push(() => ({ type: 'feedDots' as const, dots }));
    this.landscapeEstimatedDots += dots;
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
    this.landscapeEstimatedDots += LINE_DOTS + 8;
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
    this.landscapeEstimatedDots += (LINE_DOTS + 8) * 2 + LINE_DOTS;
    return this;
  }

  // ── Table row ───────────────────────────────────────────────

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
    this.landscapeEstimatedDots += LINE_DOTS * (dividerLine ? 2 : 1);
    return this;
  }

  // ── Barcode ─────────────────────────────────────────────────

  barcode(data: string, options?: BarcodeOptions): this {
    this.steps.push(() => this.encoder.barcode(data, options));
    this.landscapeSteps.push(() => ({
      type:        'barcode'             as const,
      data,
      barcodeType: options?.type        ?? 'CODE128',
      height:      options?.height      ?? 60,
      align:       options?.align       ?? 'center',
      hriPosition: options?.hriPosition ?? 'below',
    }));
    // barcode bar height + HRI text + margins
    const hri = (options?.hriPosition ?? 'below') !== 'none' ? LINE_DOTS : 0;
    this.landscapeEstimatedDots += (options?.height ?? 60) + hri + 20;
    return this;
  }

  // ── QR Code ─────────────────────────────────────────────────

  qrCode(data: string, options?: QRCodeOptions): this {
    this.steps.push(() => this.encoder.qrCode(data, options));
    this.landscapeSteps.push(() => ({
      type:       'qrcode'             as const,
      data,
      size:       options?.size       ?? 5,
      errorLevel: options?.errorLevel ?? 'M',
      align:      options?.align      ?? 'center',
    }));
    // QR module size * ~20px per module + margins
    this.landscapeEstimatedDots += (options?.size ?? 5) * 20 + 20;
    return this;
  }

  // ── Image ───────────────────────────────────────────────────

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
    // Use target height if specified; otherwise rough estimate
    this.landscapeEstimatedDots += (options.height ?? 200) + 16;
    return this;
  }

  // ── Raw bytes ────────────────────────────────────────────────

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
    return this;
  }

  // ── Build ────────────────────────────────────────────────────

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

  // ── Landscape dispatch ───────────────────────────────────────

  private async _buildLandscape(): Promise<Uint8Array> {
    const profile = this.options.profile ?? DEFAULT_PROFILE;

    if (profile.supportsPageMode) {
      // Fast path: ESC/POS Page Mode — native firmware rotation
      // Full 203 DPI quality, ~500 bytes vs ~50–400 KB raster
      return this._buildLandscapePageMode(profile);
    }

    // Fallback: Android Canvas bitmap rotation (generic printers)
    return this._buildLandscapeRaster();
  }

  /**
   * ESC/POS Page Mode landscape (Epson TM series).
   *
   * Commands:
   *   ESC @  — init
   *   ESC L  — enter page mode
   *   ESC W  — set print area (full paper width × estimated content length)
   *   ESC T 1 — direction: bottom-to-top (landscape)
   *   ... all normal ESC/POS content commands ...
   *   FF     — print page and return to standard mode
   *   (cut)  — GS V if requested
   *
   * The printer firmware rotates all content (text, barcodes, QR)
   * at its native DPI with its native fonts — no rasterization needed.
   */
  private async _buildLandscapePageMode(profile: PrinterProfile): Promise<Uint8Array> {
    const paperDots  = profile.dotsPerLine;
    const maxPageLen = profile.maxPageLength ?? 1662;

    // Add 30% safety margin; cap at printer maximum
    const pageLength = Math.min(
      Math.ceil(this.landscapeEstimatedDots * 1.3) + 80,
      maxPageLen,
    );

    // Build all content as standard portrait ESC/POS (reuses existing encoder)
    const contentChunks: number[][] = [];
    let needsCut = false;

    for (const step of this.steps) {
      const bytes = step();
      contentChunks.push(bytes instanceof Promise ? await bytes : bytes);
    }
    if (this.options.autoCut) needsCut = true;

    // Scan landscapeSteps only to detect cut flag
    for (const step of this.landscapeSteps) {
      const el = await step();
      if (el.type === 'cut') { needsCut = true; break; }
    }

    // Page mode header
    //   ESC L           — 2 bytes: enter page mode
    //   ESC W x y dx dy — 10 bytes: set print area
    //   ESC T 1         — 3 bytes: bottom-to-top direction
    const header: number[] = [
      0x1b, 0x40,  // ESC @ — init
      0x1b, 0x4c,  // ESC L — enter page mode
      // ESC W xL xH yL yH dxL dxH dyL dyH
      0x1b, 0x57,
      0x00, 0x00,  // x origin = 0
      0x00, 0x00,  // y origin = 0
      paperDots  & 0xff, (paperDots  >> 8) & 0xff,  // dx = paper width
      pageLength & 0xff, (pageLength >> 8) & 0xff,  // dy = content length
      0x1b, 0x54, 0x01,  // ESC T 1 — bottom-to-top (landscape)
    ];

    // FF — print buffered page data and return to standard mode
    const footer = [0x0c];

    const tail = needsCut
      ? this.encoder.cut({ mode: this.options.autoCutMode ?? 'full', feed: 3 })
      : this.options.feedAfterPrint
        ? this.encoder.feed(this.options.feedAfterPrint)
        : [];

    const contentLen = contentChunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(
      header.length + contentLen + footer.length + tail.length,
    );
    let off = 0;
    out.set(header, off); off += header.length;
    for (const c of contentChunks) { out.set(c, off); off += c.length; }
    out.set(footer, off); off += footer.length;
    out.set(tail,   off);
    return out;
  }

  /**
   * Bitmap rasterization fallback for printers without Page Mode.
   * Calls native Android LandscapeRenderer (Canvas → rotate 90° → GS v 0).
   */
  private async _buildLandscapeRaster(): Promise<Uint8Array> {
    const profile  = this.options.profile ?? DEFAULT_PROFILE;
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

    const rasterBytes = await NativePrinter.renderLandscapeElements(
      elements,
      profile.dotsPerLine,
    );

    const init = [0x1b, 0x40];
    const tail = needsCut
      ? this.encoder.cut({ mode: this.options.autoCutMode ?? 'full', feed: 3 })
      : this.options.feedAfterPrint
        ? this.encoder.feed(this.options.feedAfterPrint)
        : [];

    return new Uint8Array([...init, ...rasterBytes, ...tail]);
  }

  /** Reset all queued steps (keep encoder settings) */
  reset(): this {
    this.steps                   = [];
    this.landscapeSteps          = [];
    this.landscapeEstimatedDots  = 0;
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
