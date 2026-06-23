// ─────────────────────────────────────────────────────────────
//  siga-printer
//  Public API
// ─────────────────────────────────────────────────────────────

// Main builder
export { ThermalPrinter, ConnectedThermalPrinter } from './builder/ThermalPrinter';

// Printer discovery
export { PrinterDiscovery } from './connection/discovery';

// Templates
export { BoletoTemplate }       from './templates/BoletoTemplate';
export { ReceiptTemplate }      from './templates/ReceiptTemplate';
export { ShippingLabelTemplate } from './templates/ShippingLabelTemplate';

// Utilities
export { PrintQueue }           from './utils/PrintQueue';

// React hooks
export { usePrinter, useDiscovery } from './utils/hooks';

// Printer profiles
export { PRINTER_PROFILES, DEFAULT_PROFILE } from './utils/profiles';

// All types
export type {
  // Connection
  ConnectionType,
  ConnectionConfig,
  ConnectionStatus,
  USBConnectionConfig,
  SerialConnectionConfig,
  BluetoothConnectionConfig,
  TCPConnectionConfig,
  DiscoveredDevice,

  // Printer
  PrinterModel,
  PrinterProfile,
  PrintOrientation,

  // Builder options
  ThermalPrinterOptions,

  // Content options
  TextOptions,
  TextAlign,
  TextSize,
  CharsetEncoding,
  BarcodeOptions,
  BarcodeType,
  HRIPosition,
  QRCodeOptions,
  QRErrorLevel,
  ImageOptions,
  ImageDitherMode,
  TableOptions,
  TableCell,
  DividerOptions,
  DividerStyle,
  CutOptions,
  CutMode,
  CashDrawerOptions,
  SectionOptions,

  // Result
  PrintResult,
  PrintJob,
} from './types';

// Template data types
export type { BoletoData }        from './templates/BoletoTemplate';
export type { ReceiptData, ReceiptItem, ReceiptTotals, ReceiptPayment } from './templates/ReceiptTemplate';
export type { ShippingLabelData } from './templates/ShippingLabelTemplate';

// Queue types
export type { QueuedJob, PrintQueueOptions } from './utils/PrintQueue';

// Hook types
export type { UsePrinterReturn, UseDiscoveryReturn } from './utils/hooks';

// ── Preview & Config ──────────────────────────────────────────
export {
  PrintPreview,
  PrintPreviewBuilder,
  PrintConfigScreen,
  PreviewRenderer,
} from './preview';

export type {
  PrintPreviewProps,
  PrintConfigScreenProps,
  PreviewElement,
  PreviewElementType,
} from './preview';

// ── Template Designer ─────────────────────────────────────────
export {
  TemplateDesigner,
  BOLETO_LANDSCAPE_STARTER,
  generateTypeScriptCode,
  createDefaultBlock,
  BLOCK_META,
} from './template-designer';

export type {
  DesignerBlock,
  DesignerBlockType,
  TemplateDefinition,
  TemplateVariable,
  BlockGeometry,
  BlockData,
} from './template-designer';
