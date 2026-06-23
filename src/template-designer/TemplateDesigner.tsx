import React, {
  useState, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  PanResponder, Animated, StyleSheet,
  useWindowDimensions, Modal, Alert,
  Platform, Clipboard,
} from 'react-native';

import {
  BLOCK_META,
  createDefaultBlock,
  estimateBlockHeightMm,
  generateTypeScriptCode,
  mmToPx, pxToMm, snapToGrid,
} from './types';
import type {
  DesignerBlock,
  DesignerBlockType,
  TemplateDefinition,
  BlockGeometry,
} from './types';

import { BlockPropertiesPanel } from './BlockPropertiesPanel';
import { PaperCanvas }          from './PaperCanvas';
import { VariablesPanel }       from './VariablesPanel';
import { PRINTER_PROFILES }     from '../utils/profiles';
import type { PrinterModel, PrintOrientation } from '../types';

// ─────────────────────────────────────────────────────────────
//  TemplateDesigner
//
//  Full drag-and-drop template editor for React Native.
//
//  Layout (phone landscape / tablet):
//  ┌─────────────┬──────────────────────────┬─────────────┐
//  │  Block      │   Paper Canvas           │  Properties │
//  │  Palette    │   (drag & drop here)     │  Panel      │
//  └─────────────┴──────────────────────────┴─────────────┘
//
//  Phone portrait: three tabs — Palette | Canvas | Properties
// ─────────────────────────────────────────────────────────────

export interface TemplateDesignerProps {
  /** Initial template to load (optional) */
  initialTemplate?: Partial<TemplateDefinition>;
  /** Called when user exports the template as TypeScript */
  onExport?: (code: string, template: TemplateDefinition) => void;
  /** Called when user saves the template JSON */
  onSave?: (template: TemplateDefinition) => void;
}

const DEFAULT_PAPER_WIDTH: 80 = 80;
const DEFAULT_CANVAS_HEIGHT   = 200; // mm
const GRID_MM                 = 2;
const MM_SCALE_PHONE          = 3.2;  // px per mm on phone canvas
const MM_SCALE_TABLET         = 4.5;

export function TemplateDesigner({
  initialTemplate,
  onExport,
  onSave,
}: TemplateDesignerProps) {
  const { width, height } = useWindowDimensions();
  const isWide = width > 700;

  // ── Template state ─────────────────────────────────────────
  const [name,        setName       ] = useState(initialTemplate?.name        ?? 'Boleto Landscape');
  const [description, setDescription] = useState(initialTemplate?.description ?? '');
  const [orientation, setOrientation] = useState<PrintOrientation>(initialTemplate?.orientation ?? 'landscape');
  const [printerModel,setPrinterModel] = useState<PrinterModel>(initialTemplate?.printerModel  ?? 'EPSON_TM_T20X');
  const [canvasHeight,setCanvasHeight] = useState(initialTemplate?.canvasHeight ?? DEFAULT_CANVAS_HEIGHT);
  const [blocks,      setBlocks     ] = useState<DesignerBlock[]>(initialTemplate?.blocks ?? []);
  const [variables,   setVariables  ] = useState(initialTemplate?.variables   ?? []);

  // ── UI state ───────────────────────────────────────────────
  const [selectedId,  setSelectedId ] = useState<string | null>(null);
  const [activeTab,   setActiveTab  ] = useState<'palette' | 'canvas' | 'props'>('canvas');
  const [showExport,  setShowExport ] = useState(false);
  const [showSettings,setShowSettings] = useState(false);
  const [showVars,    setShowVars   ] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid,    setShowGrid   ] = useState(true);
  const [generatedCode, setGeneratedCode] = useState('');

  const paperWidth = PRINTER_PROFILES[printerModel]?.paperWidth ?? DEFAULT_PAPER_WIDTH;
  const mmScale    = isWide ? MM_SCALE_TABLET : MM_SCALE_PHONE;

  // ── Derived ────────────────────────────────────────────────
  const selectedBlock = useMemo(
    () => blocks.find(b => b.id === selectedId) ?? null,
    [blocks, selectedId],
  );

  // ── Block operations ───────────────────────────────────────

  const addBlock = useCallback((type: DesignerBlockType) => {
    // Find a free Y position below existing blocks
    const maxY = blocks.reduce((m, b) => Math.max(m, b.geometry.y + b.geometry.h), 4);
    const block = createDefaultBlock(type, 2, maxY + 2, paperWidth);
    setBlocks(prev => [...prev, block]);
    setSelectedId(block.id);
    if (!isWide) setActiveTab('canvas');
  }, [blocks, paperWidth, isWide]);

  const updateBlock = useCallback((id: string, patch: Partial<DesignerBlock>) => {
    setBlocks(prev => prev.map(b =>
      b.id === id ? { ...b, ...patch } as DesignerBlock : b,
    ));
  }, []);

  const updateGeometry = useCallback((id: string, geom: Partial<BlockGeometry>) => {
    setBlocks(prev => prev.map(b =>
      b.id === id ? { ...b, geometry: { ...b.geometry, ...geom } } : b,
    ));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setSelectedId(null);
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    const src = blocks.find(b => b.id === id);
    if (!src) return;
    const copy: DesignerBlock = {
      ...src,
      id: Math.random().toString(36).slice(2, 9),
      geometry: { ...src.geometry, y: src.geometry.y + src.geometry.h + 2 },
    };
    setBlocks(prev => [...prev, copy]);
    setSelectedId(copy.id);
  }, [blocks]);

  const bringForward = useCallback((id: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const sendBackward = useCallback((id: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return next;
    });
  }, []);

  // ── Export ─────────────────────────────────────────────────

  const handleExport = () => {
    const template = buildTemplate();
    const code     = generateTypeScriptCode(template);
    setGeneratedCode(code);
    setShowExport(true);
    onExport?.(code, template);
  };

  const handleSave = () => {
    const template = buildTemplate();
    onSave?.(template);
    Alert.alert('✓ Salvo', 'Template salvo com sucesso.');
  };

  const buildTemplate = (): TemplateDefinition => ({
    id:          initialTemplate?.id ?? Math.random().toString(36).slice(2, 9),
    name,
    description,
    orientation,
    printerModel,
    paperWidth:  paperWidth as 58 | 80,
    canvasHeight,
    blocks,
    variables,
    createdAt:   initialTemplate?.createdAt ?? new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    version:     '1.0.0',
  });

  // ── Render helpers ─────────────────────────────────────────

  const palette = (
    <BlockPalette onAdd={addBlock} />
  );

  const canvas = (
    <PaperCanvas
      blocks={blocks}
      selectedId={selectedId}
      paperWidth={paperWidth}
      canvasHeightMm={canvasHeight}
      mmScale={mmScale}
      orientation={orientation}
      showGrid={showGrid}
      snapEnabled={snapEnabled}
      gridMm={GRID_MM}
      onSelectBlock={setSelectedId}
      onUpdateGeometry={updateGeometry}
      onAddBlock={addBlock}
    />
  );

  const props = selectedBlock ? (
    <BlockPropertiesPanel
      block={selectedBlock}
      variables={variables}
      onChange={data => updateBlock(selectedBlock.id, { data })}
      onGeometryChange={geom => updateGeometry(selectedBlock.id, geom)}
      onDuplicate={() => duplicateBlock(selectedBlock.id)}
      onDelete={() => deleteBlock(selectedBlock.id)}
      onBringForward={() => bringForward(selectedBlock.id)}
      onSendBackward={() => sendBackward(selectedBlock.id)}
      onToggleLock={() => updateBlock(selectedBlock.id, { locked: !selectedBlock.locked })}
    />
  ) : (
    <NoSelectionPanel
      blockCount={blocks.length}
      onShowSettings={() => setShowSettings(true)}
      onShowVars={() => setShowVars(true)}
    />
  );

  return (
    <View style={styles.root}>
      {/* Top toolbar */}
      <DesignerToolbar
        name={name}
        orientation={orientation}
        snapEnabled={snapEnabled}
        showGrid={showGrid}
        onToggleSnap={() => setSnapEnabled(v => !v)}
        onToggleGrid={() => setShowGrid(v => !v)}
        onSettings={() => setShowSettings(true)}
        onExport={handleExport}
        onSave={handleSave}
        onOrientationToggle={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
      />

      {isWide ? (
        // ── Tablet / wide: three columns ──────────────────────
        <View style={styles.threeCol}>
          <View style={styles.colPalette}>{palette}</View>
          <View style={styles.colCanvas}>{canvas}</View>
          <View style={styles.colProps}>{props}</View>
        </View>
      ) : (
        // ── Phone: tab navigation ──────────────────────────────
        <>
          <View style={styles.tabBar}>
            {(['palette', 'canvas', 'props'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'palette' ? '🧩 Blocos'
                   : tab === 'canvas' ? `📐 Canvas${blocks.length > 0 ? ` (${blocks.length})` : ''}`
                   : selectedBlock ? `⚙ ${BLOCK_META[selectedBlock.data.type].label}` : '⚙ Props'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.tabContent}>
            {activeTab === 'palette' && palette}
            {activeTab === 'canvas'  && canvas}
            {activeTab === 'props'   && props}
          </View>
        </>
      )}

      {/* Export modal */}
      <ExportModal
        visible={showExport}
        code={generatedCode}
        templateName={name}
        onClose={() => setShowExport(false)}
      />

      {/* Settings modal */}
      <SettingsModal
        visible={showSettings}
        name={name}
        description={description}
        orientation={orientation}
        printerModel={printerModel}
        canvasHeight={canvasHeight}
        onChangeName={setName}
        onChangeDescription={setDescription}
        onChangeOrientation={setOrientation}
        onChangePrinterModel={setPrinterModel}
        onChangeCanvasHeight={setCanvasHeight}
        onClose={() => setShowSettings(false)}
      />

      {/* Variables modal */}
      <VariablesPanel
        visible={showVars}
        variables={variables}
        onChange={setVariables}
        onClose={() => setShowVars(false)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Toolbar
// ─────────────────────────────────────────────────────────────

function DesignerToolbar({
  name, orientation, snapEnabled, showGrid,
  onToggleSnap, onToggleGrid, onSettings,
  onExport, onSave, onOrientationToggle,
}: {
  name:               string;
  orientation:        PrintOrientation;
  snapEnabled:        boolean;
  showGrid:           boolean;
  onToggleSnap:       () => void;
  onToggleGrid:       () => void;
  onSettings:         () => void;
  onExport:           () => void;
  onSave:             () => void;
  onOrientationToggle:() => void;
}) {
  return (
    <View style={styles.toolbar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarScroll}>
        <View style={styles.toolbarInner}>
          <Text style={styles.toolbarTitle} numberOfLines={1}>{name}</Text>

          <ToolbarBtn
            label={orientation === 'portrait' ? '↕ Retrato' : '↔ Paisagem'}
            active={false}
            onPress={onOrientationToggle}
            color="#0ea5e9"
          />
          <ToolbarBtn label="⊞ Grid"  active={showGrid}    onPress={onToggleGrid}  />
          <ToolbarBtn label="⊡ Snap"  active={snapEnabled} onPress={onToggleSnap}  />
          <ToolbarBtn label="⚙"       active={false}       onPress={onSettings}    />
          <ToolbarBtn label="💾 Salvar" active={false}      onPress={onSave} color="#10b981" />
          <ToolbarBtn label="⬆ Exportar TS" active={false} onPress={onExport} color="#7c6ef0" />
        </View>
      </ScrollView>
    </View>
  );
}

function ToolbarBtn({ label, active, onPress, color }: {
  label: string; active: boolean; onPress: () => void; color?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.toolbarBtn, active && styles.toolbarBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.toolbarBtnText, active && styles.toolbarBtnTextActive, color ? { color } : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
//  Block Palette
// ─────────────────────────────────────────────────────────────

function BlockPalette({ onAdd }: { onAdd: (type: DesignerBlockType) => void }) {
  return (
    <ScrollView style={styles.palette} contentContainerStyle={styles.paletteContent}>
      <Text style={styles.paletteTitle}>Blocos</Text>
      <Text style={styles.paletteSub}>Toque para adicionar ao canvas</Text>
      {(Object.entries(BLOCK_META) as [DesignerBlockType, any][]).map(([type, meta]) => (
        <TouchableOpacity
          key={type}
          style={styles.paletteItem}
          onPress={() => onAdd(type)}
          activeOpacity={0.7}
        >
          <View style={[styles.paletteIcon, { borderColor: meta.color }]}>
            <Text style={styles.paletteIconText}>{meta.icon}</Text>
          </View>
          <View style={styles.paletteInfo}>
            <Text style={styles.paletteLabel}>{meta.label}</Text>
            <Text style={styles.paletteDesc}>{BLOCK_DESCRIPTIONS[type]}</Text>
          </View>
          <Text style={styles.paletteAdd}>+</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const BLOCK_DESCRIPTIONS: Record<DesignerBlockType, string> = {
  text:    'Texto livre, bold, size',
  barcode: 'CODE128, ITF, EAN...',
  qrcode:  'QR Code / Pix',
  image:   'Logo, assinatura...',
  divider: 'Linha separadora',
  row:     'Colunas lado a lado',
  box:     'Caixa com borda',
  spacer:  'Espaço em branco',
};

// ─────────────────────────────────────────────────────────────
//  No-selection hint panel
// ─────────────────────────────────────────────────────────────

function NoSelectionPanel({
  blockCount, onShowSettings, onShowVars,
}: { blockCount: number; onShowSettings: () => void; onShowVars: () => void }) {
  return (
    <ScrollView style={styles.noSelect} contentContainerStyle={styles.noSelectContent}>
      <Text style={styles.noSelectIcon}>📐</Text>
      <Text style={styles.noSelectTitle}>
        {blockCount === 0 ? 'Canvas vazio' : 'Selecione um bloco'}
      </Text>
      <Text style={styles.noSelectSub}>
        {blockCount === 0
          ? 'Adicione blocos pela aba "Blocos" ou toque + no canvas'
          : 'Toque em um bloco no canvas para editar suas propriedades'}
      </Text>
      <TouchableOpacity style={styles.noSelectBtn} onPress={onShowSettings}>
        <Text style={styles.noSelectBtnText}>⚙ Configurações do template</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.noSelectBtn} onPress={onShowVars}>
        <Text style={styles.noSelectBtnText}>🔗 Variáveis dinâmicas</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
//  Export Modal
// ─────────────────────────────────────────────────────────────

function ExportModal({
  visible, code, templateName, onClose,
}: { visible: boolean; code: string; templateName: string; onClose: () => void }) {
  const copyToClipboard = () => {
    Clipboard.setString(code);
    Alert.alert('✓ Copiado!', 'Código copiado para a área de transferência.');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.exportModal}>
        <View style={styles.exportHeader}>
          <Text style={styles.exportTitle}>TypeScript gerado</Text>
          <Text style={styles.exportSubtitle}>{templateName}Template.ts</Text>
          <View style={styles.exportHeaderBtns}>
            <TouchableOpacity style={styles.exportCopyBtn} onPress={copyToClipboard}>
              <Text style={styles.exportCopyBtnText}>📋 Copiar tudo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportCloseBtn} onPress={onClose}>
              <Text style={styles.exportCloseBtnText}>✕ Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.exportScroll} horizontal={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <Text style={styles.exportCode} selectable>{code}</Text>
          </ScrollView>
        </ScrollView>

        <View style={styles.exportFooter}>
          <Text style={styles.exportFooterText}>
            💡 Cole este arquivo em{' '}
            <Text style={styles.exportFooterPath}>src/templates/{templateName}Template.ts</Text>
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
//  Settings Modal
// ─────────────────────────────────────────────────────────────

import { TextInput } from 'react-native';

function SettingsModal({
  visible, name, description, orientation, printerModel, canvasHeight,
  onChangeName, onChangeDescription, onChangeOrientation,
  onChangePrinterModel, onChangeCanvasHeight, onClose,
}: any) {
  const models: PrinterModel[] = ['EPSON_TM_T20X', 'EPSON_TM_T88', 'GENERIC_58MM', 'GENERIC_80MM'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.settingsModal}>
          <Text style={styles.settingsTitle}>Configurações do template</Text>

          <Text style={styles.settingsLabel}>Nome</Text>
          <TextInput
            style={styles.settingsInput}
            value={name}
            onChangeText={onChangeName}
            placeholderTextColor="#555"
          />

          <Text style={styles.settingsLabel}>Descrição</Text>
          <TextInput
            style={styles.settingsInput}
            value={description}
            onChangeText={onChangeDescription}
            placeholderTextColor="#555"
          />

          <Text style={styles.settingsLabel}>Modelo de impressora</Text>
          <View style={styles.settingsSegment}>
            {models.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.settingsSegItem, printerModel === m && styles.settingsSegItemActive]}
                onPress={() => onChangePrinterModel(m)}
              >
                <Text style={[styles.settingsSegText, printerModel === m && styles.settingsSegTextActive]}>
                  {m.replace('EPSON_', '').replace('GENERIC_', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.settingsLabel}>Orientação</Text>
          <View style={styles.settingsSegment}>
            {(['portrait', 'landscape'] as PrintOrientation[]).map(o => (
              <TouchableOpacity
                key={o}
                style={[styles.settingsSegItem, orientation === o && styles.settingsSegItemActive]}
                onPress={() => onChangeOrientation(o)}
              >
                <Text style={[styles.settingsSegText, orientation === o && styles.settingsSegTextActive]}>
                  {o === 'portrait' ? '↕ Retrato' : '↔ Paisagem'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.settingsLabel}>Altura do canvas (mm)</Text>
          <TextInput
            style={[styles.settingsInput, { width: 80 }]}
            value={String(canvasHeight)}
            onChangeText={v => onChangeCanvasHeight(parseInt(v) || 100)}
            keyboardType="numeric"
            placeholderTextColor="#555"
          />

          <TouchableOpacity style={styles.settingsDoneBtn} onPress={onClose}>
            <Text style={styles.settingsDoneBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────

const C = {
  bg:      '#0f0f1a',
  surface: '#1e1e2e',
  border:  '#2a2a3e',
  text:    '#e0e0e0',
  muted:   '#888',
  accent:  '#7c6ef0',
};

const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: C.bg },

  // Toolbar
  toolbar:            { backgroundColor: '#0a0a14', borderBottomWidth: 1, borderBottomColor: C.border, height: 48 },
  toolbarScroll:      { flex: 1 },
  toolbarInner:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 48, gap: 4 },
  toolbarTitle:       { color: C.text, fontWeight: '700', fontSize: 14, marginRight: 8, maxWidth: 120 },
  toolbarBtn:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  toolbarBtnActive:   { backgroundColor: '#2a2040', borderColor: C.accent },
  toolbarBtnText:     { color: C.muted, fontSize: 12, fontWeight: '500' },
  toolbarBtnTextActive:{ color: C.text },

  // Three columns
  threeCol:           { flex: 1, flexDirection: 'row' },
  colPalette:         { width: 160, borderRightWidth: 1, borderRightColor: C.border },
  colCanvas:          { flex: 1 },
  colProps:           { width: 220, borderLeftWidth: 1, borderLeftColor: C.border },

  // Tab navigation (phone)
  tabBar:             { flexDirection: 'row', backgroundColor: '#0a0a14', borderBottomWidth: 1, borderBottomColor: C.border },
  tabBtn:             { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabBtnActive:       { borderBottomWidth: 2, borderBottomColor: C.accent },
  tabText:            { color: C.muted, fontSize: 12, fontWeight: '500' },
  tabTextActive:      { color: C.text },
  tabContent:         { flex: 1 },

  // Palette
  palette:            { flex: 1, backgroundColor: C.bg },
  paletteContent:     { padding: 8 },
  paletteTitle:       { color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  paletteSub:         { color: C.muted, fontSize: 10, marginBottom: 10 },
  paletteItem:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 8, padding: 8, marginBottom: 6, gap: 8 },
  paletteIcon:        { width: 32, height: 32, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#252535' },
  paletteIconText:    { fontSize: 14 },
  paletteInfo:        { flex: 1 },
  paletteLabel:       { color: C.text, fontSize: 12, fontWeight: '600' },
  paletteDesc:        { color: C.muted, fontSize: 10, marginTop: 1 },
  paletteAdd:         { color: C.accent, fontSize: 20, fontWeight: '300' },

  // No selection
  noSelect:           { flex: 1, backgroundColor: C.bg },
  noSelectContent:    { padding: 20, alignItems: 'center' },
  noSelectIcon:       { fontSize: 40, marginBottom: 12 },
  noSelectTitle:      { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  noSelectSub:        { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  noSelectBtn:        { width: '100%', backgroundColor: C.surface, borderRadius: 10, padding: 13, marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  noSelectBtnText:    { color: C.text, fontWeight: '600' },

  // Export modal
  exportModal:        { flex: 1, backgroundColor: '#0a0a14' },
  exportHeader:       { padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  exportTitle:        { color: C.text, fontSize: 18, fontWeight: '700' },
  exportSubtitle:     { color: C.accent, fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },
  exportHeaderBtns:   { flexDirection: 'row', gap: 8, marginTop: 12 },
  exportCopyBtn:      { flex: 1, backgroundColor: C.accent, borderRadius: 8, padding: 10, alignItems: 'center' },
  exportCopyBtnText:  { color: '#fff', fontWeight: '700' },
  exportCloseBtn:     { backgroundColor: C.surface, borderRadius: 8, padding: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border },
  exportCloseBtnText: { color: C.muted, fontWeight: '600' },
  exportScroll:       { flex: 1, padding: 12 },
  exportCode:         { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: '#a8d8a8', lineHeight: 18 },
  exportFooter:       { padding: 12, borderTopWidth: 1, borderTopColor: C.border },
  exportFooterText:   { color: C.muted, fontSize: 12 },
  exportFooterPath:   { color: C.accent, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Settings modal
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  settingsModal:      { backgroundColor: C.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 },
  settingsTitle:      { color: C.text, fontSize: 17, fontWeight: '700', marginBottom: 16 },
  settingsLabel:      { color: C.muted, fontSize: 12, marginBottom: 4, marginTop: 12 },
  settingsInput:      { backgroundColor: '#252535', color: C.text, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.border, fontSize: 14 },
  settingsSegment:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  settingsSegItem:    { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#252535', borderWidth: 1, borderColor: C.border },
  settingsSegItemActive:{ backgroundColor: '#3b2fc9', borderColor: '#5b4fe9' },
  settingsSegText:    { color: C.muted, fontSize: 12 },
  settingsSegTextActive:{ color: '#fff', fontWeight: '600' },
  settingsDoneBtn:    { backgroundColor: C.accent, borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 20 },
  settingsDoneBtnText:{ color: '#fff', fontWeight: '700' },
});
