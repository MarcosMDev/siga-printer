# Changelog

## [1.0.0] — 2025-08-01

### Initial release

**Core**
- `ThermalPrinter` — fluent builder API with full ESC/POS support
- `ConnectedThermalPrinter` — printer + I/O in one object
- `ESCPOSEncoder` — all Epson TM-series commands implemented
- `ImageRasterizer` — bilinear resize + 4 dithering algorithms (threshold, Floyd-Steinberg, Atkinson, Bayer)
- Landscape printing via 90° bitmap rotation (for TM-T20X II which lacks ESC V)
- Compatible with both Old Architecture (bridge) and New Architecture (TurboModule)

**Connections (Android)**
- USB OTG — auto-detect Epson TM-T20X II (VID 0x04B8)
- Serial (RS-232) via USB-Serial adapters (PL2303, FTDI, CP210x, CH340)
- Bluetooth Classic (SPP)
- TCP/IP (port 9100)

**Connections (iOS)**
- TCP/IP
- Bluetooth MFi (ExternalAccessory framework)

**Templates**
- `BoletoTemplate` — boleto bancário completo com ITF-25 + Pix QR Code
- `ReceiptTemplate` — cupom/recibo com itens, totais e pagamentos
- `ShippingLabelTemplate` — etiqueta de envio com rastreio CODE128

**Utilities**
- `PrintQueue` — fila de jobs com retry automático e callbacks de status
- `PrinterDiscovery` — scan de dispositivos em todos os transportes
- `usePrinter()` — React hook para gerenciamento de ciclo de vida
- `useDiscovery()` — React hook para scan de dispositivos

**Profiles**
- Epson TM-T20, TM-T20II, TM-T20X (padrão), TM-T88, TM-T82
- Generic 58mm, Generic 80mm
