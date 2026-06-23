/**
 * react-native-thermal-printer — Unit Tests
 */

import { ESCPOSEncoder } from '../src/encoder/encoder';
import { ThermalPrinter } from '../src/builder/ThermalPrinter';
import { DEFAULT_PROFILE } from '../src/utils/profiles';
import * as CMD from '../src/encoder/commands';

// ── ESCPOSEncoder ─────────────────────────────────────────────

describe('ESCPOSEncoder', () => {
  let enc: ESCPOSEncoder;

  beforeEach(() => {
    enc = new ESCPOSEncoder(DEFAULT_PROFILE, 'CP860', 'portrait');
  });

  test('init() returns ESC @ sequence', () => {
    const bytes = enc.init();
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40]);
  });

  test('text() ends with LF (0x0a)', () => {
    const bytes = enc.text('Hello');
    expect(bytes).toContain(0x0a);
  });

  test('text() with bold=true includes ESC E 1', () => {
    const bytes = enc.text('Bold', { bold: true });
    const idx = bytes.indexOf(0x45);
    expect(bytes[idx - 1]).toBe(0x1b); // ESC
    expect(bytes[idx + 1]).toBe(0x01); // on
  });

  test('text() with align center includes ESC a 1', () => {
    const bytes = enc.text('Center', { align: 'center' });
    expect(bytes).toEqual(expect.arrayContaining([0x1b, 0x61, 0x01]));
  });

  test('feed() produces ESC d n', () => {
    const bytes = enc.feed(3);
    expect(bytes).toEqual([0x1b, 0x64, 0x03]);
  });

  test('cut() with full mode produces GS V 0', () => {
    const bytes = enc.cut({ mode: 'full', feed: 0 });
    expect(bytes).toContain(0x00); // GS V 0
    expect(bytes).toContain(0x56);
    expect(bytes).toContain(0x1d);
  });

  test('cut() with partial mode produces GS V 1', () => {
    const bytes = enc.cut({ mode: 'partial', feed: 0 });
    expect(bytes).toContain(0x01);
  });

  test('qrCode() produces GS ( k sequence', () => {
    const bytes = enc.qrCode('https://test.com');
    // GS = 0x1d, ( = 0x28, k = 0x6b
    const hasGSPK = bytes.some((b, i) =>
      b === 0x1d && bytes[i+1] === 0x28 && bytes[i+2] === 0x6b
    );
    expect(hasGSPK).toBe(true);
  });

  test('barcode() produces GS k sequence', () => {
    const bytes = enc.barcode('1234567890128', { type: 'EAN13' });
    const hasGSk = bytes.some((b, i) => b === 0x1d && bytes[i+1] === 0x6b);
    expect(hasGSk).toBe(true);
  });

  test('table() produces a line with LF', () => {
    const bytes = enc.table({
      cells: [
        { text: 'Item', width: 60, align: 'left'  },
        { text: 'R$ 9,90', width: 40, align: 'right' },
      ],
    });
    expect(bytes).toContain(0x0a);
  });

  test('divider() fills full line width', () => {
    const bytes = enc.divider({ style: 'line', char: '-' });
    // Should contain 42 dashes (DEFAULT_PROFILE.charsPerLine)
    const dashCount = bytes.filter(b => b === 0x2d).length;
    expect(dashCount).toBe(DEFAULT_PROFILE.charsPerLine);
  });
});

// ── CMD helpers ───────────────────────────────────────────────

describe('CMD.charSize', () => {
  test('normal size is 0x00', () => {
    expect(CMD.charSize(1, 1)).toEqual([0x1d, 0x21, 0x00]);
  });

  test('double width/height is 0x11', () => {
    // width=2 → (2-1)<<4 = 0x10, height=2 → (2-1) = 0x01 → 0x11
    expect(CMD.charSize(2, 2)).toEqual([0x1d, 0x21, 0x11]);
  });

  test('width×2 height×1 is 0x10', () => {
    expect(CMD.charSize(2, 1)).toEqual([0x1d, 0x21, 0x10]);
  });
});

describe('CMD.barcodeCommand', () => {
  test('EAN13 type = 67', () => {
    const bytes = CMD.barcodeCommand('EAN13', '7891234567890');
    expect(bytes[2]).toBe(67);
  });

  test('ITF type = 70', () => {
    const bytes = CMD.barcodeCommand('ITF', '1234567890');
    expect(bytes[2]).toBe(70);
  });

  test('throws on unknown type', () => {
    expect(() => CMD.barcodeCommand('UNKNOWN', '123')).toThrow();
  });

  test('length byte is correct', () => {
    const data = '1234567890';
    const bytes = CMD.barcodeCommand('CODE128', data);
    expect(bytes[3]).toBe(data.length);
  });
});

describe('CMD.qrStore', () => {
  test('pL + pH encode data length + 3 correctly', () => {
    const data = 'https://test.com'; // 16 chars
    const bytes = CMD.qrStore(data);
    // Length field = data.length + 3 = 19
    // pL = 19 & 0xff = 19, pH = 0
    expect(bytes[3]).toBe(19);
    expect(bytes[4]).toBe(0);
  });
});

// ── ThermalPrinter builder ────────────────────────────────────

describe('ThermalPrinter.create()', () => {
  test('build() returns Uint8Array', async () => {
    const result = await ThermalPrinter.create()
      .init()
      .text('Hello')
      .feed(2)
      .cut()
      .build();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(10);
  });

  test('build() with multiple texts concatenates correctly', async () => {
    const result = await ThermalPrinter.create()
      .init()
      .text('Line 1')
      .text('Line 2')
      .text('Line 3')
      .build();
    // Should have 3 LF bytes (one per text line)
    const lfCount = Array.from(result).filter(b => b === 0x0a).length;
    expect(lfCount).toBeGreaterThanOrEqual(3);
  });

  test('reset() clears steps', async () => {
    const builder = ThermalPrinter.create()
      .init()
      .text('Something');

    builder.reset();

    const result = await builder.build();
    expect(result.length).toBe(0);
  });

  test('raw() injects bytes directly', async () => {
    const magic = [0xDE, 0xAD, 0xBE, 0xEF];
    const result = await ThermalPrinter.create().raw(magic).build();
    expect(Array.from(result)).toEqual(magic);
  });

  test('setOrientation() changes orientation', () => {
    const p = ThermalPrinter.create({ orientation: 'portrait' });
    p.setOrientation('landscape');
    // Orientation is internal — we just verify it doesn't throw
    expect(() => p.setOrientation('portrait')).not.toThrow();
  });

  test('autoCut option appends cut bytes', async () => {
    const result = await ThermalPrinter.create({ autoCut: true })
      .init()
      .text('Test')
      .build();
    // GS V 0 = [0x1d, 0x56, 0x00]
    const bytes = Array.from(result);
    const hasCut = bytes.some((b, i) =>
      b === 0x1d && bytes[i+1] === 0x56
    );
    expect(hasCut).toBe(true);
  });
});
