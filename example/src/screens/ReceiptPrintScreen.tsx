import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { ReceiptTemplate } from 'react-native-thermal-printer';
import type { ReceiptData } from 'react-native-thermal-printer';
import { globalPrinter, globalOrientation } from './HomeScreen';

// Sample receipt data
const SAMPLE: ReceiptData = {
  company: {
    name:    'Loja Exemplo',
    cnpj:    '11.222.333/0001-44',
    address: 'Rua das Flores, 100 — São Paulo/SP',
    phone:   '(11) 9999-8888',
  },
  order: {
    number:   '000456',
    date:     new Date().toLocaleString('pt-BR'),
    operator: 'Maria',
    terminal: '01',
  },
  customer: {
    name:     'João da Silva',
    document: '123.456.789-00',
  },
  items: [
    { name: 'Produto A — Descrição longa',  quantity: 2, unitPrice: 'R$ 49,90', totalPrice: 'R$ 99,80'  },
    { name: 'Produto B',                    quantity: 1, unitPrice: 'R$ 89,90', totalPrice: 'R$ 89,90'  },
    { name: 'Produto C com nome bem longo', quantity: 3, unitPrice: 'R$ 15,00', totalPrice: 'R$ 45,00'  },
    { name: 'Produto D',                    quantity: 1, unitPrice: 'R$ 199,90', totalPrice: 'R$ 199,90' },
  ],
  totals: {
    subtotal: 'R$ 434,60',
    discount: 'R$ 34,60',
    total:    'R$ 400,00',
  },
  payments: [
    { method: 'Crédito', amount: 'R$ 400,00', installments: 2, cardLast4: '4321' },
  ],
  footer: {
    message: 'Obrigado pela sua compra!',
    website: 'www.lojaexemplo.com.br',
    qrUrl:   'https://lojaexemplo.com.br/nota/000456',
  },
};

export function ReceiptPrintScreen() {
  const [printing, setPrinting] = useState(false);

  const printSample = async () => {
    if (!globalPrinter) {
      Alert.alert('Não conectado', 'Conecte a impressora na tela principal.');
      return;
    }
    setPrinting(true);
    try {
      globalPrinter.setOrientation(globalOrientation);
      await ReceiptTemplate.print(globalPrinter, SAMPLE);
      Alert.alert('✓ Recibo impresso com sucesso!');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.title}>Recibo de exemplo</Text>
      <Text style={styles.subtitle}>
        Toca em "Imprimir" para enviar o recibo de exemplo à impressora conectada.
      </Text>

      {/* Preview */}
      <View style={styles.preview}>
        <Text style={styles.previewTitle}>LOJA EXEMPLO</Text>
        <Text style={styles.previewSub}>CNPJ: 11.222.333/0001-44</Text>
        <Text style={styles.previewDiv}>─────────────────────────</Text>
        {SAMPLE.items.map((item, i) => (
          <View key={i} style={styles.previewRow}>
            <Text style={styles.previewItem} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.previewPrice}>{item.totalPrice}</Text>
          </View>
        ))}
        <Text style={styles.previewDiv}>─────────────────────────</Text>
        <View style={styles.previewRow}>
          <Text style={[styles.previewItem, styles.bold]}>TOTAL</Text>
          <Text style={[styles.previewPrice, styles.bold]}>{SAMPLE.totals.total}</Text>
        </View>
        <Text style={styles.previewDiv}>─────────────────────────</Text>
        <Text style={styles.previewSub}>Obrigado pela sua compra!</Text>
      </View>

      <TouchableOpacity
        style={[styles.printBtn, printing && styles.disabled]}
        onPress={printSample}
        disabled={printing}
      >
        {printing
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.printBtnText}>🖨 Imprimir Recibo</Text>
        }
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f0f1a' },
  content:      { padding: 20, paddingBottom: 40 },
  title:        { color: '#e0e0e0', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle:     { color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 20 },
  preview:      { backgroundColor: '#1e1e2e', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#2e2e3e' },
  previewTitle: { color: '#e0e0e0', fontWeight: '700', textAlign: 'center', marginBottom: 2, fontFamily: 'monospace' },
  previewSub:   { color: '#888', fontSize: 11, textAlign: 'center', fontFamily: 'monospace' },
  previewDiv:   { color: '#555', fontSize: 11, textAlign: 'center', marginVertical: 8, fontFamily: 'monospace' },
  previewRow:   { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  previewItem:  { color: '#ccc', fontSize: 12, flex: 1, fontFamily: 'monospace' },
  previewPrice: { color: '#ccc', fontSize: 12, fontFamily: 'monospace' },
  bold:         { fontWeight: '700', color: '#e0e0e0' },
  printBtn:     { backgroundColor: '#1a7a3a', borderRadius: 12, padding: 16, alignItems: 'center' },
  disabled:     { opacity: 0.6 },
  printBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
