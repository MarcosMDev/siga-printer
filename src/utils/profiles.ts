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
    supportsPageMode: true,
    maxPageLength: 1662,
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
    supportsPageMode: true,
    maxPageLength: 1662,
  },

  // TM-T20X II — primary target
  EPSON_TM_T20X: {
    model: 'EPSON_TM_T20X',
    paperWidth: 80,
    charsPerLine: 42,
    supportsNativeQR: true,
    supportsNativeBarcode: true,
    supportsImage: true,
    supportsRotation: false,
    dotsPerLine: 576,
    // Page Mode (ESC L / ESC T / FF) is supported by all Epson TM series.
    // Used for landscape — much faster and higher quality than bitmap rotation.
    supportsPageMode: true,
    maxPageLength: 1662,
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
    supportsPageMode: true,
    maxPageLength: 1662,
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
    supportsPageMode: true,
    maxPageLength: 1662,
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
    // Most generic 58mm thermal printers lack Page Mode support
    supportsPageMode: false,
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
    // Unknown — default to false; override with a custom profile if needed
    supportsPageMode: false,
  },
};

export const DEFAULT_PROFILE = PRINTER_PROFILES.EPSON_TM_T20X;
