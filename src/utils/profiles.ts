import type { PrinterModel, PrinterProfile } from '../types';

// ─────────────────────────────────────────────────────────────
//  Printer Profiles
//  Defines per-model capabilities and paper geometry.
//  Used by the CommandBuilder to calculate column widths,
//  validate barcode sizes, etc.
// ─────────────────────────────────────────────────────────────

export const PRINTER_PROFILES: Record<PrinterModel, PrinterProfile> = {

  EPSON_TM_T20: {
    model: 'EPSON_TM_T20',
    paperWidth: 80,
    charsPerLine: 42,
    supportsNativeQR: true,
    supportsNativeBarcode: true,
    supportsImage: true,
    supportsRotation: false,
    dotsPerLine: 576,
  },

  EPSON_TM_T20II: {
    model: 'EPSON_TM_T20II',
    paperWidth: 80,
    charsPerLine: 42,
    supportsNativeQR: true,
    supportsNativeBarcode: true,
    supportsImage: true,
    supportsRotation: false,
    dotsPerLine: 576,
  },

  // TM-T20X II — primary target
  EPSON_TM_T20X: {
    model: 'EPSON_TM_T20X',
    paperWidth: 80,
    charsPerLine: 42,
    supportsNativeQR: true,
    supportsNativeBarcode: true,
    supportsImage: true,
    // The TM-T20X does NOT have native landscape/rotation ESC command,
    // so landscape is achieved by rasterizing the content rotated 90°
    supportsRotation: false,
    dotsPerLine: 576,
  },

  EPSON_TM_T88: {
    model: 'EPSON_TM_T88',
    paperWidth: 80,
    charsPerLine: 48,
    supportsNativeQR: true,
    supportsNativeBarcode: true,
    supportsImage: true,
    supportsRotation: true,
    dotsPerLine: 576,
  },

  EPSON_TM_T82: {
    model: 'EPSON_TM_T82',
    paperWidth: 80,
    charsPerLine: 42,
    supportsNativeQR: true,
    supportsNativeBarcode: true,
    supportsImage: true,
    supportsRotation: false,
    dotsPerLine: 576,
  },

  GENERIC_58MM: {
    model: 'GENERIC_58MM',
    paperWidth: 58,
    charsPerLine: 32,
    supportsNativeQR: false,
    supportsNativeBarcode: false,
    supportsImage: true,
    supportsRotation: false,
    dotsPerLine: 384,
  },

  GENERIC_80MM: {
    model: 'GENERIC_80MM',
    paperWidth: 80,
    charsPerLine: 42,
    supportsNativeQR: false,
    supportsNativeBarcode: false,
    supportsImage: true,
    supportsRotation: false,
    dotsPerLine: 576,
  },
};

export const DEFAULT_PROFILE = PRINTER_PROFILES.EPSON_TM_T20X;
