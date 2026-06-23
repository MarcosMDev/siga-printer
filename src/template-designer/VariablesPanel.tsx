import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Modal, ScrollView, StyleSheet,
} from 'react-native';

import type { TemplateVariable } from './types';

// ─────────────────────────────────────────────────────────────
//  VariablesPanel
//
//  Manages the template's dynamic variables.
//  Variables are named placeholders (e.g. {clientName})
//  that blocks can bind to.
//
//  At print time, the caller passes concrete values:
//    template.print(printer, { clientName: 'João Silva', amount: 'R$ 1.250,00' })
// ─────────────────────────────────────────────────────────────

interface VariablesPanelProps {
  visible:   boolean;
  variables: TemplateVariable[];
  onChange:  (vars: TemplateVariable[]) => void;
  onClose:   () => void;
}

export function VariablesPanel({
  visible, variables, onChange, onClose,
}: VariablesPanelProps) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateVariable>({ name: '', description: '', example: '' });

  const startAdd = () => {
    setForm({ name: '', description: '', example: '' });
    setEditIdx(-1); // -1 = new
  };

  const startEdit = (idx: number) => {
    setForm({ ...variables[idx] });
    setEditIdx(idx);
  };

  const save = () => {
    if (!form.name.trim()) return;
    // Sanitize: only letters, numbers, underscore
    const name = form.name.replace(/[^a-zA-Z0-9_]/g, '');
    const v = { ...form, name };

    if (editIdx === -1) {
      // Prevent duplicate names
      if (variables.find(x => x.name === name)) return;
      onChange([...variables, v]);
    } else if (editIdx !== null) {
      onChange(variables.map((x, i) => i === editIdx ? v : x));
    }
    setEditIdx(null);
  };

  const remove = (idx: number) => {
    onChange(variables.filter((_, i) => i !== idx));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Variáveis dinâmicas</Text>
            <Text style={styles.subtitle}>
              Vincule blocos a variáveis que você preenche na hora de imprimir
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {variables.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔗</Text>
              <Text style={styles.emptyText}>Nenhuma variável definida</Text>
              <Text style={styles.emptySub}>
                Variáveis permitem reutilizar o template com dados diferentes.
                Ex: clientName, amount, barcode, pixKey
              </Text>
            </View>
          )}

          {variables.map((v, idx) => (
            <View key={v.name} style={styles.varCard}>
              <View style={styles.varCardMain}>
                <Text style={styles.varName}>{'{' + v.name + '}'}</Text>
                <Text style={styles.varDesc}>{v.description || 'Sem descrição'}</Text>
                <Text style={styles.varExample}>Ex: {v.example || '—'}</Text>
              </View>
              <View style={styles.varCardActions}>
                <TouchableOpacity style={styles.varEditBtn} onPress={() => startEdit(idx)}>
                  <Text style={styles.varEditBtnText}>✏</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.varDeleteBtn} onPress={() => remove(idx)}>
                  <Text style={styles.varDeleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Edit / Add form */}
        {editIdx !== null && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>
              {editIdx === -1 ? 'Nova variável' : 'Editar variável'}
            </Text>

            <Text style={styles.formLabel}>Nome (sem espaços)</Text>
            <TextInput
              style={styles.formInput}
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v.replace(/[^a-zA-Z0-9_]/g, '') }))}
              placeholder="ex: clientName, barcode, amount"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.formLabel}>Descrição</Text>
            <TextInput
              style={styles.formInput}
              value={form.description}
              onChangeText={v => setForm(f => ({ ...f, description: v }))}
              placeholder="Para que serve esta variável?"
              placeholderTextColor="#555"
            />

            <Text style={styles.formLabel}>Exemplo de valor</Text>
            <TextInput
              style={styles.formInput}
              value={form.example}
              onChangeText={v => setForm(f => ({ ...f, example: v }))}
              placeholder="João da Silva, R$ 1.250,00 ..."
              placeholderTextColor="#555"
            />

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.formCancelBtn}
                onPress={() => setEditIdx(null)}
              >
                <Text style={styles.formCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formSaveBtn, !form.name.trim() && styles.formSaveBtnDisabled]}
                onPress={save}
                disabled={!form.name.trim()}
              >
                <Text style={styles.formSaveBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.addBtn} onPress={startAdd}>
            <Text style={styles.addBtnText}>+ Adicionar variável</Text>
          </TouchableOpacity>

          {variables.length > 0 && (
            <View style={styles.codePreview}>
              <Text style={styles.codePreviewTitle}>Interface gerada:</Text>
              <Text style={styles.codePreviewText} selectable>
                {'interface TemplateData {\n'}
                {variables.map(v => `  ${v.name}: string; // ${v.description || v.example}`).join('\n')}
                {'\n}'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const C = {
  bg:      '#0f0f1a',
  surface: '#1e1e2e',
  border:  '#2a2a3e',
  text:    '#e0e0e0',
  muted:   '#888',
  accent:  '#7c6ef0',
};

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title:          { color: C.text, fontSize: 18, fontWeight: '700' },
  subtitle:       { color: C.muted, fontSize: 12, marginTop: 3, maxWidth: 280 },
  closeBtn:       { padding: 6 },
  closeBtnText:   { color: C.muted, fontSize: 18 },

  list:           { flex: 1 },
  listContent:    { padding: 12 },

  empty:          { alignItems: 'center', padding: 32 },
  emptyIcon:      { fontSize: 36, marginBottom: 10 },
  emptyText:      { color: C.text, fontSize: 15, fontWeight: '600' },
  emptySub:       { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  varCard:        { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  varCardMain:    { flex: 1 },
  varName:        { color: C.accent, fontSize: 14, fontWeight: '700', fontFamily: 'monospace' },
  varDesc:        { color: C.text, fontSize: 12, marginTop: 2 },
  varExample:     { color: C.muted, fontSize: 11, marginTop: 3 },
  varCardActions: { gap: 6, justifyContent: 'center' },
  varEditBtn:     { width: 32, height: 32, borderRadius: 6, backgroundColor: '#252535', alignItems: 'center', justifyContent: 'center' },
  varEditBtnText: { fontSize: 14 },
  varDeleteBtn:   { width: 32, height: 32, borderRadius: 6, backgroundColor: '#1a0a0a', alignItems: 'center', justifyContent: 'center' },
  varDeleteBtnText:{ fontSize: 14 },

  form:           { backgroundColor: '#141424', borderTopWidth: 1, borderTopColor: C.border, padding: 14 },
  formTitle:      { color: C.accent, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  formLabel:      { color: C.muted, fontSize: 11, marginBottom: 4, marginTop: 8 },
  formInput:      { backgroundColor: '#252535', color: C.text, borderRadius: 6, padding: 9, borderWidth: 1, borderColor: C.border, fontSize: 13 },
  formActions:    { flexDirection: 'row', gap: 8, marginTop: 12 },
  formCancelBtn:  { flex: 1, backgroundColor: C.surface, borderRadius: 8, padding: 11, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  formCancelBtnText:{ color: C.muted, fontWeight: '600' },
  formSaveBtn:    { flex: 1, backgroundColor: C.accent, borderRadius: 8, padding: 11, alignItems: 'center' },
  formSaveBtnDisabled:{ opacity: 0.4 },
  formSaveBtnText:{ color: '#fff', fontWeight: '700' },

  footer:         { borderTopWidth: 1, borderTopColor: C.border, padding: 12 },
  addBtn:         { backgroundColor: C.surface, borderRadius: 10, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: C.accent, borderStyle: 'dashed', marginBottom: 10 },
  addBtnText:     { color: C.accent, fontWeight: '600' },
  codePreview:    { backgroundColor: '#0d0d18', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.border },
  codePreviewTitle:{ color: C.muted, fontSize: 10, marginBottom: 4 },
  codePreviewText:{ fontFamily: 'monospace', fontSize: 11, color: '#a8d8a8', lineHeight: 16 },
});
