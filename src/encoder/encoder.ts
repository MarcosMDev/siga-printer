import type {
  TextOptions,
  BarcodeOptions,
  QRCodeOptions,
  ImageOptions,
  TableOptions,
  DividerOptions,
  CutOptions,
  CashDrawerOptions,
  SectionOptions,
  PrinterProfile,
  CharsetEncoding,
  TextAlign,
} from '../types';

import * as CMD from './commands';
import { ImageRasterizer } from './rasterizer';
import { DEFAULT_PROFILE } from '../utils/profiles';

// ─────────────────────────────────────────────────────────────
//  ESCPOSEncoder
//  Converts high-level commands into raw ESC/POS byte arrays.
//  All methods return number[] (bytes) ready to be buffered.
// ─────────────────────────────────────────────────────────────

export class ESCPOSEncoder {
  private profile: PrinterProfile;
  private defaultCharset: CharsetEncoding;

  constructor(
    profile: PrinterProfile = DEFAULT_PROFILE,
    charset: CharsetEncoding = 'CP860',
  ) {
    this.profile        = profile;
    this.defaultCharset = charset;
  }

  // ── Init ────────────────────────────────────────────────────

  init(): number[] {
    return [
      ...CMD.INIT,
      ...CMD.codePage(this.defaultCharset),
      ...CMD.CHAR_SIZE_NORMAL,
      ...CMD.BOLD_OFF,
      ...CMD.UNDERLINE_OFF,
      ...CMD.INVERT_OFF,
      ...CMD.ALIGN_LEFT,
    ];
  }

  // ── Text ────────────────────────────────────────────────────

  text(content: string, options: TextOptions = {}): number[] {
    const bytes: number[] = [];

    // Charset override
    if (options.charset && options.charset !== this.defaultCharset) {
      bytes.push(...CMD.codePage(options.charset));
    }

    // Alignment
    bytes.push(...this._alignCmd(options.align ?? 'left'));

    // Bold
    bytes.push(...(options.bold ? CMD.BOLD_ON : CMD.BOLD_OFF));

    // Underline
    if (!options.underline) {
      bytes.push(...CMD.UNDERLINE_OFF);
    } else if (options.underline === 'double') {
      bytes.push(...CMD.UNDERLINE_2DOT);
    } else {
      bytes.push(...CMD.UNDERLINE_1DOT);
    }

    // Invert
    bytes.push(...(options.invert ? CMD.INVERT_ON : CMD.INVERT_OFF));

    // Size
    const w = options.widthMultiplier  ?? options.size ?? 1;
    const h = options.heightMultiplier ?? options.size ?? 1;
    bytes.push(...CMD.charSize(Math.min(w, 8), Math.min(h, 8)));

    // Text bytes
    bytes.push(...this._encodeString(content, options.charset ?? this.defaultCharset));
    bytes.push(CMD.LF);

    // Reset formatting
    bytes.push(
      ...CMD.CHAR_SIZE_NORMAL,
      ...CMD.BOLD_OFF,
      ...CMD.UNDERLINE_OFF,
      ...CMD.INVERT_OFF,
    );

    // Restore charset
    if (options.charset && options.charset !== this.defaultCharset) {
      bytes.push(...CMD.codePage(this.defaultCharset));
    }

    return bytes;
  }

  // ── Raw text (no formatting, no newline) ────────────────────

  rawText(content: string): number[] {
    return this._encodeString(content, this.defaultCharset);
  }

  // ── Feed ────────────────────────────────────────────────────

  feed(lines = 1): number[] {
    return CMD.feedLines(lines);
  }

  feedDots(dots: number): number[] {
    return CMD.feedDots(dots);
  }

  // ── Divider ─────────────────────────────────────────────────

  divider(options: DividerOptions = {}): number[] {
    const style = options.style ?? 'line';
    let char: string;

    switch (style) {
      case 'double':  char = options.char ?? '='; break;
      case 'dashed':  char = options.char ?? '-'; break;
      case 'dotted':  char = options.char ?? '.'; break;
      case 'empty':   return [CMD.LF];
      default:        char = options.char ?? '-'; break;
    }

    const line = char.repeat(this.profile.charsPerLine);
    return this.text(line);
  }

  // ── Section header ───────────────────────────────────────────

  section(options: SectionOptions): number[] {
    const bytes: number[] = [];
    const divChar = options.dividerChar ?? '-';
    const title   = options.uppercase
      ? options.title.toUpperCase()
      : options.title;

    // Top divider
    bytes.push(...this.divider({ char: divChar }));

    // Title
    bytes.push(...this.text(title, {
      bold: options.bold ?? true,
      align: 'center',
    }));

    // Bottom divider
    bytes.push(...this.divider({ char: divChar }));

    return bytes;
  }

  // ── Table row ───────────────────────────────────────────────

  table(options: TableOptions): number[] {
    const bytes: number[] = [];
    const totalChars = this.profile.charsPerLine;

    // Build each cell string with appropriate padding/truncation
    const row = options.cells.map(cell => {
      const cellWidth = Math.floor((cell.width / 100) * totalChars);
      let text = cell.text;

      // Truncate if too long
      if (text.length > cellWidth) {
        text = text.slice(0, cellWidth - 1) + '…';
      }

      // Pad/align
      if (cell.align === 'right') {
        text = text.padStart(cellWidth);
      } else if (cell.align === 'center') {
        const pad = Math.floor((cellWidth - text.length) / 2);
        text = ' '.repeat(pad) + text + ' '.repeat(cellWidth - text.length - pad);
      } else {
        text = text.padEnd(cellWidth);
      }

      return text;
    });

    const line = row.join('');

    // We can't mix bold per-cell easily in ESC/POS (no inline style reset
    // mid-line in font A). Best approach: emit as single plain line.
    // For bold cells, consider rendering them as separate lines.
    bytes.push(...this._encodeString(line, this.defaultCharset));
    bytes.push(CMD.LF);

    if (options.divider) {
      bytes.push(...this.divider());
    }

    return bytes;
  }

  // ── Barcode ─────────────────────────────────────────────────

  barcode(data: string, options: BarcodeOptions = {}): number[] {
    const bytes: number[] = [];

    bytes.push(...this._alignCmd(options.align ?? 'center'));

    // HRI (human readable interpretation) text position
    const hriMap = { none: 0, above: 1, below: 2, both: 3 } as const;
    const hriPos = hriMap[options.hriPosition ?? 'below'];
    bytes.push(...CMD.barcodeHRI(hriPos));

    // HRI font
    const hriFont = options.hriFont === 'B' ? 1 : 0;
    bytes.push(...CMD.barcodeHRIFont(hriFont));

    // Height and width
    bytes.push(...CMD.barcodeHeight(options.height ?? 50));
    bytes.push(...CMD.barcodeWidth(options.width ?? 2));

    // Print barcode
    bytes.push(...CMD.barcodeCommand(options.type ?? 'CODE128', data));
    bytes.push(CMD.LF);

    // Reset alignment
    bytes.push(...CMD.ALIGN_LEFT);

    return bytes;
  }

  // ── QR Code ─────────────────────────────────────────────────

  qrCode(data: string, options: QRCodeOptions = {}): number[] {
    const bytes: number[] = [];

    bytes.push(...this._alignCmd(options.align ?? 'center'));
    bytes.push(...CMD.qrModel(options.model ?? 2));
    bytes.push(...CMD.qrSize(options.size ?? 4));
    bytes.push(...CMD.qrErrorLevel(options.errorLevel ?? 'M'));
    bytes.push(...CMD.qrStore(data));
    bytes.push(...CMD.QR_PRINT);
    bytes.push(CMD.LF);
    bytes.push(...CMD.ALIGN_LEFT);

    return bytes;
  }

  // ── Image (async because of loading/rasterizing) ─────────────

  async image(options: ImageOptions): Promise<number[]> {
    const rasterizer = new ImageRasterizer(this.profile);

    const { widthBytes, heightDots, pixels } = await rasterizer.rasterize(
      options.source,
      {
        targetWidth:  options.width,
        targetHeight: options.height,
        dither:       options.dither ?? 'floyd-steinberg',
        threshold:    options.threshold ?? 0.5,
      },
    );

    const bytes: number[] = [];
    bytes.push(...this._alignCmd(options.align ?? 'center'));
    bytes.push(...CMD.rasterImage(widthBytes, heightDots, 0, pixels));
    bytes.push(CMD.LF);
    bytes.push(...CMD.ALIGN_LEFT);

    return bytes;
  }

  async imageLandscape(options: ImageOptions): Promise<number[]> {
    const rasterizer = new ImageRasterizer(this.profile);
    const { widthBytes, heightDots, pixels } = await rasterizer.renderLandscape(
      options.source,
      {
        targetWidth:  options.width,
        targetHeight: options.height,
        dither:       options.dither    ?? 'floyd-steinberg',
        threshold:    options.threshold ?? 0.5,
      },
    );
    const bytes: number[] = [];
    bytes.push(...this._alignCmd(options.align ?? 'center'));
    bytes.push(...CMD.rasterImage(widthBytes, heightDots, 0, pixels));
    bytes.push(CMD.LF);
    bytes.push(...CMD.ALIGN_LEFT);
    return bytes;
  }

  // ── Cut ─────────────────────────────────────────────────────

  cut(options: CutOptions = {}): number[] {
    const feed = options.feed ?? 3;
    return [
      ...CMD.feedLines(feed),
      ...(options.mode === 'partial' ? CMD.CUT_PARTIAL : CMD.CUT_FULL),
    ];
  }

  // ── Cash drawer ─────────────────────────────────────────────

  cashDrawer(options: CashDrawerOptions = {}): number[] {
    return CMD.cashDrawer(options.pin ?? 2, options.duration ?? 100);
  }

  // ── Orientation helpers ─────────────────────────────────────

  /**
   * For printers that support ESC V (native rotation)
   */
  rotateOn(): number[]  { return CMD.ROTATE_90_ON;  }
  rotateOff(): number[] { return CMD.ROTATE_90_OFF; }

  // ── Internal helpers ────────────────────────────────────────

  private _alignCmd(align: TextAlign): number[] {
    switch (align) {
      case 'center': return CMD.ALIGN_CENTER;
      case 'right':  return CMD.ALIGN_RIGHT;
      default:       return CMD.ALIGN_LEFT;
    }
  }

  private _encodeString(text: string, charset: CharsetEncoding): number[] {
    // For CP860/CP850/CP437 — simple Latin-1 passthrough
    // For proper international support, a full charset mapping table
    // should be loaded here. This covers the typical boleto use case.
    if (charset === 'UTF8') {
      const encoder = new TextEncoder();
      return Array.from(encoder.encode(text));
    }

    // Latin-1 passthrough with basic PT-BR accents (CP860)
    return Array.from(text).map(char => {
      const code = char.charCodeAt(0);
      if (code < 128) return code;
      // CP860 (Portuguese) specific mappings for common accented chars
      return CP860_MAP[char] ?? 0x3f; // fallback to '?'
    });
  }
}

// ── CP860 (Portuguese) character map ─────────────────────────
// Maps Unicode chars to CP860 byte values for common PT-BR chars

const CP860_MAP: Record<string, number> = {
  'À': 0x83, 'Á': 0x41, 'Â': 0x41, 'Ã': 0x41,
  'à': 0x85, 'á': 0xa0, 'â': 0x83, 'ã': 0xa4,
  'Ç': 0x80, 'ç': 0x87,
  'É': 0x45, 'Ê': 0x45,
  'é': 0x82, 'ê': 0x88,
  'Í': 0x49,
  'í': 0xa1,
  'Ó': 0x4f, 'Ô': 0x4f, 'Õ': 0x4f,
  'ó': 0xa2, 'ô': 0x93, 'õ': 0x94,
  'Ú': 0x55,
  'ú': 0xa3,
  'Ñ': 0xa5, 'ñ': 0xa4,
  'º': 0xa8,
  'ª': 0xa6,
  'R$': 0x52, // won't map multi-char, handle separately
  '€': 0xee,
  '°': 0xf8,
};
