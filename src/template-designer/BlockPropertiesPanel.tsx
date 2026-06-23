import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Switch, Platform,
} from 'react-native';

import type { DesignerBlock, BlockData, BlockGeometry, TemplateVariable } from './types';
import { BLOCK_META } from './types';
import type { TextAlign, BarcodeType, ImageDitherMode, QRErrorLevel, DividerStyle } from '../types';

// ─────────────────────────────────────────────────────────────
//  BlockPropertiesPanel
//  Context-sensitive editor that shows the right form
//  for the currently selected block.
// ─────────────────────────────────────────────────────────────

interface BlockPropertiesPanelProps {
  block:              DesignerBlock;
  variables:          TemplateVariable[];
  onChange:           (data: BlockData) => void;
  onGeometryChange:   (geom: Partial<BlockGeometry>) => void;
  onDuplicate:        () => void;
  onDelete:           () => void;
  onBringForward:     () => void;
  onSendBackward:     () => void;
  onToggleLock:       () => void;
}

export function BlockPropertiesPanel({
  block, variables, onChange, onGeometryChange,
  onDuplicate, onDelete, onBringForward, onSendBackward, onToggleLock,
}: BlockPropertiesPanelProps) {
  const meta = BLOCK_META[block.data.type];

  return (
    <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
      {/* Block header */}
      <View style={[styles.header, { borderLeftColor: meta.color }]}>
        <Text style={styles.headerIcon}>{meta.icon}</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.headerType}>{meta.label}</Text>
          <Text style={styles.headerId}>{block.id}</Text>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.actions}>
        <ActionBtn icon="⬆" label="Frente"  onPress={onBringForward} />
        <ActionBtn icon="⬇" label="Atrás"   onPress={onSendBackward} />
        <ActionBtn icon="⧉" label="Clonar"  onPress={onDuplicate} />
        <ActionBtn icon={block.locked ? "🔓" : "🔒"} label={block.locked ? "Destravar" : "Travar"} onPress={onToggleLock} />
        <ActionBtn icon="🗑" label="Remover" onPress={onDelete} danger />
      </View>

      {/* Geometry */}
      <Section title="Posição e tamanho">
        <Row>
          <NumField label="X (mm)" value={block.geometry.x} onChange={v => onGeometryChange({ x: v })} step={1} />
          <NumField label="Y (mm)" value={block.geometry.y} onChange={v => onGeometryChange({ y: v })} step={1} />
        </Row>
        <Row>
          <NumField label="Largura (mm)" value={block.geometry.w} onChange={v => onGeometryChange({ w: v })} step={1} min={5} />
          <NumField label="Altura (mm)"  value={block.geometry.h} onChange={v => onGeometryChange({ h: v })} step={0.5} min={2} />
        </Row>
      </Section>

      {/* Data-specific editor */}
      <BlockDataEditor
        data={block.data}
        variables={variables}
        onChange={onChange}
      />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
//  Block data editors
// ─────────────────────────────────────────────────────────────

function BlockDataEditor({
  data, variables, onChange,
}: { data: BlockData; variables: TemplateVariable[]; onChange: (d: BlockData) => void }) {
  const varNames = variables.map(v => v.name);

  switch (data.type) {
    case 'text':
      return (
        <>
          <Section title="Conteúdo">
            <VarBindingField
              label="Texto"
              value={data.content}
              variable={data.variable}
              varNames={varNames}
              onChange={content => onChange({ ...data, content })}
              onVarChange={variable => onChange({ ...data, variable })}
            />
          </Section>
          <Section title="Formatação">
            <ToggleRow label="Negrito"     value={data.bold}      onChange={v => onChange({ ...data, bold: v })} />
            <ToggleRow label="Invertido"   value={data.invert}    onChange={v => onChange({ ...data, invert: v })} />
            <ToggleRow label="Sublinhado"  value={data.underline} onChange={v => onChange({ ...data, underline: v })} />
            <Segment
              label="Tamanho"
              options={['1','2','3','4']}
              value={String(data.size)}
              onChange={v => onChange({ ...data, size: parseInt(v) as any })}
            />
            <Segment
              label="Alinhamento"
              options={['Esq','Centro','Dir']}
              values={['left','center','right']}
              value={data.align}
              onChange={v => onChange({ ...data, align: v as TextAlign })}
            />
          </Section>
        </>
      );

    case 'barcode':
      return (
        <>
          <Section title="Dados">
            <VarBindingField
              label="Dados"
              value={data.data}
              variable={data.variable}
              varNames={varNames}
              onChange={d => onChange({ ...data, data: d })}
              onVarChange={variable => onChange({ ...data, variable })}
              mono
            />
          </Section>
          <Section title="Configuração">
            <Segment
              label="Tipo"
              options={['ITF','CODE128','EAN13','EAN8','CODE39']}
              value={data.barcodeType}
              onChange={v => onChange({ ...data, barcodeType: v as BarcodeType })}
            />
            <Row>
              <NumField
                label="Altura (dots)"
                value={data.height}
                onChange={v => onChange({ ...data, height: v })}
                step={5} min={20} max={255}
              />
              <NumField
                label="Módulo (1-6)"
                value={data.moduleWidth}
                onChange={v => onChange({ ...data, moduleWidth: Math.min(6, Math.max(1, v)) as any })}
                step={1} min={1} max={6}
              />
            </Row>
            <Segment
              label="HRI (texto legível)"
              options={['Nenhum','Acima','Abaixo','Ambos']}
              values={['none','above','below','both']}
              value={data.hriPosition}
              onChange={v => onChange({ ...data, hriPosition: v as any })}
            />
            <Segment
              label="Alinhamento"
              options={['Esq','Centro','Dir']}
              values={['left','center','right']}
              value={data.align}
              onChange={v => onChange({ ...data, align: v as TextAlign })}
            />
          </Section>
        </>
      );

    case 'qrcode':
      return (
        <>
          <Section title="Dados">
            <VarBindingField
              label="URL / Payload Pix"
              value={data.data}
              variable={data.variable}
              varNames={varNames}
              onChange={d => onChange({ ...data, data: d })}
              onVarChange={variable => onChange({ ...data, variable })}
              multiline
            />
          </Section>
          <Section title="Configuração">
            <Row>
              <NumField
                label="Tamanho (1-16)"
                value={data.size}
                onChange={v => onChange({ ...data, size: Math.min(16, Math.max(1, v)) })}
                step={1} min={1} max={16}
              />
            </Row>
            <Segment
              label="Nível de erro"
              options={['L','M','Q','H']}
              value={data.errorLevel}
              onChange={v => onChange({ ...data, errorLevel: v as QRErrorLevel })}
            />
            <Segment
              label="Alinhamento"
              options={['Esq','Centro','Dir']}
              values={['left','center','right']}
              value={data.align}
              onChange={v => onChange({ ...data, align: v as TextAlign })}
            />
          </Section>
        </>
      );

    case 'image':
      return (
        <Section title="Imagem">
          <Field label="Fonte (URI / caminho)">
            <TextInput
              style={styles.input}
              value={data.source}
              onChangeText={v => onChange({ ...data, source: v })}
              placeholder="file:///... ou https://..."
              placeholderTextColor="#555"
            />
          </Field>
          <NumField
            label="Largura em dots (0 = auto)"
            value={data.widthDots}
            onChange={v => onChange({ ...data, widthDots: v })}
            step={8} min={0}
          />
          <Segment
            label="Dithering"
            options={['Threshold','Floyd-St.','Atkinson','Bayer']}
            values={['threshold','floyd-steinberg','atkinson','bayer']}
            value={data.dither}
            onChange={v => onChange({ ...data, dither: v as ImageDitherMode })}
          />
          <Segment
            label="Alinhamento"
            options={['Esq','Centro','Dir']}
            values={['left','center','right']}
            value={data.align}
            onChange={v => onChange({ ...data, align: v as TextAlign })}
          />
        </Section>
      );

    case 'divider':
      return (
        <Section title="Divisor">
          <Segment
            label="Estilo"
            options={['Linha','Duplo','Tracejado','Pontilhado']}
            values={['line','double','dashed','dotted']}
            value={data.style}
            onChange={v => onChange({ ...data, style: v as DividerStyle })}
          />
          <Field label="Caractere customizado (opcional)">
            <TextInput
              style={[styles.input, { width: 60 }]}
              value={data.char}
              onChangeText={v => onChange({ ...data, char: v.slice(0, 1) })}
              maxLength={1}
              placeholder="-"
              placeholderTextColor="#555"
            />
          </Field>
        </Section>
      );

    case 'row':
      return (
        <RowBlockEditor data={data} varNames={varNames} onChange={onChange} />
      );

    case 'spacer':
      return (
        <Section title="Espaço">
          <NumField
            label="Linhas de espaço"
            value={data.lines}
            onChange={v => onChange({ ...data, lines: Math.max(1, v) })}
            step={1} min={1} max={20}
          />
        </Section>
      );

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  Row block editor (multi-column)
// ─────────────────────────────────────────────────────────────

function RowBlockEditor({
  data, varNames, onChange,
}: { data: any; varNames: string[]; onChange: (d: any) => void }) {
  const total  = data.cells.reduce((s: number, c: any) => s + c.width, 0);
  const widthOk = total === 100;

  const updateCell = (idx: number, patch: any) => {
    const cells = data.cells.map((c: any, i: number) => i === idx ? { ...c, ...patch } : c);
    onChange({ ...data, cells });
  };

  return (
    <>
      {!widthOk && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>⚠ Larguras somam {total}% (devem somar 100%)</Text>
        </View>
      )}

      {data.cells.map((cell: any, idx: number) => (
        <Section key={idx} title={`Coluna ${idx + 1}`}>
          <VarBindingField
            label="Texto"
            value={cell.text}
            variable={cell.variable}
            varNames={varNames}
            onChange={v => updateCell(idx, { text: v })}
            onVarChange={v => updateCell(idx, { variable: v })}
          />
          <Row>
            <NumField
              label="Largura %"
              value={cell.width}
              onChange={v => updateCell(idx, { width: v })}
              step={5} min={5} max={95}
            />
            <ToggleRow label="Negrito" value={cell.bold} onChange={v => updateCell(idx, { bold: v })} />
          </Row>
          <Segment
            label="Alinhamento"
            options={['Esq','Centro','Dir']}
            values={['left','center','right']}
            value={cell.align}
            onChange={v => updateCell(idx, { align: v })}
          />
        </Section>
      ))}

      <Row>
        <TouchableOpacity
          style={styles.colBtn}
          onPress={() => onChange({ ...data, cells: [...data.cells, { text: 'Nova col', width: 0, align: 'left', bold: false }] })}
        >
          <Text style={styles.colBtnText}>+ Coluna</Text>
        </TouchableOpacity>
        {data.cells.length > 1 && (
          <TouchableOpacity
            style={[styles.colBtn, styles.colBtnDanger]}
            onPress={() => onChange({ ...data, cells: data.cells.slice(0, -1) })}
          >
            <Text style={styles.colBtnText}>− Coluna</Text>
          </TouchableOpacity>
        )}
      </Row>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  Variable binding field
//  Shows a text input + a "bind to variable" dropdown
// ─────────────────────────────────────────────────────────────

function VarBindingField({
  label, value, variable, varNames, onChange, onVarChange, mono, multiline,
}: {
  label:       string;
  value:       string;
  variable?:   string;
  varNames:    string[];
  onChange:    (v: string) => void;
  onVarChange: (v: string | undefined) => void;
  mono?:       boolean;
  multiline?:  boolean;
}) {
  const [showVarPicker, setShowVarPicker] = useState(false);

  return (
    <Field label={label}>
      <View style={styles.varRow}>
        <TextInput
          style={[
            styles.input,
            styles.varInput,
            mono && styles.inputMono,
            multiline && styles.inputMulti,
            !!variable && styles.inputBound,
          ]}
          value={variable ? `{${variable}}` : value}
          onChangeText={onChange}
          editable={!variable}
          multiline={multiline}
          placeholderTextColor="#555"
        />
        {varNames.length > 0 && (
          <TouchableOpacity
            style={[styles.varBtn, !!variable && styles.varBtnActive]}
            onPress={() => setShowVarPicker(!showVarPicker)}
          >
            <Text style={styles.varBtnText}>{variable ? '🔗' : '⊕'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {showVarPicker && (
        <View style={styles.varPicker}>
          <TouchableOpacity
            style={styles.varPickerItem}
            onPress={() => { onVarChange(undefined); setShowVarPicker(false); }}
          >
            <Text style={styles.varPickerText}>— Sem vínculo (texto fixo)</Text>
          </TouchableOpacity>
          {varNames.map(name => (
            <TouchableOpacity
              key={name}
              style={[styles.varPickerItem, variable === name && styles.varPickerItemActive]}
              onPress={() => { onVarChange(name); setShowVarPicker(false); }}
            >
              <Text style={[styles.varPickerText, variable === name && styles.varPickerTextActive]}>
                🔗 {'{' + name + '}'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Field>
  );
}

// ─────────────────────────────────────────────────────────────
//  Form helpers
// ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function NumField({ label, value, onChange, step = 1, min = 0, max = 9999 }: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number;
}) {
  return (
    <View style={styles.numField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.numRow}>
        <TouchableOpacity
          style={styles.numBtn}
          onPress={() => onChange(Math.max(min, parseFloat((value - step).toFixed(2))))}
        >
          <Text style={styles.numBtnText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.numInput}
          value={String(value)}
          onChangeText={v => {
            const n = parseFloat(v);
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          keyboardType="numeric"
          placeholderTextColor="#555"
        />
        <TouchableOpacity
          style={styles.numBtn}
          onPress={() => onChange(Math.min(max, parseFloat((value + step).toFixed(2))))}
        >
          <Text style={styles.numBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ToggleRow({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#333', true: '#7c6ef0' }}
        thumbColor="#fff"
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
      />
    </View>
  );
}

function Segment({ label, options, values, value, onChange }: {
  label: string; options: string[]; values?: string[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <View style={styles.segment}>
        {options.map((opt, i) => {
          const val = values ? values[i] : opt;
          return (
            <TouchableOpacity
              key={val}
              style={[styles.segItem, value === val && styles.segItemActive]}
              onPress={() => onChange(val)}
            >
              <Text style={[styles.segText, value === val && styles.segTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Field>
  );
}

function ActionBtn({ icon, label, onPress, danger }: {
  icon: string; label: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.actionBtn, danger && styles.actionBtnDanger]} onPress={onPress}>
      <Text style={styles.actionBtnIcon}>{icon}</Text>
      <Text style={[styles.actionBtnLabel, danger && styles.actionBtnLabelDanger]}>{label}</Text>
    </TouchableOpacity>
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
  panel:          { flex: 1, backgroundColor: C.bg },
  panelContent:   { padding: 10, paddingBottom: 40 },

  header:         { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, paddingLeft: 8, marginBottom: 10 },
  headerIcon:     { fontSize: 22, marginRight: 8 },
  headerInfo:     { flex: 1 },
  headerType:     { color: C.text, fontSize: 14, fontWeight: '700' },
  headerId:       { color: '#555', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  actions:        { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 },
  actionBtn:      { backgroundColor: C.surface, borderRadius: 7, padding: 7, alignItems: 'center', minWidth: 52, borderWidth: 1, borderColor: C.border },
  actionBtnDanger:{ borderColor: '#7f1d1d' },
  actionBtnIcon:  { fontSize: 14 },
  actionBtnLabel: { color: C.muted, fontSize: 9, marginTop: 2 },
  actionBtnLabelDanger: { color: '#f87171' },

  section:        { backgroundColor: C.surface, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  sectionTitle:   { color: C.accent, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  field:          { marginBottom: 8 },
  fieldLabel:     { color: C.muted, fontSize: 11, marginBottom: 4 },
  input:          { backgroundColor: '#252535', color: C.text, borderRadius: 6, padding: 8, borderWidth: 1, borderColor: C.border, fontSize: 13 },
  inputMono:      { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  inputMulti:     { minHeight: 56, textAlignVertical: 'top' },
  inputBound:     { backgroundColor: '#1a1535', borderColor: C.accent, color: C.accent },

  row:            { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  numField:       { flex: 1, minWidth: 100 },
  numRow:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  numBtn:         { width: 28, height: 28, borderRadius: 6, backgroundColor: '#252535', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  numBtnText:     { color: C.text, fontSize: 16, fontWeight: '300' },
  numInput:       { flex: 1, backgroundColor: '#252535', color: C.text, borderRadius: 6, padding: 6, borderWidth: 1, borderColor: C.border, fontSize: 13, textAlign: 'center' },

  toggleRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  toggleLabel:    { color: C.text, fontSize: 13 },

  segment:        { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  segItem:        { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#252535', borderWidth: 1, borderColor: C.border },
  segItemActive:  { backgroundColor: '#3b2fc9', borderColor: '#5b4fe9' },
  segText:        { color: C.muted, fontSize: 11 },
  segTextActive:  { color: '#fff', fontWeight: '600' },

  varRow:         { flexDirection: 'row', gap: 6 },
  varInput:       { flex: 1 },
  varBtn:         { width: 36, height: 36, borderRadius: 6, backgroundColor: '#252535', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  varBtnActive:   { backgroundColor: '#1a1535', borderColor: C.accent },
  varBtnText:     { fontSize: 16 },
  varPicker:      { backgroundColor: '#252535', borderRadius: 8, borderWidth: 1, borderColor: C.border, marginTop: 4, overflow: 'hidden' },
  varPickerItem:  { padding: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  varPickerItemActive:{ backgroundColor: '#2a2050' },
  varPickerText:  { color: C.muted, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  varPickerTextActive:{ color: C.accent, fontWeight: '600' },

  warning:        { backgroundColor: '#2a1a00', borderRadius: 6, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#f59e0b' },
  warningText:    { color: '#f59e0b', fontSize: 11 },

  colBtn:         { flex: 1, backgroundColor: C.surface, borderRadius: 6, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  colBtnDanger:   { borderColor: '#7f1d1d' },
  colBtnText:     { color: C.muted, fontSize: 12 },
});
