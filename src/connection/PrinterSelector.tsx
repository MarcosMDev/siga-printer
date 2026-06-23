import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { StyleProp, ViewStyle, ListRenderItem } from 'react-native';
import { useDiscovery } from '../utils/hooks';
import { useConnectionManager } from '../utils/hooks';
import type { DiscoveredDevice, ConnectionType } from '../types';

// ─────────────────────────────────────────────────────────────
//  PrinterSelector
//
//  Ready-to-use component for discovering and connecting to
//  thermal printers. Uses the global printerManager singleton.
//
//  Usage:
//    <PrinterSelector
//      onConnect={(device) => console.log('Connected to', device.name)}
//    />
// ─────────────────────────────────────────────────────────────

export interface PrinterSelectorProps {
  onConnect?: (device: DiscoveredDevice) => void;
  onError?: (error: string) => void;
  /** Limit scan to one type, or 'all' (default) */
  scanType?: ConnectionType | 'all';
  style?: StyleProp<ViewStyle>;
  /** Show current connection status banner (default: true) */
  showStatus?: boolean;
}

const TYPE_ICON: Record<string, string> = {
  usb: '🔌',
  bluetooth: '📶',
  tcp: '🌐',
  serial: '⚡',
};

export function PrinterSelector({
  onConnect,
  onError,
  scanType = 'all',
  style,
  showStatus = true,
}: PrinterSelectorProps) {
  const discovery = useDiscovery();
  const manager = useConnectionManager();

  const handleScan = useCallback(() => {
    switch (scanType) {
      case 'usb':       return discovery.scanUSB();
      case 'bluetooth': return discovery.scanBT();
      case 'tcp':       return discovery.scanTCP();
      default:          return discovery.scan();
    }
  }, [scanType, discovery]);

  const handleConnect = useCallback(async (device: DiscoveredDevice) => {
    try {
      await manager.connectDevice(device);
      onConnect?.(device);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    }
  }, [manager, onConnect, onError]);

  const handleDisconnect = useCallback(async () => {
    await manager.disconnect();
  }, [manager]);

  const renderDevice: ListRenderItem<DiscoveredDevice> = ({ item }) => {
    const isActive =
      manager.isConnected &&
      manager.connectedDevice?.address === item.address &&
      manager.connectedDevice?.type === item.type;

    const isConnecting =
      (manager.status === 'connecting' || manager.status === 'reconnecting') &&
      manager.connectedDevice?.address === item.address;

    return (
      <View style={[styles.deviceRow, isActive && styles.deviceRowActive]}>
        <Text style={styles.deviceIcon}>{TYPE_ICON[item.type] ?? '🖨'}</Text>

        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName} numberOfLines={1}>
            {item.name || item.address}
          </Text>
          <Text style={styles.deviceAddress}>{item.address}</Text>
          {item.rssi !== undefined && (
            <Text style={styles.deviceMeta}>RSSI {item.rssi} dBm</Text>
          )}
        </View>

        {isActive ? (
          <TouchableOpacity
            style={[styles.btn, styles.btnDisconnect]}
            onPress={handleDisconnect}
          >
            <Text style={styles.btnTextDisconnect}>Desconectar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.btnConnect, isConnecting && styles.btnDisabled]}
            onPress={() => handleConnect(item)}
            disabled={isConnecting || manager.status === 'connecting'}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnTextConnect}>Conectar</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {showStatus && <StatusBanner manager={manager} />}

      <View style={styles.scanRow}>
        <Text style={styles.sectionTitle}>Impressoras disponíveis</Text>
        <TouchableOpacity
          style={[styles.btn, styles.btnScan, discovery.scanning && styles.btnDisabled]}
          onPress={handleScan}
          disabled={discovery.scanning}
        >
          {discovery.scanning ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.btnTextScan}>Buscar</Text>
          )}
        </TouchableOpacity>
      </View>

      {discovery.error && (
        <Text style={styles.errorText}>{discovery.error}</Text>
      )}

      {!discovery.scanning && discovery.devices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {discovery.error ? 'Erro ao buscar impressoras.' : 'Pressione Buscar para escanear.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={discovery.devices}
          keyExtractor={item => `${item.type}:${item.address}`}
          renderItem={renderDevice}
          style={styles.list}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

// ── Status Banner ─────────────────────────────────────────────

function StatusBanner({ manager }: { manager: ReturnType<typeof useConnectionManager> }) {
  const { status, connectedDevice, error } = manager;

  const config: Record<string, { label: string; color: string; bg: string }> = {
    idle:         { label: 'Desconectado',  color: '#666', bg: '#f5f5f5' },
    connecting:   { label: 'Conectando…',   color: '#FF9500', bg: '#FFF3E0' },
    connected:    { label: 'Conectado',     color: '#34C759', bg: '#E8F5E9' },
    reconnecting: { label: 'Reconectando…', color: '#FF9500', bg: '#FFF3E0' },
    error:        { label: 'Erro',          color: '#FF3B30', bg: '#FFEBEE' },
    disconnected: { label: 'Desconectado',  color: '#666', bg: '#f5f5f5' },
  };

  const { label, color, bg } = config[status] ?? config.idle;

  return (
    <View style={[styles.statusBanner, { backgroundColor: bg }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusLabel, { color }]}>{label}</Text>
      {status === 'connected' && connectedDevice && (
        <Text style={styles.statusDevice} numberOfLines={1}>
          {'— ' + (connectedDevice.name || connectedDevice.address)}
        </Text>
      )}
      {status === 'error' && error && (
        <Text style={styles.statusError} numberOfLines={1}>
          {' — ' + error}
        </Text>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusDevice: {
    fontSize: 13,
    color: '#34C759',
    flexShrink: 1,
  },
  statusError: {
    fontSize: 12,
    color: '#FF3B30',
    flexShrink: 1,
  },

  // Scan row
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1e',
  },

  // Device rows
  list: {},
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  deviceRowActive: {
    backgroundColor: '#F0FFF4',
  },
  deviceIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#888',
    marginTop: 1,
  },
  deviceMeta: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 1,
  },

  // Buttons
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    minHeight: 34,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnConnect: {
    backgroundColor: '#007AFF',
  },
  btnDisconnect: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  btnScan: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  btnTextConnect: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  btnTextDisconnect: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
  },
  btnTextScan: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },

  // Error
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
});
