import { PreviewRenderer } from './PreviewRenderer';
import type { PreviewElement } from './PreviewRenderer';
import type {
  TextOptions,
  BarcodeOptions,
  QRCodeOptions,
  ImageOptions,
  TableOptions,
  DividerOptions,
  CutOptions,
  SectionOptions,
  ThermalPrinterOptions,
  PrintOrientation,
} from '../types';
import { DEFAULT_PROFILE } from '../utils/profiles';

// ─────────────────────────────────────────────────────────────
//  PrintPreviewBuilder
//
//  Mirror of ThermalPrinter's fluent API that produces
//  PreviewElement[] instead of ESC/POS bytes.
//
//  The PrintPreview component uses this internally, but it's
//  also exported so users can drive the preview manually
//  (e.g. rebuild on form change without reconnecting).
//
//  Usage:
//    const builder = new PrintPreviewBuilder({ profile, orientation });
//    builder.init().text('Hello').barcode('123').cut();
//    const elements = builder.getElements();
// ─────────────────────────────────────────────────────────────

export class PrintPreviewBuilder {
  private renderer:    PreviewRenderer;
  private elements:    PreviewElement[] = [];
  private orientation: PrintOrientation;

  constructor(options: ThermalPrinterOptions = {}) {
    this.orientation = options.orientation ?? 'portrait';
    this.renderer = new PreviewRenderer(
      options.profile ?? DEFAULT_PROFILE,
      this.orientation,
    );
  }

  setOrientation(o: PrintOrientation): this {
    this.orientation = o;
    this.renderer = new PreviewRenderer(
      this.renderer['profile'],
      o,
    );
    return this;
  }

  // ── Content methods (mirror of ThermalPrinter) ─────────────

  init(): this { return this; } // no-op in preview

  text(content: string, options?: TextOptions): this {
    this.elements.push(this.renderer.renderText(content, options));
    return this;
  }

  newline(): this {
    return this.text('');
  }

  feed(lines = 1): this {
    this.elements.push(this.renderer.renderFeed(lines));
    return this;
  }

  feedDots(dots: number): this {
    // Convert dots to approximate lines (8 dots per mm, ~4mm per line)
    const lines = Math.round(dots / 32);
    return this.feed(Math.max(1, lines));
  }

  divider(options?: DividerOptions): this {
    this.elements.push(this.renderer.renderDivider(options));
    return this;
  }

  section(title: string, options?: Omit<SectionOptions, 'title'>): this {
    this.elements.push(this.renderer.renderSection({ title, ...options }));
    return this;
  }

  row(cells: TableOptions['cells'], divider = false): this {
    this.elements.push(this.renderer.renderTable({ cells, divider }));
    if (divider) this.divider();
    return this;
  }

  barcode(data: string, options?: BarcodeOptions): this {
    this.elements.push(this.renderer.renderBarcode(data, options));
    return this;
  }

  qrCode(data: string, options?: QRCodeOptions): this {
    this.elements.push(this.renderer.renderQRCode(data, options));
    return this;
  }

  image(options: ImageOptions): this {
    this.elements.push(this.renderer.renderImage(options));
    return this;
  }

  raw(_bytes: number[]): this {
    return this; // raw bytes not renderable in preview
  }

  cut(mode: CutOptions['mode'] = 'full', options?: Omit<CutOptions, 'mode'>): this {
    if ((options?.feed ?? 3) > 0) {
      this.elements.push(this.renderer.renderFeed(options?.feed ?? 3));
    }
    this.elements.push(this.renderer.renderCut({ mode, ...options }));
    return this;
  }

  cashDrawer(): this {
    return this; // no visual representation
  }

  // ── Output ─────────────────────────────────────────────────

  getElements(): PreviewElement[] {
    return [...this.elements];
  }

  reset(): this {
    this.elements = [];
    return this;
  }

  /** Total number of overflow warnings */
  get overflowCount(): number {
    return this.elements.filter(e => e.overflow).length;
  }

  /** Whether any element overflows the paper */
  get hasOverflow(): boolean {
    return this.overflowCount > 0;
  }

  /** Estimated paper length in mm (rough) */
  get estimatedLengthMm(): number {
    let mm = 0;
    const mmPerLine = 3.6; // ~3.6mm per line at normal size

    for (const el of this.elements) {
      switch (el.type) {
        case 'text':
          mm += mmPerLine * (el.options?.size ?? 1);
          break;
        case 'feed':
          mm += mmPerLine * el.lines;
          break;
        case 'barcode':
          mm += (el.options?.height ?? 50) / 8 + mmPerLine; // dots to mm + HRI line
          break;
        case 'qrcode':
          mm += el.estimatedDots / 8;
          break;
        case 'image':
          mm += (el.options?.height ?? 100) / 8;
          break;
        case 'divider':
          mm += mmPerLine;
          break;
        case 'section':
          mm += mmPerLine * 3; // divider + title + divider
          break;
        case 'table':
          mm += mmPerLine;
          break;
        case 'cut':
          mm += mmPerLine * (el.options?.feed ?? 3);
          break;
      }
    }

    return mm;
  }

  get renderer_(): PreviewRenderer {
    return this.renderer;
  }
}
