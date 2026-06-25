import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { PrinterSelector, useConnectionManager, TemplateDesigner } from 'siga-printer';
import type { DiscoveredDevice } from 'siga-printer';
import { TemplatePreviewScreen } from './screens/TemplatePreviewScreen';

type Tab = 'connection' | 'templates' | 'designer';

export default function App() {
  const [tab, setTab] = useState<Tab>('connection');
  const { status, isConnected } = useConnectionManager();

  const handleConnect = (device: DiscoveredDevice) => {
    Alert.alert('Conectado!', `${device.name || device.address} (${device.type})`);
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>siga-printer</Text>
        <View style={styles.statusPill}>
          <View style={[styles.dot, { backgroundColor: isConnected ? '#4ade80' : '#666' }]} />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'connection' && styles.tabBtnActive]}
          onPress={() => setTab('connection')}
        >
          <Text style={[styles.tabBtnText, tab === 'connection' && styles.tabBtnTextActive]}>
            🔗 Conexão
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'templates' && styles.tabBtnActive]}
          onPress={() => setTab('templates')}
        >
          <Text style={[styles.tabBtnText, tab === 'templates' && styles.tabBtnTextActive]}>
            🧾 Templates
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'designer' && styles.tabBtnActive]}
          onPress={() => setTab('designer')}
        >
          <Text style={[styles.tabBtnText, tab === 'designer' && styles.tabBtnTextActive]}>
            🎨 Designer
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === 'connection' && (
        <PrinterSelector
          style={styles.selector}
          onConnect={handleConnect}
          onError={(msg) => Alert.alert('Erro', msg)}
          scanType="all"
          showStatus={true}
        />
      )}
      {tab === 'templates' && <TemplatePreviewScreen />}
      {tab === 'designer' && (
        <TemplateDesigner
          onExport={(code) => Alert.alert('Código gerado', code.slice(0, 200) + '…')}
          onSave={(tpl) => Alert.alert('Salvo', tpl.name)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#0f0f1a' },

  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#e0e0e0', fontSize: 18, fontWeight: '800' },
  statusPill:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e2e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 6 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  statusText:  { color: '#888', fontSize: 12 },

  tabBar:    { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1e1e2e', borderRadius: 10, padding: 4, gap: 4 },
  tabBtn:    { flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#3b2fc9' },
  tabBtnText:   { color: '#666', fontSize: 11, fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },

  selector:  { flex: 1, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
});
