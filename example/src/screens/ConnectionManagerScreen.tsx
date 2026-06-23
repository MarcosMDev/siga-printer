import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import {
  PrinterSelector,
  useConnectionManager,
  printerManager,
} from 'siga-printer';
import type { DiscoveredDevice } from 'siga-printer';

export function ConnectionManagerScreen() {
  const { status, connectedDevice, isConnected, error, reconnect } =
    useConnectionManager();

  const handleConnect = (device: DiscoveredDevice) => {
    Alert.alert(
      'Conectado!',
      `${device.name || device.address} (${device.type})`,
    );
  };

  const handleError = (msg: string) => {
    Alert.alert('Erro de conexão', msg);
  };

  const handleTestPrint = async () => {
    if (!isConnected) {
      Alert.alert('Sem conexão', 'Conecte uma impressora primeiro.');
      return;
    }
    try {
      // Access native printer through manager internals isn't exposed here,
      // so we just confirm the connection state is real.
      const state = printerManager.getState();
      Alert.alert(
        'Estado da conexão',
        `Status: ${state.status}\nDispositivo: ${state.connectedDevice?.name ?? state.connectedDevice?.address ?? '—'}\nTipo: ${state.connectedDevice?.type ?? '—'}`,
      );
    } catch (e) {
      Alert.alert('Erro', String(e));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Connection Manager</Text>
      <Text style={styles.subtitle}>
        Singleton global — estado persiste entre telas
      </Text>

      {/* State debug */}
      <View style={styles.stateBox}>
        <Text style={styles.stateLabel}>Status:</Text>
        <Text style={[styles.stateValue, statusColor(status)]}>{status}</Text>

        <Text style={styles.stateLabel}>Dispositivo:</Text>
        <Text style={styles.stateValue}>
          {connectedDevice
            ? `${connectedDevice.name || connectedDevice.address} (${connectedDevice.type})`
            : '—'}
        </Text>

        {error && (
          <>
            <Text style={styles.stateLabel}>Erro:</Text>
            <Text style={[styles.stateValue, { color: '#f87171' }]}>{error}</Text>
          </>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, !isConnected && styles.btnDisabled]}
          onPress={handleTestPrint}
          disabled={!isConnected}
        >
          <Text style={styles.btnText}>Verificar estado</Text>
        </TouchableOpacity>

        {status === 'error' || status === 'disconnected' ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => reconnect().catch(e => Alert.alert('Erro', String(e)))}
          >
            <Text style={styles.btnText}>Reconectar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* PrinterSelector component */}
      <Text style={styles.sectionTitle}>PrinterSelector</Text>
      <PrinterSelector
        style={styles.selector}
        onConnect={handleConnect}
        onError={handleError}
        scanType="all"
        showStatus={true}
      />
    </ScrollView>
  );
}

function statusColor(status: string) {
  switch (status) {
    case 'connected':    return { color: '#4ade80' };
    case 'connecting':
    case 'reconnecting': return { color: '#fbbf24' };
    case 'error':        return { color: '#f87171' };
    default:             return { color: '#94a3b8' };
  }
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f0f1a' },
  content:      { padding: 16, paddingBottom: 40 },
  title:        { color: '#e0e0e0', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle:     { color: '#666', fontSize: 13, marginBottom: 20 },

  stateBox: {
    backgroundColor: '#1e1e2e',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  stateLabel:   { color: '#666', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginTop: 6 },
  stateValue:   { color: '#e0e0e0', fontSize: 14, fontWeight: '500' },

  actions:      { flexDirection: 'row', gap: 10, marginBottom: 24 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimary:   { backgroundColor: '#3b2fc9' },
  btnSecondary: { backgroundColor: '#7c3aed' },
  btnDisabled:  { opacity: 0.4 },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 14 },

  sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  selector:     { borderRadius: 12, overflow: 'hidden' },
});
