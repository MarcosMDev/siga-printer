# Changelog

All notable changes to `siga-printer` will be documented here.

## [1.0.0] — 2025-08-01

### Initial release

**Core**
- `ThermalPrinter` — fluent builder API with full ESC/POS support
- `ConnectedThermalPrinter` — printer + I/O in one object
- `ESCPOSEncoder` — complete Epson TM-series command set
- `ImageRasterizer` — bilinear resize + 4 dithering modes (threshold, Floyd-Steinberg, Atkinson, Bayer)
- Landscape printing via 90° bitmap rotation (TM-T20X II lacks ESC V)
- Compatible with Old Architecture (bridge) and New Architecture (TurboModule/JSI)

**Connections — Android**
- USB OTG — auto-detect Epson TM-T20X II (VID 0x04B8)
- Serial RS-232 via USB-Serial adapters (PL2303, FTDI, CP210x, CH340)
- Bluetooth Classic (SPP)
- TCP/IP (port 9100)

**Connections — iOS**
- TCP/IP
- Bluetooth MFi (ExternalAccessory)

**Templates**
- `BoletoTemplate` — boleto bancário with ITF-25 barcode + Pix QR Code
- `ReceiptTemplate` — receipt/cupom with items, totals and payments
- `ShippingLabelTemplate` — shipping label with CODE128 tracking

**Preview & Config**
- `PrintPreview` — realistic thermal paper preview component with overflow detection
- `PrintConfigScreen` — block editor with live preview (phone tabs / tablet side-by-side)
- `PrintPreviewBuilder` — same fluent API as `ThermalPrinter` but renders preview elements

**Template Designer**
- `TemplateDesigner` — drag-and-drop canvas editor (PanResponder, no external libs)
- `PaperCanvas` — absolute block positioning, grid, snap-to-grid (2mm), mm rulers
- `BlockPropertiesPanel` — context-sensitive property editor with variable binding
- `VariablesPanel` — dynamic variable management with TypeScript interface codegen
- `generateTypeScriptCode()` — exports a ready-to-use `.ts` class from any template
- `BOLETO_LANDSCAPE_STARTER` — pre-built landscape boleto layout

**Utilities**
- `PrintQueue` — job queue with auto-retry, pause/resume, status callbacks
- `PrinterDiscovery` — device scan across all transports
- `usePrinter()` — React hook for full printer lifecycle management
- `useDiscovery()` — React hook for device scanning

**Printer Profiles**
- Epson TM-T20, TM-T20II, TM-T20X (default), TM-T88, TM-T82
- Generic 58mm, Generic 80mm
