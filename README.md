# siga-printer

Biblioteca completa para impressão em impressoras térmicas ESC/POS via React Native.
Suporte total a Epson TM-T20X II e compatíveis.

## Conexões suportadas

| Tipo         | Android | iOS  | Observação                          |
|--------------|---------|------|-------------------------------------|
| USB (OTG)    | ✅      | ❌   | Hardware da impressora conectado via OTG |
| Serial       | ✅      | ❌   | Via adaptador USB-Serial (RS-232)  |
| Bluetooth    | ✅      | ✅   | Classic SPP (Android) / MFi (iOS) |
| TCP/IP       | ✅      | ✅   | Porta 9100 (padrão Epson)          |

---

## Instalação

```sh
npm install siga-printer
# ou
yarn add siga-printer
```

### Android

Adicione ao `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- USB -->
<uses-feature android:name="android.hardware.usb.host" android:required="false" />

<!-- Bluetooth (Android 12+) -->
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
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

// Conectar
const printer = await ThermalPrinter.connect({
  type: 'usb',
  vendorId:  0x04b8,  // Epson
  productId: 0x0202,  // TM-T20X II
});

// Montar e imprimir
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
  // Config de conexão
  {
    type: 'usb',
    vendorId:  0x04b8,
    productId: 0x0202,
    timeout:   3000,
  },
  // Opções do builder (opcional)
  {
    profile:       PRINTER_PROFILES.EPSON_TM_T20X,
    charset:       'CP860',   // PT-BR
    orientation:   'portrait',
    autoCut:       false,
    feedAfterPrint: 0,
  }
);
```

### `ThermalPrinter.create(options?)`

Cria um builder sem conectar (para gerar bytes e enviar por fora).

```typescript
const builder = ThermalPrinter.create({ charset: 'CP860' });
const bytes   = await builder.init().text('Teste').cut().build();
// bytes: Uint8Array — envie por onde quiser
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
printer.text('Largura dupla apenas', { widthMultiplier: 2, heightMultiplier: 1 })
printer.text('Invertido', { invert: true })
printer.text('Sublinhado duplo', { underline: 'double' })
```

**TextOptions:**
| Prop               | Tipo                           | Padrão   |
|--------------------|--------------------------------|----------|
| `bold`             | `boolean`                      | `false`  |
| `underline`        | `boolean \| 'double'`          | `false`  |
| `size`             | `1–8`                          | `1`      |
| `widthMultiplier`  | `1–8`                          | `1`      |
| `heightMultiplier` | `1–8`                          | `1`      |
| `align`            | `'left' \| 'center' \| 'right'`| `'left'` |
| `invert`           | `boolean`                      | `false`  |
| `charset`          | `CharsetEncoding`              | herdado  |

#### `.feed(lines?)`
Avança `n` linhas (padrão: 1).

#### `.feedDots(dots)`
Avança `n` pontos (controle preciso de espaçamento).

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
         DADOS DO BENEFICIÁRIO
─────────────────────────────────────────
```

```typescript
printer.section('Dados do Cliente')
printer.section('TOTAL', { bold: true, dividerChar: '=' })
```

#### `.row(cells, divider?)`

Layout de colunas. Widths devem somar 100:

```typescript
printer.row([
  { text: 'Produto',    width: 60, align: 'left'  },
  { text: 'Qtd',        width: 15, align: 'center' },
  { text: 'R$ 99,90',  width: 25, align: 'right'  },
])
```

#### `.barcode(data, options?)`

```typescript
// Boleto bancário (ITF-25)
printer.barcode('34191090080000008214800082194207197960000125000', {
  type:        'ITF',
  height:      60,
  width:       2,
  hriPosition: 'below',
  align:       'center',
})

// EAN-13
printer.barcode('7891234567890', { type: 'EAN13', height: 50 })

// CODE128
printer.barcode('ABC-123', { type: 'CODE128' })
```

**Tipos suportados:** `CODE39`, `CODE93`, `CODE128`, `EAN8`, `EAN13`, `ITF` / `ITF25`, `CODABAR`, `UPC_A`, `UPC_E`

#### `.qrCode(data, options?)`

```typescript
printer.qrCode('https://exemplo.com.br', {
  size:       5,        // Tamanho do módulo (1–16)
  errorLevel: 'M',     // L | M | Q | H
  align:      'center',
})

// Pix QR Code
printer.qrCode(pixPayload, { size: 6, errorLevel: 'M' })
```

#### `.image(options)`

```typescript
// Asset local
printer.image({ source: require('./assets/logo.png'), width: 200, align: 'center' })

// URI
printer.image({ source: 'file:///storage/emulated/0/logo.png', width: 300 })

// Base64
printer.image({ source: 'data:image/png;base64,...', dither: 'floyd-steinberg' })

// URL remota
printer.image({ source: 'https://exemplo.com/logo.png', width: 200 })
```

**Modos de dithering:**
| Modo              | Uso ideal               | Velocidade |
|-------------------|-------------------------|------------|
| `threshold`       | Logotipos monocromáticos | Rápido    |
| `floyd-steinberg` | Fotos e gradientes       | Médio     |
| `atkinson`        | Logotipos com meias-tintas| Médio    |
| `bayer`           | Balanceado               | Médio     |

#### `.cut(mode?, options?)`

```typescript
printer.cut()                     // corte completo + 3 linhas de feed
printer.cut('partial')            // corte parcial
printer.cut('full', { feed: 5 }) // feed customizado
```

#### `.cashDrawer(options?)`

```typescript
printer.cashDrawer()                         // pin 2, 100ms
printer.cashDrawer({ pin: 5, duration: 200 })
```

#### `.raw(bytes)`

Injeta bytes ESC/POS arbitrários para comandos não cobertos:

```typescript
printer.raw([0x1b, 0x40]) // ESC @ manual
```

---

### Orientação de impressão

```typescript
// Retrato (padrão)
const printer = await ThermalPrinter.connect(config, {
  orientation: 'portrait',
});

// Paisagem — conteúdo rotacionado 90°
const printer = await ThermalPrinter.connect(config, {
  orientation: 'landscape',
});

// Trocar durante o job
printer.setOrientation('landscape');
```

> **Nota TM-T20X II:** Este modelo não suporta o comando ESC V (rotação nativa).
> A orientação paisagem é implementada rasterizando o conteúdo como bitmap rotacionado 90°.
> O resultado é idêntico visualmente, porém requer um pouco mais de processamento.

---

### Template de boleto

```typescript
import { ThermalPrinter, BoletoTemplate } from 'siga-printer';

const printer = await ThermalPrinter.connect({ type: 'usb' });

await BoletoTemplate.print(printer, {
  bank: {
    name:        'Banco Exemplo S.A.',
    cnpj:        '00.000.000/0001-00',
    logoSource:  require('./assets/bank-logo.png'),
  },
  beneficiary: {
    name: 'Empresa XYZ LTDA',
    cnpj: '11.111.111/0001-11',
  },
  payer: {
    name:     'João da Silva',
    document: '123.456.789-00',
    address:  'Rua Exemplo, 100 - São Paulo/SP',
  },
  boleto: {
    nossoNumero:   '00012345',
    dueDate:       '10/08/2025',
    amount:        'R$ 1.250,00',
    barcode:       '34191090080000008214800082194207197960000125000',
    digitableLine: '34191.09008 00000.082148 00082.194207 1 97960000125000',
    pixKey:        '00020126...', // payload PIX completo (optional)
    documentNumber: 'DOC-001',
    processingDate: new Date().toLocaleDateString('pt-BR'),
  },
  instructions: [
    'Não receber após o vencimento.',
    'Multa de 2% ao mês após vencimento.',
    'Juros de 0,033% ao dia.',
  ],
});
```

---

### Descoberta de dispositivos

```typescript
import { PrinterDiscovery } from 'siga-printer';

const discovery = new PrinterDiscovery();

// Todos os tipos simultaneamente
const all = await discovery.discoverAll();

// Só impressoras Epson USB
const epson = await discovery.discoverEpsonUSB();

// Rede local (porta 9100)
const network = await discovery.discoverNetwork();

// Bluetooth pareado
const bt = await discovery.discoverBluetooth();

console.log(all);
// [
//   { type: 'usb', name: '/dev/bus/usb/001/002', vendorId: 0x04b8, productId: 0x0202 },
//   { type: 'bluetooth', name: 'TM-T20X', address: 'AA:BB:CC:DD:EE:FF' },
//   { type: 'tcp', name: '192.168.1.100', address: '192.168.1.100' },
// ]
```

---

### Perfis de impressora

```typescript
import { PRINTER_PROFILES, ThermalPrinter } from 'siga-printer';

const printer = await ThermalPrinter.connect(config, {
  profile: PRINTER_PROFILES.EPSON_TM_T20X, // padrão
});

// Perfis disponíveis:
// EPSON_TM_T20, EPSON_TM_T20II, EPSON_TM_T20X (padrão)
// EPSON_TM_T88, EPSON_TM_T82
// GENERIC_58MM, GENERIC_80MM
```

---

## Dependências nativas

### Android

A lib já inclui no `build.gradle`:

```
com.github.mik3y:usb-serial-for-android:3.4.6  (Serial USB)
```

Adicione ao `android/build.gradle` do seu app:
```gradle
allprojects {
  repositories {
    maven { url 'https://jitpack.io' }
  }
}
```

### iOS

No `Podfile`:
```ruby
pod 'siga-printer', :path => '../node_modules/siga-printer'
```

---

## Licença

MIT
