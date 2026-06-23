import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Modal,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';

import { PrintPreview }       from './PrintPreview';
import { PrintPreviewBuilder } from './PrintPreviewBuilder';
import { PRINTER_PROFILES }   from '../utils/profiles';
import type {
  PrinterModel,
  PrintOrientation,
  TextAlign,
  BarcodeType,
  ImageDitherMode,
  DividerStyle,
  CutMode,
  CharsetEncoding,
} from '../types';

// ─────────────────────────────────────────────────────────────
//  PrintConfigScreen
//
//  Full-page editor for building and previewing print layouts.
//  Left/top panel: drag-and-drop block editor
//  Right/bottom panel: live paper preview
//
//  Each "block" maps to one builder step and has its own
//  config form. The preview updates instantly on any change.
//
//  Usage:
//    <PrintConfigScreen onPrint={(builder) => printer.print()} />
// ─────────────────────────────────────────────────────────────

// ── Block types ───────────────────────────────────────────────

type BlockType =
  | 'text'
  | 'divider'
  | 'section'
  | 'row'
  | 'barcode'
  | 'qrcode'
  | 'image'
  | 'feed'
  | 'cut';

interface BaseBlock {
  id:      string;
  type:    BlockType;
  enabled: boolean;
}

interface TextBlock extends BaseBlock {
  type:    'text';
  content: string;
  bold:    boolean;
  size:    number;
  align:   TextAlign;
  invert:  boolean;
  underline: boolean;
}

interface DividerBlock extends BaseBlock {
  type:  'divider';
  style: DividerStyle;
  char:  string;
}

interface SectionBlock extends BaseBlock {
  type:      'section';
  title:     string;
  uppercase: boolean;
  bold:      boolean;
}

interface RowCell {
  text:   string;
  width:  number;
  align:  TextAlign;
  bold:   boolean;
}

interface RowBlock extends BaseBlock {
  type:  'row';
  cells: RowCell[];
}

interface BarcodeBlock extends BaseBlock {
  type:        'barcode';
  data:        string;
  barcodeType: BarcodeType;
  height:      number;
  width:       1 | 2 | 3 | 4 | 5 | 6;
  hriPosition: 'none' | 'above' | 'below' | 'both';
  align:       TextAlign;
}

interface QRCodeBlock extends BaseBlock {
  type:       'qrcode';
  data:       string;
  size:       number;
  errorLevel: 'L' | 'M' | 'Q' | 'H';
  align:      TextAlign;
}

interface ImageBlock extends BaseBlock {
  type:      'image';
  source:    string;
  width:     number;
  align:     TextAlign;
  dither:    ImageDitherMode;
}

interface FeedBlock extends BaseBlock {
  type:  'feed';
  lines: number;
}

interface CutBlock extends BaseBlock {
  type: 'cut';
  mode: CutMode;
  feed: number;
}

type Block =
  | TextBlock
  | DividerBlock
  | SectionBlock
  | RowBlock
  | BarcodeBlock
  | QRCodeBlock
  | ImageBlock
  | FeedBlock
  | CutBlock;

// ── Default blocks ────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_BLOCKS: Block[] = [
  {
    id: makeId(), type: 'text', enabled: true,
    content: 'Empresa Exemplo LTDA',
    bold: true, size: 2, align: 'center', invert: false, underline: false,
  },
  {
    id: makeId(), type: 'text', enabled: true,
    content: 'CNPJ: 00.000.000/0001-00',
    bold: false, size: 1, align: 'center', invert: false, underline: false,
  },
  {
    id: makeId(), type: 'divider', enabled: true,
    style: 'line', char: '',
  },
  {
    id: makeId(), type: 'section', enabled: true,
    title: 'DADOS DO CLIENTE',
    uppercase: false, bold: true,
  },
  {
    id: makeId(), type: 'row', enabled: true,
    cells: [
      { text: 'Nome',        width: 50, align: 'left',  bold: false },
      { text: 'João Silva',  width: 50, align: 'right', bold: true  },
    ],
  },
  {
    id: makeId(), type: 'row', enabled: true,
    cells: [
      { text: 'Vencimento',  width: 40, align: 'left',  bold: false },
      { text: '30/08/2025',  width: 30, align: 'center',bold: false },
      { text: 'R$ 1.250,00', width: 30, align: 'right', bold: true  },
    ],
  },
  {
    id: makeId(), type: 'divider', enabled: true,
    style: 'dashed', char: '',
  },
  {
    id: makeId(), type: 'barcode', enabled: true,
    data: '00190000090010248002700440003000000027630000125000',
    barcodeType: 'ITF', height: 60, width: 2,
    hriPosition: 'none', align: 'center',
  },
  {
    id: makeId(), type: 'qrcode', enabled: true,
    data: 'https://exemplo.com/pix/pay/123',
    size: 5, errorLevel: 'M', align: 'center',
  },
  {
    id: makeId(), type: 'feed', enabled: true, lines: 2,
  },
  {
    id: makeId(), type: 'cut', enabled: true,
    mode: 'full', feed: 4,
  },
];

// ── Block type definitions ────────────────────────────────────

const BLOCK_DEFS: Record<BlockType, { icon: string; label: string; color: string }> = {
  text:    { icon: '🔤', label: 'Texto',         color: '#7c6ef0' },
  divider: { icon: '─',  label: 'Divisor',       color: '#6b7280' },
  section: { icon: '📌', label: 'Seção',         color: '#0ea5e9' },
  row:     { icon: '▤',  label: 'Linha/Tabela',  color: '#10b981' },
  barcode: { icon: '▦',  label: 'Código de barras', color: '#f59e0b' },
  qrcode:  { icon: '⬛', label: 'QR Code',        color: '#8b5cf6' },
  image:   { icon: '🖼', label: 'Imagem',         color: '#ec4899' },
  feed:    { icon: '↕',  label: 'Espaço',         color: '#4b5563' },
  cut:     { icon: '✂',  label: 'Corte',          color: '#ef4444' },
};

// ─────────────────────────────────────────────────────────────
//  Main screen
// ─────────────────────────────────────────────────────────────

export interface PrintConfigScreenProps {
  /** Called when user taps "Imprimir" with the configured builder */
  onPrint?: (builder: PrintPreviewBuilder) => void;
  /** Called when user wants to save the config */
  onSave?:  (blocks: Block[], config: PrintConfig) => void;
  /** Pre-load blocks (e.g. from saved config) */
  initialBlocks?: Block[];
}

interface PrintConfig {
  profile:     PrinterModel;
  orientation: PrintOrientation;
  charset:     CharsetEncoding;
  autoCut:     boolean;
}

export function PrintConfigScreen({
  onPrint,
  initialBlocks,
}: PrintConfigScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width > 700; // tablet or landscape phone

  const [blocks,       setBlocks      ] = useState<Block[]>(initialBlocks ?? DEFAULT_BLOCKS);
  const [selectedId,   setSelectedId  ] = useState<string | null>(null);
  const [showAddMenu,  setShowAddMenu ] = useState(false);
  const [activeTab,    setActiveTab   ] = useState<'editor' | 'preview'>('editor');

  const [config, setConfig] = useState<PrintConfig>({
    profile:     'EPSON_TM_T20X',
    orientation: 'portrait',
    charset:     'CP860',
    autoCut:     false,
  });

  // Build preview from blocks
  const builder = useCallback(() => {
    const profile = PRINTER_PROFILES[config.profile];
    const b = new PrintPreviewBuilder({ profile, orientation: config.orientation });

    for (const block of blocks) {
      if (!block.enabled) continue;

      switch (block.type) {
        case 'text':
          b.text(block.content, {
            bold: block.bold, size: block.size as any,
            align: block.align, invert: block.invert,
            underline: block.underline,
          });
          break;
        case 'divider':
          b.divider({ style: block.style, char: block.char || undefined });
          break;
        case 'section':
          b.section(block.title, { bold: block.bold, uppercase: block.uppercase });
          break;
        case 'row':
          b.row(block.cells);
          break;
        case 'barcode':
          b.barcode(block.data, {
            type: block.barcodeType, height: block.height,
            width: block.width, hriPosition: block.hriPosition, align: block.align,
          });
          break;
        case 'qrcode':
          b.qrCode(block.data, {
            size: block.size, errorLevel: block.errorLevel, align: block.align,
          });
          break;
        case 'image':
          b.image({ source: block.source, width: block.width, align: block.align, dither: block.dither });
          break;
        case 'feed':
          b.feed(block.lines);
          break;
        case 'cut':
          b.cut(block.mode, { feed: block.feed });
          break;
      }
    }

    if (config.autoCut) b.cut();

    return b;
  }, [blocks, config]);

  const currentBuilder = builder();

  const selectedBlock = blocks.find(b => b.id === selectedId) ?? null;

  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } as Block : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setSelectedId(null);
  }, []);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], id: makeId() };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const addBlock = useCallback((type: BlockType) => {
    const newBlock = createDefaultBlock(type);
    setBlocks(prev => [...prev, newBlock]);
    setSelectedId(newBlock.id);
    setShowAddMenu(false);
    if (!isWide) setActiveTab('editor');
  }, [isWide]);

  const handlePrint = () => {
    if (currentBuilder.hasOverflow) {
      Alert.alert(
        'Aviso de Overflow',
        `${currentBuilder.overflowCount} elemento(s) podem exceder a largura do papel.\n\nDeseja imprimir mesmo assim?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Imprimir mesmo assim', onPress: () => onPrint?.(currentBuilder) },
        ],
      );
    } else {
      onPrint?.(currentBuilder);
    }
  };

  // ── Layout ─────────────────────────────────────────────────

  const editorPanel = (
    <View style={[styles.panel, isWide && styles.panelHalf]}>
      {/* Config bar */}
      <ConfigBar config={config} onChange={setConfig} />

      {/* Block list */}
      <ScrollView style={styles.blockList} showsVerticalScrollIndicator>
        {blocks.map((block, idx) => (
          <BlockRow
            key={block.id}
            block={block}
            isSelected={block.id === selectedId}
            isFirst={idx === 0}
            isLast={idx === blocks.length - 1}
            onSelect={() => setSelectedId(block.id === selectedId ? null : block.id)}
            onMove={dir => moveBlock(block.id, dir)}
            onDuplicate={() => duplicateBlock(block.id)}
            onDelete={() => deleteBlock(block.id)}
            onToggle={() => updateBlock(block.id, { enabled: !block.enabled })}
          />
        ))}

        {/* Block editor (inline, below selected block) */}
        {selectedBlock && (
          <BlockEditor
            block={selectedBlock}
            onChange={patch => updateBlock(selectedBlock.id, patch)}
          />
        )}

        {/* Add block button */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddMenu(true)}
        >
          <Text style={styles.addBtnText}>+ Adicionar bloco</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Print button */}
      {onPrint && (
        <View style={styles.printBar}>
          {currentBuilder.hasOverflow && (
            <Text style={styles.overflowWarning}>
              ⚠ {currentBuilder.overflowCount} overflow(s) detectado(s)
            </Text>
          )}
          <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
            <Text style={styles.printBtnText}>🖨  Imprimir</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const previewPanel = (
    <View style={[styles.panel, isWide && styles.panelHalf]}>
      <View style={styles.previewHeader}>
        <Text style={styles.previewHeaderText}>Preview</Text>
        <Text style={styles.previewHeaderSub}>
          {PRINTER_PROFILES[config.profile].paperWidth}mm • {config.orientation}
        </Text>
      </View>
      <PrintPreview
        builder={currentBuilder}
        showRuler
        showMetrics
        highlightOverflow
        style={styles.preview}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {isWide ? (
        // Tablet: side by side
        <View style={styles.row}>
          {editorPanel}
          <View style={styles.dividerV} />
          {previewPanel}
        </View>
      ) : (
        // Phone: tabs
        <>
          <View style={styles.tabBar}>
            {(['editor', 'preview'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                  {tab === 'editor' ? '📝 Editor' : '👁 Preview'}
                  {tab === 'preview' && currentBuilder.hasOverflow && (
                    <Text style={styles.tabBadge}> ⚠</Text>
                  )}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {activeTab === 'editor' ? editorPanel : previewPanel}
        </>
      )}

      {/* Add block modal */}
      <AddBlockModal
        visible={showAddMenu}
        onClose={() => setShowAddMenu(false)}
        onAdd={addBlock}
      />
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────
//  Config bar — paper model / orientation / charset
// ─────────────────────────────────────────────────────────────

function ConfigBar({
  config, onChange,
}: { config: PrintConfig; onChange: (c: PrintConfig) => void }) {
  const models: PrinterModel[] = [
    'EPSON_TM_T20X', 'EPSON_TM_T88', 'GENERIC_58MM', 'GENERIC_80MM',
  ];

  return (
    <View style={styles.configBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.configRow}>
          <ConfigPill
            label="Modelo"
            options={models.map(m => ({ value: m, label: m.replace('EPSON_', '').replace('GENERIC_', '') }))}
            value={config.profile}
            onChange={v => onChange({ ...config, profile: v as PrinterModel })}
          />
          <ConfigPill
            label="Orientação"
            options={[
              { value: 'portrait',  label: '↕ Retrato'  },
              { value: 'landscape', label: '↔ Paisagem' },
            ]}
            value={config.orientation}
            onChange={v => onChange({ ...config, orientation: v as PrintOrientation })}
          />
          <ConfigPill
            label="Charset"
            options={[
              { value: 'CP860',  label: 'CP860 (PT)' },
              { value: 'CP850',  label: 'CP850'      },
              { value: 'CP437',  label: 'CP437 (US)' },
              { value: 'UTF8',   label: 'UTF-8'      },
            ]}
            value={config.charset}
            onChange={v => onChange({ ...config, charset: v as CharsetEncoding })}
          />
          <View style={styles.configToggle}>
            <Text style={styles.configToggleLabel}>Auto-cut</Text>
            <Switch
              value={config.autoCut}
              onValueChange={v => onChange({ ...config, autoCut: v })}
              trackColor={{ false: '#333', true: '#7c6ef0' }}
              thumbColor="#fff"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function ConfigPill({
  label, options, value, onChange,
}: {
  label:   string;
  options: { value: string; label: string }[];
  value:   string;
  onChange:(v: string) => void;
}) {
  const current = options.find(o => o.value === value)?.label ?? value;
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={styles.configPill}
        onPress={() => setOpen(!open)}
      >
        <Text style={styles.configPillLabel}>{label}</Text>
        <Text style={styles.configPillValue}>{current} ▾</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.configDropdown}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.configDropdownItem, opt.value === value && styles.configDropdownItemActive]}
              onPress={() => { onChange(opt.value); setOpen(false); }}
            >
              <Text style={[styles.configDropdownText, opt.value === value && styles.configDropdownTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Block row
// ─────────────────────────────────────────────────────────────

function BlockRow({
  block, isSelected, isFirst, isLast,
  onSelect, onMove, onDuplicate, onDelete, onToggle,
}: {
  block:       Block;
  isSelected:  boolean;
  isFirst:     boolean;
  isLast:      boolean;
  onSelect:    () => void;
  onMove:      (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete:    () => void;
  onToggle:    () => void;
}) {
  const def = BLOCK_DEFS[block.type];

  return (
    <View style={[
      styles.blockRow,
      isSelected && styles.blockRowSelected,
      !block.enabled && styles.blockRowDisabled,
    ]}>
      <TouchableOpacity style={styles.blockMain} onPress={onSelect} activeOpacity={0.7}>
        <View style={[styles.blockTypeTag, { borderLeftColor: def.color }]}>
          <Text style={styles.blockTypeIcon}>{def.icon}</Text>
        </View>
        <View style={styles.blockInfo}>
          <Text style={styles.blockLabel}>{def.label}</Text>
          <Text style={styles.blockPreview} numberOfLines={1}>
            {getBlockSummary(block)}
          </Text>
        </View>
        <Text style={styles.blockChevron}>{isSelected ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {isSelected && (
        <View style={styles.blockActions}>
          <ActionBtn label="▲" onPress={() => onMove(-1)} disabled={isFirst} />
          <ActionBtn label="▼" onPress={() => onMove(1)}  disabled={isLast} />
          <ActionBtn label="⧉" onPress={onDuplicate} />
          <ActionBtn label={block.enabled ? '👁' : '🚫'} onPress={onToggle} />
          <ActionBtn label="🗑" onPress={() => Alert.alert('Remover bloco?', getBlockSummary(block), [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Remover', style: 'destructive', onPress: onDelete },
          ])} color="#ef4444" />
        </View>
      )}
    </View>
  );
}

function ActionBtn({
  label, onPress, disabled, color,
}: { label: string; onPress: () => void; disabled?: boolean; color?: string }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.actionBtnText, color ? { color } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getBlockSummary(block: Block): string {
  switch (block.type) {
    case 'text':    return block.content || '(vazio)';
    case 'divider': return `Estilo: ${block.style}`;
    case 'section': return block.title;
    case 'row':     return block.cells.map(c => c.text).join(' | ');
    case 'barcode': return `${block.barcodeType}: ${block.data.slice(0, 20)}${block.data.length > 20 ? '…' : ''}`;
    case 'qrcode':  return block.data.slice(0, 30) + (block.data.length > 30 ? '…' : '');
    case 'image':   return typeof block.source === 'string' ? block.source.slice(0, 30) : 'Asset';
    case 'feed':    return `${block.lines} linha(s)`;
    case 'cut':     return `Corte ${block.mode}`;
    default:        return '';
  }
}

// ─────────────────────────────────────────────────────────────
//  Block editor forms
// ─────────────────────────────────────────────────────────────

function BlockEditor({
  block, onChange,
}: { block: Block; onChange: (patch: Partial<Block>) => void }) {
  return (
    <View style={styles.blockEditor}>
      <Text style={styles.blockEditorTitle}>
        {BLOCK_DEFS[block.type].icon} {BLOCK_DEFS[block.type].label}
      </Text>
      {block.type === 'text'    && <TextEditor    block={block} onChange={onChange as any} />}
      {block.type === 'divider' && <DividerEditor block={block} onChange={onChange as any} />}
      {block.type === 'section' && <SectionEditor block={block} onChange={onChange as any} />}
      {block.type === 'row'     && <RowEditor     block={block} onChange={onChange as any} />}
      {block.type === 'barcode' && <BarcodeEditor block={block} onChange={onChange as any} />}
      {block.type === 'qrcode'  && <QRCodeEditor  block={block} onChange={onChange as any} />}
      {block.type === 'image'   && <ImageEditor   block={block} onChange={onChange as any} />}
      {block.type === 'feed'    && <FeedEditor    block={block} onChange={onChange as any} />}
      {block.type === 'cut'     && <CutEditor     block={block} onChange={onChange as any} />}
    </View>
  );
}

function TextEditor({ block, onChange }: { block: TextBlock; onChange: (p: Partial<TextBlock>) => void }) {
  return (
    <View style={styles.editorForm}>
      <EField label="Conteúdo">
        <TextInput
          style={styles.eInput}
          value={block.content}
          onChangeText={v => onChange({ content: v })}
          multiline
          placeholderTextColor="#555"
        />
      </EField>
      <ERow>
        <EToggle label="Negrito" value={block.bold} onChange={v => onChange({ bold: v })} />
        <EToggle label="Invertido" value={block.invert} onChange={v => onChange({ invert: v })} />
        <EToggle label="Sublinhado" value={block.underline} onChange={v => onChange({ underline: v })} />
      </ERow>
      <ERow>
        <ESegment
          label="Tamanho"
          options={['1','2','3','4']}
          value={String(block.size)}
          onChange={v => onChange({ size: parseInt(v) })}
        />
        <ESegment
          label="Alinhamento"
          options={['⬅ Esq','↔ Cen','➡ Dir']}
          values={['left','center','right']}
          value={block.align}
          onChange={v => onChange({ align: v as TextAlign })}
        />
      </ERow>
    </View>
  );
}

function DividerEditor({ block, onChange }: { block: DividerBlock; onChange: (p: Partial<DividerBlock>) => void }) {
  return (
    <View style={styles.editorForm}>
      <ESegment
        label="Estilo"
        options={['Linha','Duplo','Tracejado','Pontilhado','Vazio']}
        values={['line','double','dashed','dotted','empty']}
        value={block.style}
        onChange={v => onChange({ style: v as DividerStyle })}
      />
      <EField label="Caractere customizado (opcional)">
        <TextInput
          style={styles.eInput}
          value={block.char}
          onChangeText={v => onChange({ char: v })}
          maxLength={1}
          placeholder="Ex: = * ~"
          placeholderTextColor="#555"
        />
      </EField>
    </View>
  );
}

function SectionEditor({ block, onChange }: { block: SectionBlock; onChange: (p: Partial<SectionBlock>) => void }) {
  return (
    <View style={styles.editorForm}>
      <EField label="Título">
        <TextInput style={styles.eInput} value={block.title} onChangeText={v => onChange({ title: v })} placeholderTextColor="#555" />
      </EField>
      <ERow>
        <EToggle label="Negrito"     value={block.bold}      onChange={v => onChange({ bold: v })} />
        <EToggle label="Maiúsculas"  value={block.uppercase} onChange={v => onChange({ uppercase: v })} />
      </ERow>
    </View>
  );
}

function RowEditor({ block, onChange }: { block: RowBlock; onChange: (p: Partial<RowBlock>) => void }) {
  const updateCell = (idx: number, patch: Partial<RowCell>) => {
    const cells = block.cells.map((c, i) => i === idx ? { ...c, ...patch } : c);
    onChange({ cells });
  };

  const totalWidth = block.cells.reduce((s, c) => s + c.width, 0);
  const widthOk    = totalWidth === 100;

  return (
    <View style={styles.editorForm}>
      {!widthOk && (
        <View style={styles.eWarning}>
          <Text style={styles.eWarningText}>
            ⚠ Larguras somam {totalWidth}% (devem somar 100%)
          </Text>
        </View>
      )}
      {block.cells.map((cell, idx) => (
        <View key={idx} style={styles.cellEditor}>
          <Text style={styles.cellLabel}>Coluna {idx + 1}</Text>
          <EField label="Texto">
            <TextInput
              style={styles.eInput}
              value={cell.text}
              onChangeText={v => updateCell(idx, { text: v })}
              placeholderTextColor="#555"
            />
          </EField>
          <ERow>
            <EField label="Largura %">
              <TextInput
                style={[styles.eInput, styles.eInputSmall]}
                value={String(cell.width)}
                onChangeText={v => updateCell(idx, { width: parseInt(v) || 0 })}
                keyboardType="numeric"
                placeholderTextColor="#555"
              />
            </EField>
            <EToggle label="Negrito" value={cell.bold} onChange={v => updateCell(idx, { bold: v })} />
          </ERow>
          <ESegment
            label="Alinhamento"
            options={['Esquerda','Centro','Direita']}
            values={['left','center','right']}
            value={cell.align}
            onChange={v => updateCell(idx, { align: v as TextAlign })}
          />
        </View>
      ))}

      <ERow>
        <TouchableOpacity
          style={styles.eBtn}
          onPress={() => onChange({ cells: [...block.cells, { text: 'Nova col', width: 0, align: 'left', bold: false }] })}
        >
          <Text style={styles.eBtnText}>+ Coluna</Text>
        </TouchableOpacity>
        {block.cells.length > 1 && (
          <TouchableOpacity
            style={[styles.eBtn, styles.eBtnDanger]}
            onPress={() => onChange({ cells: block.cells.slice(0, -1) })}
          >
            <Text style={styles.eBtnText}>− Coluna</Text>
          </TouchableOpacity>
        )}
      </ERow>
    </View>
  );
}

function BarcodeEditor({ block, onChange }: { block: BarcodeBlock; onChange: (p: Partial<BarcodeBlock>) => void }) {
  return (
    <View style={styles.editorForm}>
      <EField label="Dados">
        <TextInput
          style={[styles.eInput, styles.eInputMono]}
          value={block.data}
          onChangeText={v => onChange({ data: v })}
          placeholderTextColor="#555"
          autoCapitalize="characters"
        />
      </EField>
      <ESegment
        label="Tipo"
        options={['ITF','CODE128','EAN13','EAN8','CODE39','CODABAR']}
        value={block.barcodeType}
        onChange={v => onChange({ barcodeType: v as BarcodeType })}
      />
      <ERow>
        <EField label="Altura (dots)">
          <TextInput
            style={[styles.eInput, styles.eInputSmall]}
            value={String(block.height)}
            onChangeText={v => onChange({ height: parseInt(v) || 50 })}
            keyboardType="numeric"
            placeholderTextColor="#555"
          />
        </EField>
        <EField label="Largura (1-6)">
          <TextInput
            style={[styles.eInput, styles.eInputSmall]}
            value={String(block.width)}
            onChangeText={v => onChange({ width: Math.min(6, Math.max(1, parseInt(v) || 2)) as any })}
            keyboardType="numeric"
            placeholderTextColor="#555"
          />
        </EField>
      </ERow>
      <ESegment
        label="HRI"
        options={['Nenhum','Acima','Abaixo','Ambos']}
        values={['none','above','below','both']}
        value={block.hriPosition}
        onChange={v => onChange({ hriPosition: v as any })}
      />
      <ESegment
        label="Alinhamento"
        options={['Esq','Centro','Dir']}
        values={['left','center','right']}
        value={block.align}
        onChange={v => onChange({ align: v as TextAlign })}
      />
    </View>
  );
}

function QRCodeEditor({ block, onChange }: { block: QRCodeBlock; onChange: (p: Partial<QRCodeBlock>) => void }) {
  return (
    <View style={styles.editorForm}>
      <EField label="Dados / URL">
        <TextInput
          style={[styles.eInput, styles.eInputMulti]}
          value={block.data}
          onChangeText={v => onChange({ data: v })}
          multiline
          placeholderTextColor="#555"
        />
      </EField>
      <ERow>
        <EField label="Tamanho (1-16)">
          <TextInput
            style={[styles.eInput, styles.eInputSmall]}
            value={String(block.size)}
            onChangeText={v => onChange({ size: Math.min(16, Math.max(1, parseInt(v) || 4)) })}
            keyboardType="numeric"
            placeholderTextColor="#555"
          />
        </EField>
        <ESegment
          label="Nível de erro"
          options={['L','M','Q','H']}
          value={block.errorLevel}
          onChange={v => onChange({ errorLevel: v as any })}
        />
      </ERow>
      <ESegment
        label="Alinhamento"
        options={['Esquerda','Centro','Direita']}
        values={['left','center','right']}
        value={block.align}
        onChange={v => onChange({ align: v as TextAlign })}
      />
    </View>
  );
}

function ImageEditor({ block, onChange }: { block: ImageBlock; onChange: (p: Partial<ImageBlock>) => void }) {
  return (
    <View style={styles.editorForm}>
      <EField label="URI / caminho">
        <TextInput
          style={styles.eInput}
          value={block.source as string}
          onChangeText={v => onChange({ source: v })}
          placeholder="file:///... ou https://..."
          placeholderTextColor="#555"
        />
      </EField>
      <EField label="Largura (dots, 0 = automático)">
        <TextInput
          style={[styles.eInput, styles.eInputSmall]}
          value={String(block.width)}
          onChangeText={v => onChange({ width: parseInt(v) || 0 })}
          keyboardType="numeric"
          placeholderTextColor="#555"
        />
      </EField>
      <ESegment
        label="Dithering"
        options={['Threshold','Floyd-St.','Atkinson','Bayer']}
        values={['threshold','floyd-steinberg','atkinson','bayer']}
        value={block.dither}
        onChange={v => onChange({ dither: v as ImageDitherMode })}
      />
      <ESegment
        label="Alinhamento"
        options={['Esquerda','Centro','Direita']}
        values={['left','center','right']}
        value={block.align}
        onChange={v => onChange({ align: v as TextAlign })}
      />
    </View>
  );
}

function FeedEditor({ block, onChange }: { block: FeedBlock; onChange: (p: Partial<FeedBlock>) => void }) {
  return (
    <View style={styles.editorForm}>
      <EField label="Linhas de espaço">
        <TextInput
          style={[styles.eInput, styles.eInputSmall]}
          value={String(block.lines)}
          onChangeText={v => onChange({ lines: Math.max(1, parseInt(v) || 1) })}
          keyboardType="numeric"
          placeholderTextColor="#555"
        />
      </EField>
    </View>
  );
}

function CutEditor({ block, onChange }: { block: CutBlock; onChange: (p: Partial<CutBlock>) => void }) {
  return (
    <View style={styles.editorForm}>
      <ESegment
        label="Tipo de corte"
        options={['Completo','Parcial']}
        values={['full','partial']}
        value={block.mode}
        onChange={v => onChange({ mode: v as CutMode })}
      />
      <EField label="Linhas antes do corte">
        <TextInput
          style={[styles.eInput, styles.eInputSmall]}
          value={String(block.feed)}
          onChangeText={v => onChange({ feed: Math.max(0, parseInt(v) || 0) })}
          keyboardType="numeric"
          placeholderTextColor="#555"
        />
      </EField>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Editor form helpers
// ─────────────────────────────────────────────────────────────

function EField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.eField}>
      <Text style={styles.eLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ERow({ children }: { children: React.ReactNode }) {
  return <View style={styles.eRow}>{children}</View>;
}

function EToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity style={styles.eToggle} onPress={() => onChange(!value)}>
      <View style={[styles.eToggleBox, value && styles.eToggleBoxOn]}>
        {value && <Text style={styles.eToggleCheck}>✓</Text>}
      </View>
      <Text style={styles.eToggleLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ESegment({
  label, options, values, value, onChange,
}: {
  label:    string;
  options:  string[];
  values?:  string[];
  value:    string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.eField}>
      <Text style={styles.eLabel}>{label}</Text>
      <View style={styles.eSegment}>
        {options.map((opt, i) => {
          const val = values ? values[i] : opt;
          return (
            <TouchableOpacity
              key={val}
              style={[styles.eSegmentItem, value === val && styles.eSegmentItemActive]}
              onPress={() => onChange(val)}
            >
              <Text style={[styles.eSegmentText, value === val && styles.eSegmentTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Add block modal
// ─────────────────────────────────────────────────────────────

function AddBlockModal({
  visible, onClose, onAdd,
}: { visible: boolean; onClose: () => void; onAdd: (type: BlockType) => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Adicionar bloco</Text>
          <View style={styles.modalGrid}>
            {(Object.entries(BLOCK_DEFS) as [BlockType, any][]).map(([type, def]) => (
              <TouchableOpacity
                key={type}
                style={styles.modalItem}
                onPress={() => onAdd(type)}
              >
                <View style={[styles.modalItemIcon, { borderColor: def.color }]}>
                  <Text style={{ fontSize: 22 }}>{def.icon}</Text>
                </View>
                <Text style={styles.modalItemLabel}>{def.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
//  Default block factories
// ─────────────────────────────────────────────────────────────

function createDefaultBlock(type: BlockType): Block {
  const base = { id: makeId(), enabled: true };
  switch (type) {
    case 'text':    return { ...base, type, content: 'Novo texto', bold: false, size: 1, align: 'left', invert: false, underline: false };
    case 'divider': return { ...base, type, style: 'line', char: '' };
    case 'section': return { ...base, type, title: 'Nova seção', uppercase: false, bold: true };
    case 'row':     return { ...base, type, cells: [{ text: 'Col 1', width: 50, align: 'left', bold: false }, { text: 'Col 2', width: 50, align: 'right', bold: false }] };
    case 'barcode': return { ...base, type, data: '7891234567890', barcodeType: 'EAN13', height: 50, width: 2, hriPosition: 'below', align: 'center' };
    case 'qrcode':  return { ...base, type, data: 'https://exemplo.com', size: 5, errorLevel: 'M', align: 'center' };
    case 'image':   return { ...base, type, source: '', width: 0, align: 'center', dither: 'floyd-steinberg' };
    case 'feed':    return { ...base, type, lines: 2 };
    case 'cut':     return { ...base, type, mode: 'full', feed: 3 };
  }
}

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:            { flex: 1, backgroundColor: '#0f0f1a' },
  row:               { flex: 1, flexDirection: 'row' },
  panel:             { flex: 1 },
  panelHalf:         { flex: 1 },
  dividerV:          { width: 1, backgroundColor: '#2a2a3e' },
  tabBar:            { flexDirection: 'row', backgroundColor: '#0f0f1a', borderBottomWidth: 1, borderBottomColor: '#2a2a3e' },
  tabBtn:            { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive:      { borderBottomWidth: 2, borderBottomColor: '#7c6ef0' },
  tabBtnText:        { color: '#666', fontWeight: '600' },
  tabBtnTextActive:  { color: '#e0e0e0' },
  tabBadge:          { color: '#ef4444' },

  // Config bar
  configBar:         { backgroundColor: '#0f0f1a', borderBottomWidth: 1, borderBottomColor: '#2a2a3e', paddingVertical: 8 },
  configRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  configPill:        { backgroundColor: '#1e1e2e', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, position: 'relative' },
  configPillLabel:   { fontSize: 9, color: '#666' },
  configPillValue:   { fontSize: 12, color: '#e0e0e0', fontWeight: '600' },
  configDropdown:    { position: 'absolute', top: '100%', left: 0, zIndex: 100, backgroundColor: '#252535', borderRadius: 8, borderWidth: 1, borderColor: '#3a3a4e', minWidth: 140, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, elevation: 12 },
  configDropdownItem:{ paddingHorizontal: 12, paddingVertical: 8 },
  configDropdownItemActive: { backgroundColor: '#3b2fc9' },
  configDropdownText:{ color: '#ccc', fontSize: 13 },
  configDropdownTextActive: { color: '#fff', fontWeight: '600' },
  configToggle:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  configToggleLabel: { color: '#888', fontSize: 12 },

  // Block list
  blockList:         { flex: 1 },
  blockRow:          { marginHorizontal: 8, marginVertical: 3, borderRadius: 8, backgroundColor: '#1e1e2e', overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a3e' },
  blockRowSelected:  { borderColor: '#7c6ef0' },
  blockRowDisabled:  { opacity: 0.4 },
  blockMain:         { flexDirection: 'row', alignItems: 'center', padding: 10 },
  blockTypeTag:      { borderLeftWidth: 3, paddingLeft: 8, marginRight: 10 },
  blockTypeIcon:     { fontSize: 18 },
  blockInfo:         { flex: 1 },
  blockLabel:        { color: '#e0e0e0', fontSize: 13, fontWeight: '600' },
  blockPreview:      { color: '#666', fontSize: 11, marginTop: 2 },
  blockChevron:      { color: '#444', fontSize: 10 },
  blockActions:      { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2a2a3e', padding: 6, gap: 4 },
  actionBtn:         { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#252535' },
  actionBtnDisabled: { opacity: 0.3 },
  actionBtnText:     { color: '#ccc', fontSize: 13 },

  // Block editor
  blockEditor:       { marginHorizontal: 8, marginBottom: 4, backgroundColor: '#171727', borderRadius: 8, borderWidth: 1, borderColor: '#3b2fc9', padding: 12 },
  blockEditorTitle:  { color: '#7c6ef0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

  // Editor form fields
  editorForm:        { gap: 8 },
  eField:            { gap: 4 },
  eLabel:            { color: '#888', fontSize: 11 },
  eInput:            { backgroundColor: '#1e1e2e', color: '#e0e0e0', borderRadius: 6, padding: 8, borderWidth: 1, borderColor: '#2e2e3e', fontSize: 13 },
  eInputSmall:       { width: 80 },
  eInputMono:        { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  eInputMulti:       { minHeight: 60, textAlignVertical: 'top' },
  eRow:              { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  eToggle:           { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eToggleBox:        { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#555', alignItems: 'center', justifyContent: 'center' },
  eToggleBoxOn:      { backgroundColor: '#7c6ef0', borderColor: '#7c6ef0' },
  eToggleCheck:      { color: '#fff', fontSize: 12, fontWeight: '700' },
  eToggleLabel:      { color: '#ccc', fontSize: 12 },
  eSegment:          { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  eSegmentItem:      { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#1e1e2e', borderWidth: 1, borderColor: '#2e2e3e' },
  eSegmentItemActive:{ backgroundColor: '#3b2fc9', borderColor: '#5b4fe9' },
  eSegmentText:      { color: '#888', fontSize: 11 },
  eSegmentTextActive:{ color: '#fff', fontWeight: '600' },
  eWarning:          { backgroundColor: '#2a1a00', borderRadius: 6, padding: 8, borderWidth: 1, borderColor: '#f59e0b' },
  eWarningText:      { color: '#f59e0b', fontSize: 11 },
  eBtn:              { backgroundColor: '#1e1e2e', borderRadius: 6, padding: 8, borderWidth: 1, borderColor: '#3a3a4e' },
  eBtnDanger:        { borderColor: '#7f1d1d' },
  eBtnText:          { color: '#ccc', fontSize: 12 },

  // Cell editor
  cellEditor:        { backgroundColor: '#1a1a2a', borderRadius: 6, padding: 8, marginBottom: 6 },
  cellLabel:         { color: '#7c6ef0', fontSize: 11, fontWeight: '700', marginBottom: 6 },

  // Add / Print
  addBtn:            { margin: 12, borderWidth: 1, borderColor: '#3b2fc9', borderStyle: 'dashed', borderRadius: 8, padding: 12, alignItems: 'center' },
  addBtnText:        { color: '#7c6ef0', fontWeight: '600' },
  printBar:          { borderTopWidth: 1, borderTopColor: '#2a2a3e', padding: 12 },
  overflowWarning:   { color: '#ef4444', fontSize: 12, marginBottom: 6, textAlign: 'center' },
  printBtn:          { backgroundColor: '#1a7a3a', borderRadius: 10, padding: 14, alignItems: 'center' },
  printBtnText:      { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Preview
  previewHeader:     { padding: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a3e', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewHeaderText: { color: '#e0e0e0', fontWeight: '700' },
  previewHeaderSub:  { color: '#666', fontSize: 12 },
  preview:           { flex: 1 },

  // Modal
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:        { backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:        { color: '#e0e0e0', fontSize: 17, fontWeight: '700', marginBottom: 16 },
  modalGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  modalItem:         { width: '22%', alignItems: 'center', gap: 6 },
  modalItemIcon:     { width: 52, height: 52, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#252535' },
  modalItemLabel:    { color: '#ccc', fontSize: 10, textAlign: 'center' },
});
