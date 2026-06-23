import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import {
  ThermalPrinter,
  PRINTER_PROFILES,
} from 'siga-printer';
import type { ImageDitherMode, PrintOrientation } from 'siga-printer';
import { globalPrinter, globalOrientation } from './HomeScreen';

export function AdvancedScreen() {
  const [loading, setLoading] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (!globalPrinter) {
      Alert.alert('Não conectado', 'Conecte a impressora na tela principal.');
      return;
    }
    setLoading(key);
    try {
      await fn();
      Alert.alert('✓ Enviado!');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(null);
    }
  };

  // ── Test: all text sizes ──────────────────────────────────
  const testTextSizes = () => run('text', async () => {
    globalPrinter!.setOrientation(globalOrientation);
    await globalPrinter!
      .init()
      .section('Tamanhos de texto')
      .text('Size 1 — normal',    { size: 1 })
      .text('Size 2 — double',    { size: 2 })
      .text('Size 3 — triple',    { size: 3 })
      .text('Size 4 — quadruple', { size: 4 })
      .divider()
      .text('W×2 H×1', { widthMultiplier: 2, heightMultiplier: 1 })
      .text('W×1 H×2', { widthMultiplier: 1, heightMultiplier: 2 })
      .divider()
      .text('Bold + sublinhado',  { bold: true, underline: true })
      .text('Duplo sublinhado',   { underline: 'double' })
      .text('Invertido',          { invert: true, align: 'center' })
      .text('Alinhado à direita', { align: 'right' })
      .feed(2).cut()
      .print();
  });

  // ── Test: all barcode types ───────────────────────────────
  const testBarcodes = () => run('barcode', async () => {
    await globalPrinter!
      .init()
      .section('Códigos de barras')
      .text('EAN-13', { bold: true })
      .barcode('7891234567890', { type: 'EAN13', height: 50, hriPosition: 'below', align: 'center' })
      .feed(1)
      .text('CODE-128', { bold: true })
      .barcode('EXAMPLE-128', { type: 'CODE128', height: 50, hriPosition: 'below', align: 'center' })
      .feed(1)
      .text('ITF-25 (Boleto)', { bold: true })
      .barcode('00190000090010248002700440003000', { type: 'ITF', height: 60, hriPosition: 'none', align: 'center' })
      .feed(1)
      .text('CODE-39', { bold: true })
      .barcode('CODE39TEST', { type: 'CODE39', height: 50, hriPosition: 'below', align: 'center' })
      .feed(2).cut()
      .print();
  });

  // ── Test: QR Code sizes ───────────────────────────────────
  const testQRCodes = () => run('qr', async () => {
    await globalPrinter!
      .init()
      .section('QR Codes')
      .text('Tamanho 3', { bold: true, align: 'center' })
      .qrCode('https://exemplo.com', { size: 3, align: 'center' })
      .feed(1)
      .text('Tamanho 5', { bold: true, align: 'center' })
      .qrCode('https://exemplo.com', { size: 5, align: 'center' })
      .feed(1)
      .text('Tamanho 8 — Error Level H', { bold: true, align: 'center' })
      .qrCode('https://exemplo.com/recibo/123456', { size: 8, errorLevel: 'H', align: 'center' })
      .feed(2).cut()
      .print();
  });

  // ── Test: dithering modes ─────────────────────────────────
  const testDithering = () => run('dither', async () => {
    const modes: ImageDitherMode[] = ['threshold', 'floyd-steinberg', 'atkinson', 'bayer'];

    let printer = globalPrinter!.init().section('Modos de Dithering');

    for (const mode of modes) {
      printer = printer
        .text(mode, { bold: true, align: 'center' })
        .image({
          // Using a test image — in prod use an actual URI
          source: require('../../assets/test-image.png'),
          width:  300,
          align:  'center',
          dither: mode,
        })
        .feed(1);
    }

    await printer.feed(2).cut().print();
  });

  // ── Test: landscape ───────────────────────────────────────
  const testLandscape = () => run('landscape', async () => {
    const p = await ThermalPrinter.connect(
      { type: 'usb' },
      { orientation: 'landscape', profile: PRINTER_PROFILES.EPSON_TM_T20X }
    );
    await p
      .init()
      .text('IMPRESSÃO EM PAISAGEM', { bold: true, size: 2, align: 'center' })
      .divider()
      .text('Este texto está rotacionado 90°')
      .text('na impressora TM-T20X II')
      .text('via rasterização de bitmap.')
      .feed(1)
      .barcode('7891234567890', { type: 'EAN13', align: 'center' })
      .feed(2).cut()
      .print();
  });

  // ── Test: table layout ────────────────────────────────────
  const testTable = () => run('table', async () => {
    const items = [
      ['Notebook Dell i7',         '1', 'R$ 3.599,00'],
      ['Mouse sem fio',            '2', 'R$    89,90'],
      ['Teclado mecânico',         '1', 'R$   349,00'],
      ['Monitor 24" Full HD',      '2', 'R$ 1.198,00'],
      ['Cabo HDMI 2m',             '3', 'R$    74,97'],
    ];

    let printer = globalPrinter!
      .init()
      .section('Layout de tabela')
      .row([
        { text: 'PRODUTO',    width: 55, align: 'left',   bold: true },
        { text: 'QTD',        width: 15, align: 'center', bold: true },
        { text: 'TOTAL',      width: 30, align: 'right',  bold: true },
      ])
      .divider({ style: 'dashed' });

    for (const [name, qty, price] of items) {
      printer = printer.row([
        { text: name,  width: 55, align: 'left'   },
        { text: qty,   width: 15, align: 'center' },
        { text: price, width: 30, align: 'right'  },
      ]);
    }

    await printer
      .divider()
      .row([
        { text: 'TOTAL GERAL', width: 70, align: 'left',  bold: true },
        { text: 'R$ 5.310,87', width: 30, align: 'right', bold: true },
      ])
      .feed(2).cut()
      .print();
  });

  // ── Test: raw ESC/POS ─────────────────────────────────────
  const testRaw = () => run('raw', async () => {
    await globalPrinter!
      .init()
      .text('Antes do raw command')
      // ESC a 1 = center align (via raw)
      .raw([0x1b, 0x61, 0x01])
      .raw([0x1b, 0x45, 0x01]) // ESC E 1 = bold on
      .text('Texto via raw bytes')
      .raw([0x1b, 0x45, 0x00]) // ESC E 0 = bold off
      .raw([0x1b, 0x61, 0x00]) // ESC a 0 = left align
      .text('Depois do raw command')
      .feed(2).cut()
      .print();
  });

  const tests: Array<{ key: string; label: string; onPress: () => void }> = [
    { key: 'text',      label: '🔤 Tamanhos e estilos de texto', onPress: testTextSizes  },
    { key: 'barcode',   label: '▦ Tipos de código de barras',    onPress: testBarcodes  },
    { key: 'qr',        label: '⬛ QR Code (tamanhos)',          onPress: testQRCodes   },
    { key: 'table',     label: '📊 Layout de tabela / colunas',  onPress: testTable     },
    { key: 'dither',    label: '🖼 Modos de dithering',          onPress: testDithering },
    { key: 'landscape', label: '↔ Impressão paisagem',           onPress: testLandscape },
    { key: 'raw',       label: '⚡ Raw ESC/POS bytes',           onPress: testRaw       },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Testes avançados</Text>
      <Text style={styles.subtitle}>
        Cada botão envia um job de teste diretamente para a impressora conectada.
      </Text>
      {tests.map(t => (
        <TouchableOpacity
          key={t.key}
          style={[styles.btn, loading === t.key && styles.btnActive]}
          onPress={t.onPress}
          disabled={!!loading}
        >
          {loading === t.key
            ? <ActivityIndicator color="#fff" size="small" style={styles.btnIcon} />
            : null
          }
          <Text style={styles.btnText}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0f0f1a' },
  content:    { padding: 16, paddingBottom: 40 },
  title:      { color: '#e0e0e0', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle:   { color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 20 },
  btn:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e2e', borderRadius: 10, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#2e2e3e' },
  btnActive:  { borderColor: '#7c6ef0' },
  btnIcon:    { marginRight: 10 },
  btnText:    { color: '#e0e0e0', fontSize: 15 },
});
