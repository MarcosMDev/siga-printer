import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { useDiscovery } from 'react-native-thermal-printer';
import type { DiscoveredDevice } from 'react-native-thermal-printer';

type Props = NativeStackScreenProps<RootStackParamList, 'Discovery'>;

const TYPE_ICON: Record<string, string> = {
  usb:       '🔌',
  bluetooth: '📶',
  tcp:       '🌐',
  serial:    '⚡',
};

export function DiscoveryScreen({ navigation }: Props) {
  const { devices, scanning, error, scan, clear } = useDiscovery();

  useEffect(() => { scan(); }, []);

  const renderDevice = ({ item }: { item: DiscoveredDevice }) => (
    <TouchableOpacity
      style={styles.deviceCard}
      onPress={() => {
        Alert.alert(
          'Usar impressora?',
          `${item.name}\n${item.address}`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Conectar', onPress: () => navigation.goBack() },
          ]
        );
      }}
    >
      <Text style={styles.deviceIcon}>{TYPE_ICON[item.type] ?? '🖨'}</Text>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceAddress}>{item.address}</Text>
        {item.vendorId && (
          <Text style={styles.deviceMeta}>
            VID: {`0x${item.vendorId.toString(16).toUpperCase().padStart(4, '0')}`}
            {' '}PID: {`0x${item.productId?.toString(16).toUpperCase().padStart(4, '0')}`}
          </Text>
        )}
        {item.rssi && <Text style={styles.deviceMeta}>RSSI: {item.rssi} dBm</Text>}
      </View>
      <Text style={styles.deviceType}>{item.type.toUpperCase()}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.scanBtn, scanning && styles.btnDisabled]}
          onPress={() => { clear(); scan(); }}
          disabled={scanning}
        >
          {scanning
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.scanBtnText}>🔍 Buscar novamente</Text>
          }
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {scanning && devices.length === 0 && (
        <View style={styles.emptyState}>
          <ActivityIndicator color="#7c6ef0" size="large" />
          <Text style={styles.emptyText}>Procurando impressoras...</Text>
          <Text style={styles.emptySubText}>USB, Bluetooth e rede local</Text>
        </View>
      )}

      {!scanning && devices.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🖨</Text>
          <Text style={styles.emptyText}>Nenhuma impressora encontrada</Text>
          <Text style={styles.emptySubText}>
            Verifique se a impressora está ligada e conectada
          </Text>
        </View>
      )}

      <FlatList
        data={devices}
        keyExtractor={d => `${d.type}-${d.address}`}
        renderItem={renderDevice}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f0f1a' },
  toolbar:      { padding: 16 },
  scanBtn:      { backgroundColor: '#3b2fc9', borderRadius: 10, padding: 13, alignItems: 'center' },
  scanBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled:  { opacity: 0.6 },
  errorBox:     { margin: 16, backgroundColor: '#2a0a0a', borderRadius: 8, padding: 12 },
  errorText:    { color: '#f87171', fontSize: 13 },
  emptyState:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyText:    { color: '#e0e0e0', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubText: { color: '#666', fontSize: 13, marginTop: 6, textAlign: 'center' },
  list:         { padding: 16, paddingTop: 0 },
  deviceCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e2e', borderRadius: 10, padding: 14, marginBottom: 8 },
  deviceIcon:   { fontSize: 26, marginRight: 12 },
  deviceInfo:   { flex: 1 },
  deviceName:   { color: '#e0e0e0', fontSize: 15, fontWeight: '600' },
  deviceAddress:{ color: '#888', fontSize: 12, marginTop: 2 },
  deviceMeta:   { color: '#555', fontSize: 11, marginTop: 2 },
  deviceType:   { color: '#7c6ef0', fontSize: 11, fontWeight: '700' },
});
