# siga-printer

React Native library for ESC/POS thermal printer printing.
Full support for Epson TM-T20X II and compatible printers.

**[English](#english) | [Português](#português)**

---

<a name="english"></a>
# English

## Supported connections

| Type         | Android | iOS  | Notes                                    |
|--------------|---------|------|------------------------------------------|
| USB (OTG)    | ✅      | ❌   | USB OTG cable required                   |
| Serial       | ✅      | ❌   | Via USB-Serial adapter (RS-232)          |
| Bluetooth    | ✅      | ✅   | Classic SPP (Android) / MFi (iOS)        |
| TCP/IP       | ✅      | ✅   | Port 9100 (Epson default)                |

---

## Installation

```sh
npm install siga-printer
# or
yarn add siga-printer
```

### Expo (bare workflow / EAS Build)

> **Managed workflow is not supported** — this library has native modules.
> Use bare workflow (`expo prebuild`) or Expo Dev Client.

Add the config plugin to `app.json`:

```json
{
  "expo": {
    "plugins": ["siga-printer"]
  }
}
```

Then run:

```sh
expo prebuild
# or (EAS)
eas build
```

The plugin automatically adds all required Android permissions and iOS plist entries — no manual setup needed.

Also add to `android/build.gradle`:
```gradle
allprojects {
  repositories {
    maven { url 'https://jitpack.io' }
  }
}
```

### Bare React Native

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- USB -->
<uses-feature android:name="android.hardware.usb.host" android:required="false" />

<!-- Bluetooth (Android 12+) -->
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
```

Add to `android/build.gradle`:
```gradle
allprojects {
  repositories {
    maven { url 'https://jitpack.io' }
  }
}
```

### iOS

```sh
cd ios && pod install
```

Add to `Info.plist` (for Bluetooth MFi):
```xml
<key>UISupportedExternalAccessoryProtocols</key>
<array>
  <string>com.epson.escpos</string>
</array>
```

---

## Basic usage

```typescript
import { ThermalPrinter } from 'siga-printer';

const printer = await ThermalPrinter.connect({
  type: 'usb',
  vendorId:  0x04b8,  // Epson
  productId: 0x0202,  // TM-T20X II
});

await printer
  .init()
  .text('Hello, world!', { bold: true, align: 'center', size: 2 })
  .divider()
  .qrCode('https://example.com', { size: 6 })
  .cut()
  .print();

await printer.disconnect();
```

---

## API Reference

### `ThermalPrinter.connect(config, options?)`

Connects to a printer and returns a `ConnectedThermalPrinter`.

```typescript
const printer = await ThermalPrinter.connect(
  {
    type:      'usb',
    vendorId:  0x04b8,
    productId: 0x0202,
    timeout:   3000,
  },
  {
    profile:        PRINTER_PROFILES.EPSON_TM_T20X,
    charset:        'CP860',
    orientation:    'portrait',
    autoCut:        false,
    feedAfterPrint: 0,
  }
);
```

### `ThermalPrinter.create(options?)`

Creates a builder without connecting (generate bytes and send externally).

```typescript
const builder = ThermalPrinter.create({ charset: 'CP860' });
const bytes   = await builder.init().text('Test').cut().build();
// bytes: Uint8Array
```

---

### Content methods (chainable)

#### `.init()`
Initializes the printer (ESC @). **Always call at the start of each job.**

#### `.text(content, options?)`

```typescript
printer.text('Normal text')
printer.text('Bold centered', { bold: true, align: 'center' })
printer.text('Large', { size: 2 })
printer.text('Inverted', { invert: true })
printer.text('Double underline', { underline: 'double' })
```

| Prop               | Type                            | Default  |
|--------------------|---------------------------------|----------|
| `bold`             | `boolean`                       | `false`  |
| `underline`        | `boolean \| 'double'`           | `false`  |
| `size`             | `1–8`                           | `1`      |
| `widthMultiplier`  | `1–8`                           | `1`      |
| `heightMultiplier` | `1–8`                           | `1`      |
| `align`            | `'left' \| 'center' \| 'right'` | `'left'` |
| `invert`           | `boolean`                       | `false`  |
| `charset`          | `CharsetEncoding`               | inherited|

#### `.feed(lines?)` / `.feedDots(dots)`
Advance paper by lines or dots.

#### `.divider(options?)`

```typescript
printer.divider()                    // ─────────────────────
printer.divider({ style: 'double' }) // =====================
printer.divider({ style: 'dashed' }) // ---------------------
printer.divider({ style: 'dotted' }) // .....................
printer.divider({ char: '*' })       // *********************
```

#### `.section(title, options?)`

Section header with automatic dividers:
```
─────────────────────────────────────────
           CUSTOMER DATA
─────────────────────────────────────────
```

#### `.row(cells)`

Column layout. Widths must sum to 100:

```typescript
printer.row([
  { text: 'Product',  width: 60, align: 'left'  },
  { text: 'Qty',      width: 15, align: 'center' },
  { text: '$ 99.90', width: 25, align: 'right'  },
])
```

#### `.barcode(data, options?)`

```typescript
printer.barcode('34191090080000008214800082194207197960000125000', {
  type:        'ITF',
  height:      60,
  width:       2,
  hriPosition: 'below',
  align:       'center',
})
```

**Supported types:** `CODE39`, `CODE93`, `CODE128`, `EAN8`, `EAN13`, `ITF` / `ITF25`, `CODABAR`, `UPC_A`, `UPC_E`

#### `.qrCode(data, options?)`

```typescript
printer.qrCode('https://example.com', {
  size:       5,    // module size 1–16
  errorLevel: 'M',  // L | M | Q | H
  align:      'center',
})
```

#### `.image(options)`

```typescript
printer.image({ source: require('./assets/logo.png'), width: 200, align: 'center' })
printer.image({ source: 'data:image/png;base64,...', dither: 'floyd-steinberg' })
```

| Dither mode       | Best for                | Speed  |
|-------------------|-------------------------|--------|
| `threshold`       | Monochrome logos        | Fast   |
| `floyd-steinberg` | Photos and gradients    | Medium |
| `atkinson`        | Logos with halftones    | Medium |
| `bayer`           | Balanced                | Medium |

#### `.cut(mode?, options?)`

```typescript
printer.cut()                     // full cut + 3 feed lines
printer.cut('partial')            // partial cut
printer.cut('full', { feed: 5 }) // custom feed
```

#### `.cashDrawer(options?)`

```typescript
printer.cashDrawer()                         // pin 2, 100ms
printer.cashDrawer({ pin: 5, duration: 200 })
```

#### `.raw(bytes)`
Inject raw ESC/POS bytes for commands not covered by the API.

---

### Print orientation

```typescript
// Portrait (default)
const printer = await ThermalPrinter.connect(config, { orientation: 'portrait' });

// Landscape — content rotated 90°, useful for wide barcodes
const printer = await ThermalPrinter.connect(config, { orientation: 'landscape' });

// Switch during a job
printer.setOrientation('landscape');
```

> **TM-T20X II note:** This model does not support ESC V (native rotation).
> Landscape is implemented by rasterizing content as a rotated bitmap.
> The output is visually identical but requires slightly more processing.

---

### Connection manager

`printerManager` is a **global singleton** that holds connection state across components. Connect once, print from any screen.

```typescript
import { printerManager, useConnectionManager, PrinterSelector } from 'siga-printer';

// ── Imperative (outside components) ──────────────────────────

await printerManager.connectDevice(device); // device from discoverAll()
await printerManager.connect({ type: 'usb' });
await printerManager.disconnect();
await printerManager.reconnect();

const unsub = printerManager.subscribe(state => {
  console.log(state.status);          // 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'disconnected'
  console.log(state.connectedDevice); // DiscoveredDevice | null
});
unsub();

printerManager.configure({
  autoReconnect:       true,
  maxReconnectAttempts: 3,
  reconnectDelay:      1000, // ms, doubles each attempt
});
```

```typescript
// ── Reactive hook (inside components) ────────────────────────

import { useConnectionManager } from 'siga-printer';

function MyScreen() {
  const {
    status,
    connectedDevice,
    isConnected,
    error,
    connectDevice,
    connect,
    disconnect,
    reconnect,
  } = useConnectionManager();

  return <Text>{isConnected ? connectedDevice?.name : status}</Text>;
}
```

```tsx
// ── Ready-made UI component ───────────────────────────────────

import { PrinterSelector } from 'siga-printer';

function SetupScreen() {
  return (
    <PrinterSelector
      onConnect={(device) => console.log('Connected to', device.name)}
      onError={(msg) => console.error(msg)}
      scanType="all"    // 'all' | 'usb' | 'bluetooth' | 'tcp'
      showStatus={true}
    />
  );
}
```

`PrinterSelector` includes: scan by type, device list with icons, per-device connect/disconnect buttons, real-time status banner.

---

### Print preview

Render a realistic thermal paper preview — no printer required. Useful for testing templates, building template editors, and showing print previews to users.

```tsx
import { PrintPreviewBuilder, PrintPreview } from 'siga-printer';

function MyPreview() {
  const builder = new PrintPreviewBuilder({
    profile:     PRINTER_PROFILES.EPSON_TM_T20X,
    orientation: 'portrait',  // or 'landscape'
  });

  builder
    .init()
    .text('RECEIPT', { bold: true, align: 'center', size: 2 })
    .divider()
    .row([
      { text: 'Coffee',  width: 60 },
      { text: '$ 3.50', width: 40, align: 'right' },
    ])
    .divider()
    .qrCode('https://example.com', { size: 4, align: 'center' })
    .cut();

  return (
    <PrintPreview
      builder={builder}
      showRuler={true}
      showMetrics={true}
      showCutMark={true}
    />
  );
}
```

`PrintPreview` props:

| Prop               | Type      | Default | Description                         |
|--------------------|-----------|---------|-------------------------------------|
| `builder`          | `PrintPreviewBuilder` | required | Builder with content     |
| `showRuler`        | `boolean` | `true`  | mm ruler at top of paper            |
| `showMetrics`      | `boolean` | `true`  | metrics bar (length, overflow count)|
| `showCutMark`      | `boolean` | `true`  | scissors cut mark line              |
| `highlightOverflow`| `boolean` | `true`  | highlight overflow elements in red  |
| `scale`            | `number`  | auto    | paper width scale factor            |
| `style`            | `ViewStyle`| —      | ScrollView style override           |

**Landscape preview:** when `orientation: 'landscape'`, the preview shows a portrait paper strip with content rotated 90° — matching the physical paper as it exits the printer.

---

### Template designer

Visual drag-and-drop canvas for building print templates. Generates typed TypeScript code ready to use with `PrintPreviewBuilder`.

```tsx
import { TemplateDesigner } from 'siga-printer';

function DesignerScreen() {
  return (
    <TemplateDesigner
      onExport={(code, template) => {
        console.log('Generated TypeScript:', code);
        // paste into your project
      }}
      onSave={(template) => {
        // save template JSON to your backend or AsyncStorage
        saveTemplate(template);
      }}
    />
  );
}
```

`TemplateDesigner` props:

| Prop               | Type                                            | Description                      |
|--------------------|-------------------------------------------------|----------------------------------|
| `initialTemplate`  | `Partial<TemplateDefinition>`                   | Pre-load an existing template    |
| `onExport`         | `(code: string, template: TemplateDefinition) => void` | Called when user taps Export |
| `onSave`           | `(template: TemplateDefinition) => void`        | Called when user taps Save       |

Features:
- Drag-and-drop blocks on a scaled paper canvas
- 2mm snap-to-grid
- Block types: text, barcode, QR code, image, divider, row
- Per-block properties panel (alignment, font, size, etc.)
- Variables panel — define dynamic placeholders (`{{customer_name}}`, etc.)
- Printer profile and orientation selector
- Export to TypeScript code snippet
- Phone portrait: tabbed layout (Palette / Canvas / Properties)
- Tablet / landscape: three-column layout

---

### Device discovery

```typescript
import { PrinterDiscovery } from 'siga-printer';

const discovery = new PrinterDiscovery();

const all       = await discovery.discoverAll();
const epsonUsb  = await discovery.discoverEpsonUSB();
const network   = await discovery.discoverNetwork();
const bluetooth = await discovery.discoverBluetooth();

// [
//   { type: 'usb',       name: '/dev/bus/usb/001/002', vendorId: 0x04b8, productId: 0x0202 },
//   { type: 'bluetooth', name: 'TM-T20X',              address: 'AA:BB:CC:DD:EE:FF' },
//   { type: 'tcp',       name: '192.168.1.100',        address: '192.168.1.100' },
// ]
```

---

### Printer profiles

```typescript
import { PRINTER_PROFILES, ThermalPrinter } from 'siga-printer';

const printer = await ThermalPrinter.connect(config, {
  profile: PRINTER_PROFILES.EPSON_TM_T20X, // default
});

// Available: EPSON_TM_T20, EPSON_TM_T20II, EPSON_TM_T20X
//            EPSON_TM_T88, EPSON_TM_T82
//            GENERIC_58MM, GENERIC_80MM
```

---

### Boleto template

```typescript
import { ThermalPrinter, BoletoTemplate } from 'siga-printer';

const printer = await ThermalPrinter.connect({ type: 'usb' });

await BoletoTemplate.print(printer, {
  bank: { name: 'Example Bank', cnpj: '00.000.000/0001-00' },
  beneficiary: { name: 'Company XYZ', cnpj: '11.111.111/0001-11' },
  payer: { name: 'John Doe', document: '123.456.789-00', address: '...' },
  boleto: {
    nossoNumero:    '00012345',
    dueDate:        '08/10/2025',
    amount:         'R$ 1,250.00',
    barcode:        '34191090080000008214800082194207197960000125000',
    digitableLine:  '34191.09008 00000.082148 00082.194207 1 97960000125000',
  },
  instructions: ['Do not accept after due date.'],
});
```

---

## License

MIT

---
---

<a name="português"></a>
# Português

## Conexões suportadas

| Tipo         | Android | iOS  | Observação                               |
|--------------|---------|------|------------------------------------------|
| USB (OTG)    | ✅      | ❌   | Cabo OTG necessário                      |
| Serial       | ✅      | ❌   | Via adaptador USB-Serial (RS-232)        |
| Bluetooth    | ✅      | ✅   | Classic SPP (Android) / MFi (iOS)       |
| TCP/IP       | ✅      | ✅   | Porta 9100 (padrão Epson)               |

---

## Instalação

```sh
npm install siga-printer
# ou
yarn add siga-printer
```

### Expo (bare workflow / EAS Build)

> **Managed workflow não é suportado** — a lib tem módulos nativos.
> Use bare workflow (`expo prebuild`) ou Expo Dev Client.

Adicione o config plugin no `app.json`:

```json
{
  "expo": {
    "plugins": ["siga-printer"]
  }
}
```

Depois rode:

```sh
expo prebuild
# ou (EAS)
eas build
```

O plugin adiciona automaticamente todas as permissões Android e entradas do Info.plist iOS — sem configuração manual.

Adicione também ao `android/build.gradle`:
```gradle
allprojects {
  repositories {
    maven { url 'https://jitpack.io' }
  }
}
```

### React Native puro

Adicione ao `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- USB -->
<uses-feature android:name="android.hardware.usb.host" android:required="false" />

<!-- Bluetooth (Android 12+) -->
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
```

Adicione ao `android/build.gradle`:
```gradle
allprojects {
  repositories {
    maven { url 'https://jitpack.io' }
  }
}
```

### iOS

```sh
cd ios && pod install
```

Adicione ao `Info.plist` (para Bluetooth MFi):
```xml
<key>UISupportedExternalAccessoryProtocols</key>
<array>
  <string>com.epson.escpos</string>
</array>
```

---

## Uso básico

```typescript
import { ThermalPrinter } from 'siga-printer';

const printer = await ThermalPrinter.connect({
  type:      'usb',
  vendorId:  0x04b8,  // Epson
  productId: 0x0202,  // TM-T20X II
});

await printer
  .init()
  .text('Olá, mundo!', { bold: true, align: 'center', size: 2 })
  .divider()
  .qrCode('https://exemplo.com', { size: 6 })
  .cut()
  .print();

await printer.disconnect();
```

---

## API Completa

### `ThermalPrinter.connect(config, options?)`

Conecta a uma impressora e retorna um `ConnectedThermalPrinter`.

```typescript
const printer = await ThermalPrinter.connect(
  {
    type:      'usb',
    vendorId:  0x04b8,
    productId: 0x0202,
    timeout:   3000,
  },
  {
    profile:        PRINTER_PROFILES.EPSON_TM_T20X,
    charset:        'CP860',
    orientation:    'portrait',
    autoCut:        false,
    feedAfterPrint: 0,
  }
);
```

### `ThermalPrinter.create(options?)`

Cria um builder sem conectar (para gerar bytes e enviar por fora).

```typescript
const builder = ThermalPrinter.create({ charset: 'CP860' });
const bytes   = await builder.init().text('Teste').cut().build();
// bytes: Uint8Array
```

---

### Métodos de conteúdo (encadeáveis)

#### `.init()`
Inicializa a impressora (ESC @). **Sempre chame no início de cada job.**

#### `.text(content, options?)`

```typescript
printer.text('Texto normal')
printer.text('Negrito centralizado', { bold: true, align: 'center' })
printer.text('Grande', { size: 2 })
printer.text('Invertido', { invert: true })
printer.text('Sublinhado duplo', { underline: 'double' })
```

| Prop               | Tipo                            | Padrão   |
|--------------------|---------------------------------|----------|
| `bold`             | `boolean`                       | `false`  |
| `underline`        | `boolean \| 'double'`           | `false`  |
| `size`             | `1–8`                           | `1`      |
| `widthMultiplier`  | `1–8`                           | `1`      |
| `heightMultiplier` | `1–8`                           | `1`      |
| `align`            | `'left' \| 'center' \| 'right'` | `'left'` |
| `invert`           | `boolean`                       | `false`  |
| `charset`          | `CharsetEncoding`               | herdado  |

#### `.feed(lines?)` / `.feedDots(dots)`
Avança papel por linhas ou pontos.

#### `.divider(options?)`

```typescript
printer.divider()                    // ─────────────────────
printer.divider({ style: 'double' }) // =====================
printer.divider({ style: 'dashed' }) // ---------------------
printer.divider({ style: 'dotted' }) // .....................
printer.divider({ char: '*' })       // *********************
```

#### `.section(title, options?)`

Cabeçalho de seção com divisores automáticos:
```
─────────────────────────────────────────
         DADOS DO CLIENTE
─────────────────────────────────────────
```

#### `.row(cells)`

Layout de colunas. Widths devem somar 100:

```typescript
printer.row([
  { text: 'Produto',   width: 60, align: 'left'  },
  { text: 'Qtd',       width: 15, align: 'center' },
  { text: 'R$ 99,90', width: 25, align: 'right'  },
])
```

#### `.barcode(data, options?)`

```typescript
printer.barcode('34191090080000008214800082194207197960000125000', {
  type:        'ITF',
  height:      60,
  width:       2,
  hriPosition: 'below',
  align:       'center',
})
```

**Tipos suportados:** `CODE39`, `CODE93`, `CODE128`, `EAN8`, `EAN13`, `ITF` / `ITF25`, `CODABAR`, `UPC_A`, `UPC_E`

#### `.qrCode(data, options?)`

```typescript
printer.qrCode('https://exemplo.com.br', {
  size:       5,    // tamanho do módulo 1–16
  errorLevel: 'M',  // L | M | Q | H
  align:      'center',
})
```

#### `.image(options)`

```typescript
printer.image({ source: require('./assets/logo.png'), width: 200, align: 'center' })
printer.image({ source: 'data:image/png;base64,...', dither: 'floyd-steinberg' })
```

| Modo de dithering | Uso ideal                | Velocidade |
|-------------------|--------------------------|------------|
| `threshold`       | Logotipos monocromáticos | Rápido     |
| `floyd-steinberg` | Fotos e gradientes       | Médio      |
| `atkinson`        | Logotipos com meias-tintas| Médio     |
| `bayer`           | Balanceado               | Médio      |

#### `.cut(mode?, options?)`

```typescript
printer.cut()                     // corte completo + 3 linhas de feed
printer.cut('partial')            // corte parcial
printer.cut('full', { feed: 5 }) // feed customizado
```

#### `.cashDrawer(options?)`

```typescript
printer.cashDrawer()
printer.cashDrawer({ pin: 5, duration: 200 })
```

#### `.raw(bytes)`
Injeta bytes ESC/POS arbitrários para comandos não cobertos pela API.

---

### Orientação de impressão

```typescript
// Retrato (padrão)
const printer = await ThermalPrinter.connect(config, { orientation: 'portrait' });

// Paisagem — conteúdo rotacionado 90°, útil para códigos de barras largos
const printer = await ThermalPrinter.connect(config, { orientation: 'landscape' });

// Trocar durante o job
printer.setOrientation('landscape');
```

> **Nota TM-T20X II:** Este modelo não suporta o comando ESC V (rotação nativa).
> A orientação paisagem é implementada rasterizando o conteúdo como bitmap rotacionado 90°.
> O resultado é idêntico visualmente, porém requer um pouco mais de processamento.

---

### Gerenciamento de conexão

`printerManager` é um **singleton global** que mantém o estado da conexão entre componentes. Conecte uma vez, imprima de qualquer tela.

```typescript
import { printerManager, useConnectionManager, PrinterSelector } from 'siga-printer';

// ── Imperativo (fora de componentes) ──────────────────────────

await printerManager.connectDevice(device); // device vem do discoverAll()
await printerManager.connect({ type: 'usb' });
await printerManager.disconnect();
await printerManager.reconnect();

const unsub = printerManager.subscribe(state => {
  console.log(state.status);          // 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'disconnected'
  console.log(state.connectedDevice); // DiscoveredDevice | null
});
unsub();

printerManager.configure({
  autoReconnect:        true,
  maxReconnectAttempts: 3,
  reconnectDelay:       1000, // ms, dobra a cada tentativa
});
```

```typescript
// ── Hook reativo (dentro de componentes) ──────────────────────

import { useConnectionManager } from 'siga-printer';

function MinhaScreen() {
  const {
    status,
    connectedDevice,
    isConnected,
    error,
    connectDevice,
    connect,
    disconnect,
    reconnect,
  } = useConnectionManager();

  return <Text>{isConnected ? connectedDevice?.name : status}</Text>;
}
```

```tsx
// ── Componente pronto (UI completa) ───────────────────────────

import { PrinterSelector } from 'siga-printer';

function TelaConexao() {
  return (
    <PrinterSelector
      onConnect={(device) => console.log('Conectado a', device.name)}
      onError={(msg) => console.error(msg)}
      scanType="all"    // 'all' | 'usb' | 'bluetooth' | 'tcp'
      showStatus={true}
    />
  );
}
```

`PrinterSelector` inclui: busca por tipo, lista de dispositivos com ícones, botão conectar/desconectar por item, banner de status em tempo real.

---

### Preview de impressão

Renderize um preview realista em papel térmico — sem impressora. Útil para testar templates, construir editores e mostrar preview ao usuário antes de imprimir.

```tsx
import { PrintPreviewBuilder, PrintPreview } from 'siga-printer';

function MeuPreview() {
  const builder = new PrintPreviewBuilder({
    profile:     PRINTER_PROFILES.EPSON_TM_T20X,
    orientation: 'portrait',  // ou 'landscape'
  });

  builder
    .init()
    .text('CUPOM', { bold: true, align: 'center', size: 2 })
    .divider()
    .row([
      { text: 'Café',    width: 60 },
      { text: 'R$ 5,00', width: 40, align: 'right' },
    ])
    .divider()
    .qrCode('https://exemplo.com', { size: 4, align: 'center' })
    .cut();

  return (
    <PrintPreview
      builder={builder}
      showRuler={true}
      showMetrics={true}
      showCutMark={true}
    />
  );
}
```

Props do `PrintPreview`:

| Prop               | Tipo      | Padrão  | Descrição                              |
|--------------------|-----------|---------|----------------------------------------|
| `builder`          | `PrintPreviewBuilder` | obrigatório | Builder com conteúdo       |
| `showRuler`        | `boolean` | `true`  | Régua em mm no topo do papel           |
| `showMetrics`      | `boolean` | `true`  | Barra de métricas (comprimento, overflow)|
| `showCutMark`      | `boolean` | `true`  | Linha de corte com tesoura             |
| `highlightOverflow`| `boolean` | `true`  | Destaca elementos em overflow em vermelho|
| `scale`            | `number`  | auto    | Fator de escala da largura do papel    |
| `style`            | `ViewStyle`| —      | Override de estilo do ScrollView       |

**Preview paisagem:** com `orientation: 'landscape'`, o preview exibe uma tira de papel vertical com o conteúdo girado 90° — igual ao papel físico saindo da impressora.

---

### Designer de templates

Canvas drag-and-drop visual para criar templates de impressão. Gera código TypeScript tipado pronto para uso com `PrintPreviewBuilder`.

```tsx
import { TemplateDesigner } from 'siga-printer';

function TelaDesigner() {
  return (
    <TemplateDesigner
      onExport={(code, template) => {
        console.log('Código TypeScript gerado:', code);
        // cole no seu projeto
      }}
      onSave={(template) => {
        // salve o JSON do template no seu backend ou AsyncStorage
        salvarTemplate(template);
      }}
    />
  );
}
```

Props do `TemplateDesigner`:

| Prop               | Tipo                                                   | Descrição                         |
|--------------------|--------------------------------------------------------|-----------------------------------|
| `initialTemplate`  | `Partial<TemplateDefinition>`                          | Template pré-carregado            |
| `onExport`         | `(code: string, template: TemplateDefinition) => void` | Chamado ao tocar em Exportar      |
| `onSave`           | `(template: TemplateDefinition) => void`               | Chamado ao tocar em Salvar        |

Funcionalidades:
- Blocos arrastáveis em canvas de papel em escala real
- Snap em grade de 2mm
- Tipos de bloco: texto, código de barras, QR code, imagem, divisor, linha de colunas
- Painel de propriedades por bloco (alinhamento, fonte, tamanho, etc.)
- Painel de variáveis — defina placeholders dinâmicos (`{{nome_cliente}}`, etc.)
- Seletor de perfil de impressora e orientação
- Exportação para snippet TypeScript
- Celular retrato: layout em abas (Paleta / Canvas / Propriedades)
- Tablet / paisagem: layout em três colunas

---

### Descoberta de dispositivos

```typescript
import { PrinterDiscovery } from 'siga-printer';

const discovery = new PrinterDiscovery();

const todos      = await discovery.discoverAll();
const epsonUsb   = await discovery.discoverEpsonUSB();
const rede       = await discovery.discoverNetwork();
const bluetooth  = await discovery.discoverBluetooth();

// [
//   { type: 'usb',       name: '/dev/bus/usb/001/002', vendorId: 0x04b8, productId: 0x0202 },
//   { type: 'bluetooth', name: 'TM-T20X',              address: 'AA:BB:CC:DD:EE:FF' },
//   { type: 'tcp',       name: '192.168.1.100',        address: '192.168.1.100' },
// ]
```

---

### Perfis de impressora

```typescript
import { PRINTER_PROFILES, ThermalPrinter } from 'siga-printer';

const printer = await ThermalPrinter.connect(config, {
  profile: PRINTER_PROFILES.EPSON_TM_T20X, // padrão
});

// Disponíveis: EPSON_TM_T20, EPSON_TM_T20II, EPSON_TM_T20X
//              EPSON_TM_T88, EPSON_TM_T82
//              GENERIC_58MM, GENERIC_80MM
```

---

### Template de boleto

```typescript
import { ThermalPrinter, BoletoTemplate } from 'siga-printer';

const printer = await ThermalPrinter.connect({ type: 'usb' });

await BoletoTemplate.print(printer, {
  bank: { name: 'Banco Exemplo S.A.', cnpj: '00.000.000/0001-00' },
  beneficiary: { name: 'Empresa XYZ LTDA', cnpj: '11.111.111/0001-11' },
  payer: { name: 'João da Silva', document: '123.456.789-00', address: 'Rua Exemplo, 100' },
  boleto: {
    nossoNumero:   '00012345',
    dueDate:       '10/08/2025',
    amount:        'R$ 1.250,00',
    barcode:       '34191090080000008214800082194207197960000125000',
    digitableLine: '34191.09008 00000.082148 00082.194207 1 97960000125000',
  },
  instructions: ['Não receber após o vencimento.'],
});
```

---

## Licença

MIT
