import type {
  TextOptions,
  BarcodeOptions,
  QRCodeOptions,
  ImageOptions,
  TableOptions,
  DividerOptions,
  CutOptions,
  SectionOptions,
  PrinterProfile,
  PrintOrientation,
} from '../types';
import { DEFAULT_PROFILE } from '../utils/profiles';

// ─────────────────────────────────────────────────────────────
//  Preview Renderer
//
//  Converts the same builder steps used for printing into
//  a list of renderable "preview elements" that the
//  PrintPreview component turns into React Native views.
//
//  Each element carries:
//    - Its visual representation data
//    - A `widthPx` if relevant (for overflow detection)
//    - An `overflow` flag if it would exceed paper width
// ─────────────────────────────────────────────────────────────

export type PreviewElementType =
  | 'text'
  | 'barcode'
  | 'qrcode'
  | 'image'
  | 'divider'
  | 'feed'
  | 'cut'
  | 'section';

export interface PreviewText {
  type: 'text';
  content: string;
  options: TextOptions;
  /** Estimated character width at this size */
  charWidth: number;
  overflow: boolean;
}

export interface PreviewBarcode {
  type: 'barcode';
  data: string;
  options: BarcodeOptions;
  overflow: boolean;
  /** Whether the data length is valid for this barcode type */
  validData: boolean;
  validationMessage?: string;
}

export interface PreviewQRCode {
  type: 'qrcode';
  data: string;
  options: QRCodeOptions;
  /** Estimated pixel size on paper */
  estimatedDots: number;
  overflow: boolean;
}

export interface PreviewImage {
  type: 'image';
  source: string | number;
  options: ImageOptions;
  overflow: boolean;
  /** Width in dots as it will be printed */
  printWidthDots: number;
}

export interface PreviewDivider {
  type: 'divider';
  options: DividerOptions;
  overflow: false;
}

export interface PreviewFeed {
  type: 'feed';
  lines: number;
  overflow: false;
}

export interface PreviewCut {
  type: 'cut';
  options: CutOptions;
  overflow: false;
}

export interface PreviewSection {
  type: 'section';
  options: SectionOptions;
  overflow: false;
}

export interface PreviewTableRow {
  type: 'table';
  options: TableOptions;
  /** Per-cell rendered text after truncation */
  renderedCells: string[];
  /** Which cells were truncated */
  truncatedCells: boolean[];
  overflow: false;
}

export type PreviewElement =
  | PreviewText
  | PreviewBarcode
  | PreviewQRCode
  | PreviewImage
  | PreviewDivider
  | PreviewFeed
  | PreviewCut
  | PreviewSection
  | PreviewTableRow;

// ─────────────────────────────────────────────────────────────
//  Validation helpers
// ─────────────────────────────────────────────────────────────

const BARCODE_LENGTHS: Record<string, { min: number; max: number; fixed?: number }> = {
  EAN13:   { min: 13, max: 13, fixed: 13 },
  EAN8:    { min: 8,  max: 8,  fixed: 8  },
  UPC_A:   { min: 12, max: 12, fixed: 12 },
  UPC_E:   { min: 6,  max: 6,  fixed: 6  },
  CODE39:  { min: 1,  max: 48 },
  CODE128: { min: 1,  max: 80 },
  ITF:     { min: 2,  max: 64 },
  ITF25:   { min: 2,  max: 64 },
  CODABAR: { min: 1,  max: 48 },
};

function validateBarcode(data: string, type: string): { valid: boolean; message?: string } {
  const rule = BARCODE_LENGTHS[type?.toUpperCase() ?? 'CODE128'];
  if (!rule) return { valid: true };

  if (rule.fixed && data.length !== rule.fixed) {
    return {
      valid: false,
      message: `${type} requer exatamente ${rule.fixed} dígitos (atual: ${data.length})`,
    };
  }
  if (data.length < rule.min) {
    return {
      valid: false,
      message: `${type} requer no mínimo ${rule.min} caracteres`,
    };
  }
  if (data.length > rule.max) {
    return {
      valid: false,
      message: `${type} aceita no máximo ${rule.max} caracteres (atual: ${data.length})`,
    };
  }

  // ITF must be even-length
  if ((type === 'ITF' || type === 'ITF25') && data.length % 2 !== 0) {
    return { valid: false, message: 'ITF requer número par de dígitos' };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────
//  PreviewRenderer
// ─────────────────────────────────────────────────────────────

export class PreviewRenderer {
  private profile: PrinterProfile;
  private orientation: PrintOrientation;

  constructor(
    profile:     PrinterProfile     = DEFAULT_PROFILE,
    orientation: PrintOrientation   = 'portrait',
  ) {
    this.profile     = profile;
    this.orientation = orientation;
  }

  // Effective chars per line considering orientation and multiplier
  get charsPerLine(): number {
    // Landscape: the paper is rotated so effective width is paper length
    // We can't know paper length, so for preview we use a generous estimate
    // (landscape typically allows ~2.5x more content width)
    if (this.orientation === 'landscape') {
      return Math.round(this.profile.charsPerLine * 2.5);
    }
    return this.profile.charsPerLine;
  }

  get dotsPerLine(): number {
    if (this.orientation === 'landscape') {
      return Math.round(this.profile.dotsPerLine * 2.5);
    }
    return this.profile.dotsPerLine;
  }

  // ── Element factories ──────────────────────────────────────

  renderText(content: string, options: TextOptions = {}): PreviewText {
    const sizeW = options.widthMultiplier ?? options.size ?? 1;
    const charWidth = sizeW;
    const effectiveChars = Math.floor(this.charsPerLine / sizeW);
    const overflow = content.length > effectiveChars;

    return { type: 'text', content, options, charWidth, overflow };
  }

  renderBarcode(data: string, options: BarcodeOptions = {}): PreviewBarcode {
    const type = (options.type ?? 'CODE128').toUpperCase();
    const validation = validateBarcode(data, type);

    // Estimate barcode width in dots: moduleWidth × data length × encoding factor
    const moduleWidth = options.width ?? 2;
    const encodingFactor: Record<string, number> = {
      CODE128: 11, CODE39: 13, CODE93: 9,
      ITF: 9, ITF25: 9, EAN13: 11, EAN8: 11, CODABAR: 10,
    };
    const factor = encodingFactor[type] ?? 11;
    const estimatedDots = data.length * factor * moduleWidth + 20; // +20 quiet zone
    const overflow = estimatedDots > this.dotsPerLine;

    return {
      type: 'barcode',
      data,
      options,
      overflow,
      validData: validation.valid,
      validationMessage: validation.message,
    };
  }

  renderQRCode(data: string, options: QRCodeOptions = {}): PreviewQRCode {
    const size = options.size ?? 4;
    // QR modules × module pixel size. Version depends on data length but
    // for preview we estimate: version ≈ ceil(data.length / 7) + 1
    const version = Math.min(40, Math.ceil(data.length / 7) + 1);
    const modulesPerSide = (version - 1) * 4 + 21;
    const estimatedDots = modulesPerSide * size;
    const overflow = estimatedDots > this.dotsPerLine;

    return { type: 'qrcode', data, options, estimatedDots, overflow };
  }

  renderImage(options: ImageOptions): PreviewImage {
    const printWidthDots = options.width ?? this.dotsPerLine;
    const overflow = printWidthDots > this.dotsPerLine;

    return { type: 'image', source: options.source, options, overflow, printWidthDots };
  }

  renderDivider(options: DividerOptions = {}): PreviewDivider {
    return { type: 'divider', options, overflow: false };
  }

  renderFeed(lines: number): PreviewFeed {
    return { type: 'feed', lines, overflow: false };
  }

  renderCut(options: CutOptions = {}): PreviewCut {
    return { type: 'cut', options, overflow: false };
  }

  renderSection(options: SectionOptions): PreviewSection {
    return { type: 'section', options, overflow: false };
  }

  renderTable(options: TableOptions): PreviewTableRow {
    const total = this.charsPerLine;
    const renderedCells: string[] = [];
    const truncatedCells: boolean[] = [];

    for (const cell of options.cells) {
      const cellW = Math.floor((cell.width / 100) * total);
      let text = cell.text;
      const truncated = text.length > cellW;

      if (truncated) text = text.slice(0, cellW - 1) + '…';
      else if (cell.align === 'right')  text = text.padStart(cellW);
      else if (cell.align === 'center') {
        const pad = Math.floor((cellW - text.length) / 2);
        text = ' '.repeat(pad) + text;
      } else text = text.padEnd(cellW);

      renderedCells.push(text);
      truncatedCells.push(truncated);
    }

    return { type: 'table', options, renderedCells, truncatedCells, overflow: false };
  }

  // ── Paper metrics ──────────────────────────────────────────

  /** Paper width in mm */
  get paperWidthMm(): number {
    return this.profile.paperWidth;
  }

  /** Dots per mm (203dpi = 8dpmm) */
  get dotsPerMm(): number {
    return 8; // 203 DPI
  }

  /** Paper width in screen pixels at a given scale */
  paperWidthPx(scale: number): number {
    return this.profile.paperWidth * scale;
  }
}
