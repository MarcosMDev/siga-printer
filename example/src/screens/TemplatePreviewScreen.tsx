import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import {
  PrintPreview,
  PrintPreviewBuilder,
  PRINTER_PROFILES,
} from 'siga-printer';
import type { PrintOrientation } from 'siga-printer';

type TemplateName = 'receipt' | 'boleto' | 'shipping' | 'raw';

export function TemplatePreviewScreen() {
  const [active,      setActive     ] = useState<TemplateName>('receipt');
  const [orientation, setOrientation] = useState<PrintOrientation>('portrait');

  const builder = useMemo(
    () => buildTemplate(active, orientation),
    [active, orientation],
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(['receipt', 'boleto', 'shipping', 'raw'] as TemplateName[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, active === t && styles.tabActive]}
            onPress={() => setActive(t)}
          >
            <Text style={[styles.tabText, active === t && styles.tabTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.orientationRow}>
        {(['portrait', 'landscape'] as PrintOrientation[]).map(o => (
          <TouchableOpacity
            key={o}
            style={[styles.orientBtn, orientation === o && styles.orientBtnActive]}
            onPress={() => setOrientation(o)}
          >
            <Text style={[styles.orientText, orientation === o && styles.orientTextActive]}>
              {o === 'portrait' ? '↕ Retrato' : '↔ Paisagem'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <PrintPreview
        builder={builder}
        showRuler={true}
        showMetrics={true}
        showCutMark={true}
        style={styles.preview}
      />
    </View>
  );
}

function buildTemplate(name: TemplateName, orientation: PrintOrientation): PrintPreviewBuilder {
  const b = new PrintPreviewBuilder({
    profile: PRINTER_PROFILES.EPSON_TM_T20X,
    orientation,
  });

  switch (name) {
    case 'receipt':
      return b.init()
        .text('LOJA EXEMPLO LTDA', { bold: true, size: 2, align: 'center' })
        .text('CNPJ: 00.000.000/0001-00', { align: 'center' })
        .text('Rua Exemplo, 100 - São Paulo/SP', { align: 'center' })
        .divider()
        .text('CUPOM NÃO FISCAL', { align: 'center' })
        .text('23/06/2026 17:42', { align: 'center' })
        .divider()
        .row([
          { text: 'PRODUTO', width: 50, bold: true },
          { text: 'QTD', width: 15, align: 'center', bold: true },
          { text: 'VALOR', width: 35, align: 'right', bold: true },
        ])
        .divider({ style: 'dashed' })
        .row([
          { text: 'Café Expresso', width: 50 },
          { text: '2x', width: 15, align: 'center' },
          { text: 'R$ 10,00', width: 35, align: 'right' },
        ])
        .row([
          { text: 'Pão de Queijo', width: 50 },
          { text: '3x', width: 15, align: 'center' },
          { text: 'R$ 12,00', width: 35, align: 'right' },
        ])
        .row([
          { text: 'Suco de Laranja', width: 50 },
          { text: '1x', width: 15, align: 'center' },
          { text: 'R$ 8,50', width: 35, align: 'right' },
        ])
        .divider()
        .row([
          { text: 'TOTAL', width: 60, bold: true, align: 'right' },
          { text: 'R$ 30,50', width: 40, bold: true, align: 'right' },
        ])
        .row([
          { text: 'Dinheiro', width: 60, align: 'right' },
          { text: 'R$ 50,00', width: 40, align: 'right' },
        ])
        .row([
          { text: 'Troco', width: 60, align: 'right' },
          { text: 'R$ 19,50', width: 40, align: 'right' },
        ])
        .divider()
        .qrCode('https://nfce.exemplo.com/123456', { size: 4, align: 'center' })
        .text('Consulte em: nfce.exemplo.com', { align: 'center' })
        .feed(1)
        .text('Obrigado pela preferência!', { align: 'center', bold: true })
        .cut();

    case 'boleto':
      return b.init()
        .text('BANCO EXEMPLO S.A.', { bold: true, size: 2, align: 'center' })
        .text('000-0', { align: 'center' })
        .divider()
        .text('BOLETO BANCÁRIO', { align: 'center', bold: true })
        .divider({ style: 'dashed' })
        .row([
          { text: 'Beneficiário:', width: 40, bold: true },
          { text: 'Empresa XYZ LTDA', width: 60 },
        ])
        .row([
          { text: 'CNPJ:', width: 40, bold: true },
          { text: '11.111.111/0001-11', width: 60 },
        ])
        .divider({ style: 'dashed' })
        .row([
          { text: 'Pagador:', width: 40, bold: true },
          { text: 'João da Silva', width: 60 },
        ])
        .row([
          { text: 'CPF:', width: 40, bold: true },
          { text: '123.456.789-00', width: 60 },
        ])
        .divider({ style: 'dashed' })
        .row([
          { text: 'Nosso Número:', width: 40, bold: true },
          { text: '00012345', width: 60 },
        ])
        .row([
          { text: 'Vencimento:', width: 40, bold: true },
          { text: '10/08/2026', width: 60 },
        ])
        .row([
          { text: 'Valor:', width: 40, bold: true },
          { text: 'R$ 1.250,00', width: 60, bold: true },
        ])
        .divider()
        .barcode('34191090080000008214800082194207197960000125000', {
          type: 'ITF',
          height: 60,
          hriPosition: 'below',
          align: 'center',
        })
        .feed(1)
        .text('Pagável em qualquer banco até o vencimento', { align: 'center' })
        .cut();

    case 'shipping':
      return b.init()
        .text('ETIQUETA DE ENVIO', { bold: true, size: 2, align: 'center' })
        .divider()
        .text('DESTINATÁRIO', { bold: true })
        .text('João da Silva')
        .text('Rua das Flores, 500 - Apto 42')
        .text('Bairro: Jardim Primavera')
        .text('São Paulo / SP - CEP: 01310-100')
        .text('Tel: (11) 99999-9999')
        .divider({ style: 'double' })
        .text('REMETENTE', { bold: true })
        .text('Empresa XYZ LTDA')
        .text('Rua Comércio, 100 - Centro')
        .text('São Paulo / SP - CEP: 01001-000')
        .divider()
        .row([
          { text: 'Pedido:', width: 40, bold: true },
          { text: '#PED-2026-00123', width: 60 },
        ])
        .row([
          { text: 'Peso:', width: 40, bold: true },
          { text: '2,3 kg', width: 60 },
        ])
        .row([
          { text: 'Transportadora:', width: 40, bold: true },
          { text: 'CORREIOS PAC', width: 60 },
        ])
        .divider()
        .qrCode('https://rastreio.exemplo.com/PED-2026-00123', { size: 5, align: 'center' })
        .text('Rastreie em: rastreio.exemplo.com', { align: 'center' })
        .cut();

    case 'raw':
      return b.init()
        .text('Texto normal')
        .text('NEGRITO', { bold: true })
        .text('Sublinhado', { underline: true })
        .text('Invertido', { invert: true })
        .text('Tamanho 2x', { size: 2 })
        .text('Esquerda', { align: 'left' })
        .text('Centro', { align: 'center' })
        .text('Direita', { align: 'right' })
        .divider()
        .divider({ style: 'dashed' })
        .divider({ style: 'double' })
        .divider({ style: 'dotted' })
        .feed(1)
        .barcode('1234567890128', { type: 'EAN13', hriPosition: 'below', align: 'center' })
        .feed(1)
        .qrCode('https://siga-printer', { size: 5, align: 'center' })
        .text('QR Code acima', { align: 'center' })
        .cut();
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: '#333', alignItems: 'center',
  },
  tabActive: { backgroundColor: '#3b2fc9', borderColor: '#5b4fe9' },
  tabText: { color: '#666', fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  preview: { flex: 1 },

  orientationRow: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, gap: 8 },
  orientBtn:      { flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  orientBtnActive:{ backgroundColor: '#7c3aed', borderColor: '#9c5aff' },
  orientText:     { color: '#666', fontSize: 12, fontWeight: '600' },
  orientTextActive: { color: '#fff' },
});
