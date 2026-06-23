// ─────────────────────────────────────────────────────────────
//  siga-printer — Type Definitions
// ─────────────────────────────────────────────────────────────

// ── Connection ────────────────────────────────────────────────

export type ConnectionType = 'usb' | 'serial' | 'bluetooth' | 'tcp';

export interface USBConnectionConfig {
  type: 'usb';
  /** Epson TM-T20X II vendor ID = 0x04B8 */
  vendorId?: number;
  /** Epson TM-T20X II product ID = 0x0202 */
  productId?: number;
  /** Timeout in ms for bulk transfer (default: 3000) */
  timeout?: number;
}

export interface SerialConnectionConfig {
  type: 'serial';
  /** e.g. '/dev/ttyUSB0' or 'COM3' */
  path: string;
  baudRate?: 9600 | 19200 | 38400 | 57600 | 115200;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
}

export interface BluetoothConnectionConfig {
  type: 'bluetooth';
  /** MAC address on Android, UUID on iOS */
  address: string;
  /** Human-readable name (optional, used for auto-discovery) */
  name?: string;
}

export interface TCPConnectionConfig {
  type: 'tcp';
  host: string;
  port?: number; // default: 9100
  timeout?: number; // ms, default: 5000
}

export type ConnectionConfig =
  | USBConnectionConfig
  | SerialConnectionConfig
  | BluetoothConnectionConfig
  | TCPConnectionConfig;

export interface ConnectionStatus {
  connected: boolean;
  type: ConnectionType;
  deviceName?: string;
  error?: string;
}

// ── Printer capabilities ──────────────────────────────────────

export type PrinterModel =
  | 'EPSON_TM_T20'
  | 'EPSON_TM_T20II'
  | 'EPSON_TM_T20X'
  | 'EPSON_TM_T88'
  | 'EPSON_TM_T82'
  | 'GENERIC_58MM'
  | 'GENERIC_80MM';

export interface PrinterProfile {
  model: PrinterModel;
  /** Paper width in mm */
  paperWidth: 58 | 80;
  /** Characters per line at normal size */
  charsPerLine: number;
  /** Supports native QR code command (GS k) */
  supportsNativeQR: boolean;
  /** Supports native barcode command */
  supportsNativeBarcode: boolean;
  /** Supports image printing (GS v 0) */
  supportsImage: boolean;
  /** Supports landscape/rotated printing */
  supportsRotation: boolean;
  /** Max dots per line */
  dotsPerLine: number;
}

// ── Print orientation ─────────────────────────────────────────

export type PrintOrientation = 'portrait' | 'landscape';

// ── Text ─────────────────────────────────────────────────────

export type TextAlign = 'left' | 'center' | 'right';
export type TextSize = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type CharsetEncoding =
  | 'CP437'   // USA
  | 'CP850'   // Multilingual (most common)
  | 'CP860'   // Portuguese — ideal for boletos
  | 'CP1252'  // Windows Latin-1
  | 'UTF8';   // Only supported by some models

export interface TextOptions {
  bold?: boolean;
  underline?: boolean | 'double';
  /** 1 = normal, 2 = double width/height, up to 8 */
  size?: TextSize;
  /** Width multiplier independently of height */
  widthMultiplier?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Height multiplier independently of width */
  heightMultiplier?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  align?: TextAlign;
  /** Override charset for this text block */
  charset?: CharsetEncoding;
  /** Invert colors (white on black) */
  invert?: boolean;
}

// ── Barcode ───────────────────────────────────────────────────

export type BarcodeType =
  | 'CODE39'
  | 'CODE93'
  | 'CODE128'
  | 'EAN8'
  | 'EAN13'
  | 'ITF'       // Interleaved 2of5 — used in Brazilian boletos
  | 'ITF25'     // alias
  | 'CODABAR'
  | 'UPC_A'
  | 'UPC_E';

export type HRIPosition = 'none' | 'above' | 'below' | 'both';

export interface BarcodeOptions {
  type?: BarcodeType;
  /** Bar height in dots (default: 50) */
  height?: number;
  /** Module width in dots 1-6 (default: 2) */
  width?: 1 | 2 | 3 | 4 | 5 | 6;
  hriPosition?: HRIPosition;
  hriFont?: 'A' | 'B';
  align?: TextAlign;
}

// ── QR Code ───────────────────────────────────────────────────

export type QRErrorLevel = 'L' | 'M' | 'Q' | 'H';
export type QRModel = 1 | 2;

export interface QRCodeOptions {
  /** Module size 1-16 (default: 4) */
  size?: number;
  errorLevel?: QRErrorLevel;
  model?: QRModel;
  align?: TextAlign;
}

// ── Image ─────────────────────────────────────────────────────

export type ImageDitherMode =
  | 'threshold'       // Simple black/white threshold — fastest
  | 'floyd-steinberg' // Best for photos
  | 'atkinson'        // Slightly sharper than floyd-steinberg
  | 'bayer';          // Ordered dithering — faster than error-diffusion

export interface ImageOptions {
  /** Local file URI, require(), base64 data URI or http URL */
  source: string | number;
  /** Target width in dots. Height scales proportionally if not set. */
  width?: number;
  height?: number;
  align?: TextAlign;
  dither?: ImageDitherMode;
  /** 0.0 – 1.0 threshold for 'threshold' mode (default: 0.5) */
  threshold?: number;
}

// ── Table / Row ───────────────────────────────────────────────

export interface TableCell {
  text: string;
  /** Column width as percentage 0-100. Cells must sum to 100. */
  width: number;
  align?: TextAlign;
  bold?: boolean;
  underline?: boolean;
}

export interface TableOptions {
  cells: TableCell[];
  divider?: boolean;
}

// ── Divider ───────────────────────────────────────────────────

export type DividerStyle = 'line' | 'double' | 'dashed' | 'dotted' | 'empty';

export interface DividerOptions {
  style?: DividerStyle;
  /** Custom character to repeat */
  char?: string;
}

// ── Cut ───────────────────────────────────────────────────────

export type CutMode = 'full' | 'partial';

export interface CutOptions {
  mode?: CutMode;
  /** Feed lines before cutting (default: 3) */
  feed?: number;
}

// ── Cash Drawer ───────────────────────────────────────────────

export interface CashDrawerOptions {
  /** Pin 2 or pin 5 (default: 2) */
  pin?: 2 | 5;
  /** Pulse duration in ms (default: 100) */
  duration?: number;
}

// ── Section / Header ─────────────────────────────────────────

export interface SectionOptions {
  title: string;
  bold?: boolean;
  uppercase?: boolean;
  dividerChar?: string;
}

// ── Builder options ───────────────────────────────────────────

export interface ThermalPrinterOptions {
  /** Printer profile — affects char width calculations */
  profile?: PrinterProfile;
  /** Default charset for all text (default: 'CP860' for PT-BR) */
  charset?: CharsetEncoding;
  /** Default text alignment */
  defaultAlign?: TextAlign;
  /** Print orientation (default: 'portrait') */
  orientation?: PrintOrientation;
  /** Feed lines after each print job (default: 0) */
  feedAfterPrint?: number;
  /** Auto-cut after print (default: false) */
  autoCut?: boolean;
  autoCutMode?: CutMode;
}

// ── Print Job ─────────────────────────────────────────────────

export interface PrintJob {
  id: string;
  /** Raw ESC/POS bytes */
  data: Uint8Array;
  createdAt: Date;
  status: 'pending' | 'printing' | 'done' | 'error';
  error?: string;
  retries: number;
}

export interface PrintResult {
  success: boolean;
  jobId: string;
  bytesWritten: number;
  durationMs: number;
  error?: string;
}

// ── Discovered device ─────────────────────────────────────────

export interface DiscoveredDevice {
  type: ConnectionType;
  name: string;
  address: string;
  /** For USB: vendorId */
  vendorId?: number;
  /** For USB: productId */
  productId?: number;
  /** Signal strength for Bluetooth */
  rssi?: number;
}

// ── Native module spec (for codegen) ─────────────────────────

export interface ThermalPrinterNativeSpec {
  connect(config: ConnectionConfig): Promise<boolean>;
  disconnect(): Promise<void>;
  write(data: number[]): Promise<PrintResult>;
  isConnected(): Promise<boolean>;
  discoverDevices(type: ConnectionType, timeout: number): Promise<DiscoveredDevice[]>;
  getStatus(): Promise<ConnectionStatus>;
  requestUSBPermission(vendorId: number, productId: number): Promise<boolean>;
  openCashDrawer(options: CashDrawerOptions): Promise<boolean>;
}
