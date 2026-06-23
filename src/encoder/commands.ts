// ─────────────────────────────────────────────────────────────
//  ESC/POS Command Constants
//  Based on Epson ESC/POS Application Programming Guide
//  https://download.epson.biz/div/tm-c3400/escpos/
// ─────────────────────────────────────────────────────────────

export const ESC = 0x1b;
export const GS  = 0x1d;
export const FS  = 0x1c;
export const DLE = 0x10;
export const NUL = 0x00;
export const LF  = 0x0a;
export const CR  = 0x0d;
export const FF  = 0x0c;
export const HT  = 0x09;

// ── Initialization ────────────────────────────────────────────

/** ESC @ — Initialize printer */
export const INIT = [ESC, 0x40];

// ── Text formatting ───────────────────────────────────────────

/** ESC E n — Bold on (n=1) / off (n=0) */
export const BOLD_ON  = [ESC, 0x45, 0x01];
export const BOLD_OFF = [ESC, 0x45, 0x00];

/** ESC - n — Underline on (n=1 or n=2) / off (n=0) */
export const UNDERLINE_OFF    = [ESC, 0x2d, 0x00];
export const UNDERLINE_1DOT   = [ESC, 0x2d, 0x01];
export const UNDERLINE_2DOT   = [ESC, 0x2d, 0x02];

/** ESC G n — Double-strike on/off */
export const DOUBLE_STRIKE_ON  = [ESC, 0x47, 0x01];
export const DOUBLE_STRIKE_OFF = [ESC, 0x47, 0x00];

/** GS B n — Invert (white on black) on/off */
export const INVERT_ON  = [GS, 0x42, 0x01];
export const INVERT_OFF = [GS, 0x42, 0x00];

// ── Alignment ─────────────────────────────────────────────────

/** ESC a n — Select justification: 0=left, 1=center, 2=right */
export const ALIGN_LEFT   = [ESC, 0x61, 0x00];
export const ALIGN_CENTER = [ESC, 0x61, 0x01];
export const ALIGN_RIGHT  = [ESC, 0x61, 0x02];

// ── Character size ────────────────────────────────────────────

/**
 * GS ! n — Select character size
 * Bits 0-2: height multiplier (0=x1 … 7=x8)
 * Bits 4-6: width  multiplier (0=x1 … 7=x8)
 * n = (widthMult-1) << 4 | (heightMult-1)
 */
export function charSize(widthMult: number, heightMult: number): number[] {
  const n = ((widthMult - 1) & 0x07) << 4 | ((heightMult - 1) & 0x07);
  return [GS, 0x21, n];
}
export const CHAR_SIZE_NORMAL = [GS, 0x21, 0x00];

// ── Feed & newline ────────────────────────────────────────────

/** ESC d n — Print and feed n lines */
export function feedLines(n: number): number[] {
  return [ESC, 0x64, n & 0xff];
}

/** ESC J n — Print and feed n dots */
export function feedDots(n: number): number[] {
  return [ESC, 0x4a, n & 0xff];
}

// ── Cut ───────────────────────────────────────────────────────

/** GS V 0 — Full cut */
export const CUT_FULL    = [GS, 0x56, 0x00];
/** GS V 1 — Partial cut */
export const CUT_PARTIAL = [GS, 0x56, 0x01];

// ── Cash drawer ───────────────────────────────────────────────

/**
 * ESC p m t1 t2 — Kick cash drawer
 * m: 0=pin2, 1=pin5
 * t1: on-time  (n * 2ms)
 * t2: off-time (n * 2ms)
 */
export function cashDrawer(pin: 2 | 5, duration = 100): number[] {
  const m  = pin === 5 ? 0x01 : 0x00;
  const t1 = Math.min(Math.floor(duration / 2), 0xff);
  const t2 = 0x19;
  return [ESC, 0x70, m, t1, t2];
}

// ── Barcode ───────────────────────────────────────────────────

/**
 * GS H n — HRI position: 0=none, 1=above, 2=below, 3=both
 */
export function barcodeHRI(position: 0 | 1 | 2 | 3): number[] {
  return [GS, 0x48, position];
}

/**
 * GS f n — HRI font: 0=font A, 1=font B
 */
export function barcodeHRIFont(font: 0 | 1): number[] {
  return [GS, 0x66, font];
}

/**
 * GS h n — Barcode height (dots, default 50)
 */
export function barcodeHeight(dots: number): number[] {
  return [GS, 0x68, dots & 0xff];
}

/**
 * GS w n — Barcode module width (1-6, default 2)
 */
export function barcodeWidth(n: 1 | 2 | 3 | 4 | 5 | 6): number[] {
  return [GS, 0x77, n];
}

/**
 * GS k m n d1...dk — Print barcode
 * Uses the second format (with length byte) for all types.
 *
 * Barcode type m values (second format):
 * 65=UPC-A, 66=UPC-E, 67=EAN13, 68=EAN8, 69=CODE39,
 * 70=ITF, 71=CODABAR, 72=CODE93, 73=CODE128
 */
export const BARCODE_TYPE_MAP: Record<string, number> = {
  UPC_A:   65,
  UPC_E:   66,
  EAN13:   67,
  EAN8:    68,
  CODE39:  69,
  ITF:     70,
  ITF25:   70,
  CODABAR: 71,
  CODE93:  72,
  CODE128: 73,
};

export function barcodeCommand(type: string, data: string): number[] {
  const m = BARCODE_TYPE_MAP[type.toUpperCase()];
  if (m === undefined) throw new Error(`Unknown barcode type: ${type}`);
  const bytes = Array.from(data).map(c => c.charCodeAt(0));
  return [GS, 0x6b, m, bytes.length, ...bytes];
}

// ── QR Code (GS ( k) ─────────────────────────────────────────

// All QR commands use: GS ( k pL pH cn fn [data]
const QR_CN = 0x31; // model selection code

/** Select QR model: 1=Model1, 2=Model2(default), 3=MicroQR */
export function qrModel(model: 1 | 2): number[] {
  return [GS, 0x28, 0x6b, 0x04, 0x00, QR_CN, 0x41, model, 0x00];
}

/** Set QR module size (1-16) */
export function qrSize(size: number): number[] {
  return [GS, 0x28, 0x6b, 0x03, 0x00, QR_CN, 0x43, size & 0x0f];
}

/** Set QR error correction level: 48=L, 49=M, 50=Q, 51=H */
export const QR_ERROR_LEVEL: Record<string, number> = {
  L: 48, M: 49, Q: 50, H: 51,
};

export function qrErrorLevel(level: string): number[] {
  const n = QR_ERROR_LEVEL[level.toUpperCase()] ?? 49;
  return [GS, 0x28, 0x6b, 0x03, 0x00, QR_CN, 0x45, n];
}

/** Store QR data */
export function qrStore(data: string): number[] {
  const bytes = Array.from(data).map(c => c.charCodeAt(0));
  const len   = bytes.length + 3;
  const pL    = len & 0xff;
  const pH    = (len >> 8) & 0xff;
  return [GS, 0x28, 0x6b, pL, pH, QR_CN, 0x50, 0x30, ...bytes];
}

/** Print stored QR */
export const QR_PRINT = [GS, 0x28, 0x6b, 0x03, 0x00, QR_CN, 0x51, 0x30];

// ── Image (raster graphics) ───────────────────────────────────

/**
 * GS v 0 m xL xH yL yH d1...dk — Print raster bit image
 * m: mode — 0=normal, 1=double-width, 2=double-height, 3=quadruple
 */
export function rasterImage(
  widthBytes: number,
  heightDots: number,
  mode: 0 | 1 | 2 | 3,
  pixels: Uint8Array,
): number[] {
  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = heightDots & 0xff;
  const yH = (heightDots >> 8) & 0xff;
  return [GS, 0x76, 0x30, mode, xL, xH, yL, yH, ...Array.from(pixels)];
}

// ── Charset / Code page ───────────────────────────────────────

/** ESC t n — Select character code table */
export const CODE_PAGE: Record<string, number> = {
  CP437:  0,
  CP850:  2,
  CP860:  6,   // Portuguese
  CP1252: 16,
};
export function codePage(charset: string): number[] {
  const n = CODE_PAGE[charset] ?? 2;
  return [ESC, 0x74, n];
}

// ── Rotation / Orientation ────────────────────────────────────

/**
 * ESC V n — Rotate 90° clockwise (not supported on all models)
 * 0 = off, 1 = on
 *
 * NOTE: TM-T20X does NOT support this command.
 * For landscape on that model, we rasterize the content rotated 90°
 * and send as a raster image. See ImageRasterizer.renderLandscape().
 */
export const ROTATE_90_ON  = [ESC, 0x56, 0x01];
export const ROTATE_90_OFF = [ESC, 0x56, 0x00];
