import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Switch, Alert, ActivityIndicator,
} from 'react-native';
import { BoletoTemplate } from 'siga-printer';
import type { BoletoData } from 'siga-printer';
import { globalPrinter, globalOrientation } from './HomeScreen';

export function BoletoPrintScreen() {
  const [printing, setPrinting] = useState(false);
  const [printQR,  setPrintQR ] = useState(true);

  // Form state — pre-filled with realistic boleto data for quick testing
  const [form, setForm] = useState<BoletoData>({
    bank: {
      name: 'Banco do Brasil S.A.',
      cnpj: '00.000.000/0001-91',
    },
    beneficiary: {
      name: 'Empresa Exemplo LTDA',
      cnpj: '11.222.333/0001-81',
      address: 'Av. Paulista, 1000 — São Paulo/SP',
    },
    payer: {
      name: 'João da Silva',
      document: '123.456.789-00',
      address: 'Rua das Flores, 50 — São Paulo/SP',
    },
    boleto: {
      nossoNumero:    '00012345',
      dueDate:        '30/08/2025',
      amount:         'R$ 1.250,00',
      barcode:        '00190000090010248002700440003000000027630000125000',
      digitableLine:  '00190.00009 00102.480027 00440.003000 0 02763000012500',
      pixKey:         '00020126580014BR.GOV.BCB.PIX0136a4f17111-5b96-4cbc-b1b5-3e1d2c3a4f5b5204000053039865406125.005802BR5913Empresa Teste6009SAO PAULO62070503***6304E2CA',
      documentNumber: 'DOC-2025-001',
      processingDate: new Date().toLocaleDateString('pt-BR'),
    },
    instructions: [
      'Não receber após o vencimento.',
      'Multa de 2% ao mês após o vencimento.',
      'Juros de 0,033% ao dia.',
    ],
    printQR: true,
  });

  const update = (path: string, value: string) => {
    const parts = path.split('.');
    setForm(prev => {
      const next = { ...prev } as any;
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = { ...obj[parts[i]] };
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const print = async () => {
    if (!globalPrinter) {
      Alert.alert('Não conectado', 'Conecte a impressora na tela principal.');
      return;
    }

    setPrinting(true);
    try {
      globalPrinter.setOrientation(globalOrientation);
      await BoletoTemplate.print(globalPrinter, { ...form, printQR });
      Alert.alert('✓ Boleto impresso com sucesso!');
    } catch (e: any) {
      Alert.alert('Erro na impressão', e.message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Section title="Banco">
        <Field label="Nome do banco"   value={form.bank.name}   onChange={v => update('bank.name', v)} />
        <Field label="CNPJ"            value={form.bank.cnpj!}  onChange={v => update('bank.cnpj', v)} />
      </Section>

      <Section title="Beneficiário">
        <Field label="Nome"    value={form.beneficiary.name}    onChange={v => update('beneficiary.name', v)} />
        <Field label="CNPJ"    value={form.beneficiary.cnpj!}   onChange={v => update('beneficiary.cnpj', v)} />
        <Field label="Endereço" value={form.beneficiary.address!} onChange={v => update('beneficiary.address', v)} />
      </Section>

      <Section title="Pagador">
        <Field label="Nome"      value={form.payer.name}        onChange={v => update('payer.name', v)} />
        <Field label="Documento" value={form.payer.document!}   onChange={v => update('payer.document', v)} />
        <Field label="Endereço"  value={form.payer.address!}    onChange={v => update('payer.address', v)} />
      </Section>

      <Section title="Dados do boleto">
        <Field label="Nosso Número"   value={form.boleto.nossoNumero}   onChange={v => update('boleto.nossoNumero', v)} />
        <Field label="Vencimento"     value={form.boleto.dueDate}       onChange={v => update('boleto.dueDate', v)} />
        <Field label="Valor"          value={form.boleto.amount}        onChange={v => update('boleto.amount', v)} />
        <Field label="Nº Documento"   value={form.boleto.documentNumber!} onChange={v => update('boleto.documentNumber', v)} />
        <Field
          label="Código de barras (ITF)"
          value={form.boleto.barcode}
          onChange={v => update('boleto.barcode', v)}
          mono
        />
        <Field
          label="Linha digitável"
          value={form.boleto.digitableLine}
          onChange={v => update('boleto.digitableLine', v)}
          mono
        />
        <Field
          label="Payload Pix (para QR Code)"
          value={form.boleto.pixKey!}
          onChange={v => update('boleto.pixKey', v)}
          multiline
          mono
        />
      </Section>

      <Section title="Opções">
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Imprimir QR Code Pix</Text>
          <Switch
            value={printQR}
            onValueChange={setPrintQR}
            trackColor={{ false: '#333', true: '#3b2fc9' }}
            thumbColor="#fff"
          />
        </View>
      </Section>

      <TouchableOpacity
        style={[styles.printBtn, printing && styles.printBtnDisabled]}
        onPress={print}
        disabled={printing}
      >
        {printing
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.printBtnText}>🖨 Imprimir Boleto</Text>
        }
      </TouchableOpacity>

    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface FieldProps {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  multiline?:  boolean;
  mono?:       boolean;
}

function Field({ label, value, onChange, multiline, mono }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          mono && styles.inputMono,
        ]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholderTextColor="#555"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#0f0f1a' },
  content:         { padding: 16, paddingBottom: 40 },
  section:         { marginBottom: 20 },
  sectionTitle:    { color: '#7c6ef0', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  field:           { marginBottom: 10 },
  fieldLabel:      { color: '#a0a0b0', fontSize: 12, marginBottom: 4 },
  input:           { backgroundColor: '#1e1e2e', color: '#e0e0e0', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#2e2e3e', fontSize: 14 },
  inputMultiline:  { minHeight: 80, textAlignVertical: 'top' },
  inputMono:       { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 },
  switchRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e1e2e', borderRadius: 8, padding: 12 },
  switchLabel:     { color: '#e0e0e0', fontSize: 14 },
  printBtn:        { backgroundColor: '#1a7a3a', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  printBtnDisabled:{ opacity: 0.6 },
  printBtnText:    { color: '#fff', fontWeight: '700', fontSize: 17 },
});

const Platform = require('react-native').Platform;
