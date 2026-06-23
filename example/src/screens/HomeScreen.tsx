import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Platform, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ThermalPrinter, PRINTER_PROFILES } from 'siga-printer';
import type {
  ConnectedThermalPrinter,
  ConnectionConfig,
  PrintOrientation,
} from 'siga-printer';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// Shared printer state (simple module-level singleton for the example)
// In a real app, use Context or a state manager.
export let globalPrinter: ConnectedThermalPrinter | null = null;
export let globalOrientation: PrintOrientation = 'portrait';

type ConnectionType = 'usb' | 'bluetooth' | 'tcp' | 'serial';

export function HomeScreen({ navigation }: Props) {
  const [connType,     setConnType    ] = useState<ConnectionType>('usb');
  const [tcpHost,      setTcpHost     ] = useState('192.168.1.100');
  const [tcpPort,      setTcpPort     ] = useState('9100');
  const [btAddress,    setBtAddress   ] = useState('');
  const [orientation,  setOrientation ] = useState<PrintOrientation>('portrait');
  const [connecting,   setConnecting  ] = useState(false);
  const [connected,    setConnected   ] = useState(false);
  const [statusMsg,    setStatusMsg   ] = useState('Não conectado');

  const connect = async () => {
    setConnecting(true);
    setStatusMsg('Conectando...');

    let config: ConnectionConfig;

    switch (connType) {
      case 'usb':
        config = { type: 'usb', vendorId: 0x04b8, productId: 0x0202 };
        break;
      case 'tcp':
        config = { type: 'tcp', host: tcpHost, port: parseInt(tcpPort, 10) };
        break;
      case 'bluetooth':
        config = { type: 'bluetooth', address: btAddress };
        break;
      case 'serial':
        config = { type: 'serial', path: '/dev/ttyUSB0', baudRate: 115200 };
        break;
    }

    try {
      globalPrinter    = await ThermalPrinter.connect(config, {
        profile:     PRINTER_PROFILES.EPSON_TM_T20X,
        charset:     'CP860',
        orientation,
      });
      globalOrientation = orientation;
      setConnected(true);
      setStatusMsg(`Conectado via ${connType.toUpperCase()}`);
    } catch (e: any) {
      setStatusMsg(`Erro: ${e.message}`);
      Alert.alert('Erro de conexão', e.message);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    await globalPrinter?.disconnect();
    globalPrinter = null;
    setConnected(false);
    setStatusMsg('Desconectado');
  };

  const testPrint = async () => {
    if (!globalPrinter) return;
    try {
      await globalPrinter
        .init()
        .text('siga-printer', { bold: true, size: 2, align: 'center' })
        .text('Teste de impressão', { align: 'center' })
        .feed(1)
        .divider()
        .text('Texto normal')
        .text('Negrito', { bold: true })
        .text('Grande x2', { size: 2 })
        .text('Invertido', { invert: true, align: 'center' })
        .divider()
        .qrCode('https://github.com', { size: 5, align: 'center' })
        .feed(1)
        .barcode('1234567890128', { type: 'EAN13', hriPosition: 'below', align: 'center' })
        .feed(2)
        .cut()
        .print();
      Alert.alert('✓ Sucesso', 'Impressão enviada!');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Status */}
      <View style={[styles.statusBar, connected ? styles.statusOk : styles.statusOff]}>
        <View style={[styles.statusDot, { backgroundColor: connected ? '#4ade80' : '#f87171' }]} />
        <Text style={styles.statusText}>{statusMsg}</Text>
      </View>

      {/* Connection type selector */}
      <Text style={styles.label}>Tipo de conexão</Text>
      <View style={styles.tabRow}>
        {(['usb', 'tcp', 'bluetooth', 'serial'] as ConnectionType[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, connType === t && styles.tabActive]}
            onPress={() => setConnType(t)}
          >
            <Text style={[styles.tabText, connType === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TCP config */}
      {connType === 'tcp' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Host / IP</Text>
          <TextInput
            style={styles.input}
            value={tcpHost}
            onChangeText={setTcpHost}
            placeholder="192.168.1.100"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
          <Text style={styles.label}>Porta</Text>
          <TextInput
            style={styles.input}
            value={tcpPort}
            onChangeText={setTcpPort}
            placeholder="9100"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>
      )}

      {/* Bluetooth config */}
      {connType === 'bluetooth' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Endereço MAC</Text>
          <TextInput
            style={styles.input}
            value={btAddress}
            onChangeText={setBtAddress}
            placeholder="AA:BB:CC:DD:EE:FF"
            placeholderTextColor="#666"
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => navigation.navigate('Discovery')}
          >
            <Text style={styles.btnSecondaryText}>🔍 Descobrir dispositivos</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* USB — auto-detect */}
      {connType === 'usb' && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Epson TM-T20X II será detectada automaticamente.{'\n'}
            VendorId: 0x04B8 • ProductId: 0x0202{'\n'}
            Conecte via cabo USB OTG.
          </Text>
        </View>
      )}

      {/* Orientation */}
      <Text style={styles.label}>Orientação de impressão</Text>
      <View style={styles.tabRow}>
        {(['portrait', 'landscape'] as PrintOrientation[]).map(o => (
          <TouchableOpacity
            key={o}
            style={[styles.tab, orientation === o && styles.tabActive]}
            onPress={() => setOrientation(o)}
          >
            <Text style={[styles.tabText, orientation === o && styles.tabTextActive]}>
              {o === 'portrait' ? '↕ Retrato' : '↔ Paisagem'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Connect / Disconnect */}
      {!connected ? (
        <TouchableOpacity
          style={[styles.btnPrimary, connecting && styles.btnDisabled]}
          onPress={connect}
          disabled={connecting}
        >
          <Text style={styles.btnPrimaryText}>
            {connecting ? 'Conectando...' : 'Conectar'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btnPrimary, styles.flex1]} onPress={testPrint}>
            <Text style={styles.btnPrimaryText}>🖨 Teste</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnDanger, styles.flex1]} onPress={disconnect}>
            <Text style={styles.btnPrimaryText}>Desconectar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Navigation */}
      <Text style={styles.sectionTitle}>Conexão</Text>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate('ConnectionManager')}
      >
        <Text style={styles.navItemText}>🔗 Connection Manager</Text>
        <Text style={styles.navChevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate('Discovery')}
      >
        <Text style={styles.navItemText}>🔍 Descobrir impressoras</Text>
        <Text style={styles.navChevron}>›</Text>
      </TouchableOpacity>

      {connected && (
        <>
          <Text style={styles.sectionTitle}>Imprimir</Text>
          {[
            { label: '📄 Boleto bancário',    screen: 'BoletoPrint'  as const },
            { label: '🧾 Recibo / Cupom',      screen: 'ReceiptPrint' as const },
            { label: '⚙️  Avançado / Raw ESC',  screen: 'Advanced'    as const },
          ].map(item => (
            <TouchableOpacity
              key={item.screen}
              style={styles.navItem}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Text style={styles.navItemText}>{item.label}</Text>
              <Text style={styles.navChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f0f1a' },
  content:      { padding: 16, paddingBottom: 40 },
  statusBar:    { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 20 },
  statusOk:     { backgroundColor: '#0d2f1f' },
  statusOff:    { backgroundColor: '#2a1a1a' },
  statusDot:    { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusText:   { color: '#e0e0e0', fontSize: 14 },
  label:        { color: '#a0a0b0', fontSize: 13, marginBottom: 6, marginTop: 16 },
  tabRow:       { flexDirection: 'row', gap: 8 },
  tab:          { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  tabActive:    { backgroundColor: '#3b2fc9', borderColor: '#5b4fe9' },
  tabText:      { color: '#888', fontSize: 12, fontWeight: '600' },
  tabTextActive:{ color: '#fff' },
  inputGroup:   { gap: 4 },
  input:        { backgroundColor: '#1e1e2e', color: '#e0e0e0', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#333', marginBottom: 4 },
  infoBox:      { backgroundColor: '#1e1e2e', borderRadius: 8, padding: 12, marginTop: 8 },
  infoText:     { color: '#888', fontSize: 12, lineHeight: 18 },
  btnPrimary:   { backgroundColor: '#3b2fc9', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  btnSecondary: { borderWidth: 1, borderColor: '#3b2fc9', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  btnSecondaryText: { color: '#7c6ef0', fontWeight: '600' },
  btnDanger:    { backgroundColor: '#7f1d1d', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  btnDisabled:  { opacity: 0.5 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  row:          { flexDirection: 'row', gap: 10 },
  flex1:        { flex: 1 },
  sectionTitle: { color: '#e0e0e0', fontSize: 17, fontWeight: '700', marginTop: 28, marginBottom: 8 },
  navItem:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e2e', borderRadius: 10, padding: 16, marginBottom: 8 },
  navItemText:  { color: '#e0e0e0', fontSize: 15, flex: 1 },
  navChevron:   { color: '#555', fontSize: 22 },
});
