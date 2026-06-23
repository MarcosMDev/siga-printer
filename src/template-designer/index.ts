export { TemplateDesigner }     from './TemplateDesigner';
export { PaperCanvas }          from './PaperCanvas';
export { BlockPropertiesPanel } from './BlockPropertiesPanel';
export { VariablesPanel }       from './VariablesPanel';
export {
  generateTypeScriptCode,
  createDefaultBlock,
  estimateBlockHeightMm,
  mmToPx, pxToMm, snapToGrid,
  BLOCK_META,
} from './types';

export type {
  DesignerBlock,
  DesignerBlockType,
  TemplateDefinition,
  TemplateVariable,
  BlockGeometry,
  BlockData,
  TextBlockData,
  BarcodeBlockData,
  QRCodeBlockData,
  ImageBlockData,
  DividerBlockData,
  RowBlockData,
} from './types';

// ── Starter templates ─────────────────────────────────────────

import type { TemplateDefinition } from './types';

/**
 * Pre-built starter template: Boleto Landscape 80mm
 * Logo (left) | Bank info (center) | Amount + QR (right)
 * Full ITF-25 barcode across bottom
 */
export const BOLETO_LANDSCAPE_STARTER: Partial<TemplateDefinition> = {
  name:        'Boleto Landscape',
  description: 'Boleto bancário em paisagem: logo, dados, QR Pix e código de barras',
  orientation: 'landscape',
  printerModel:'EPSON_TM_T20X',
  paperWidth:  80,
  canvasHeight: 120,
  variables: [
    { name: 'beneficiaryName', description: 'Nome do beneficiário',  example: 'Empresa XYZ LTDA' },
    { name: 'payerName',       description: 'Nome do pagador',       example: 'João da Silva'      },
    { name: 'dueDate',         description: 'Vencimento',            example: '30/08/2025'         },
    { name: 'amount',          description: 'Valor',                 example: 'R$ 1.250,00'        },
    { name: 'nossoNumero',     description: 'Nosso número',          example: '00012345'           },
    { name: 'barcode',         description: 'Código de barras ITF',  example: '0019000009001024...' },
    { name: 'pixPayload',      description: 'Payload QR Pix',        example: '00020126...'        },
  ],
  blocks: [
    // ── Row 1: Logo + Bank name + Nosso Nº ───────────────────
    {
      id: 'logo', locked: false, label: 'Logo empresa',
      geometry: { x: 2, y: 2, w: 22, h: 14 },
      data: { type: 'image', source: '', widthDots: 0, dither: 'atkinson', align: 'center' },
    },
    {
      id: 'bankname', locked: false, label: 'Nome do banco',
      geometry: { x: 26, y: 2, w: 44, h: 7 },
      data: { type: 'text', content: 'Banco Exemplo S.A.', bold: true, size: 2, align: 'center', invert: false, underline: false },
    },
    {
      id: 'bankdoc', locked: false,
      geometry: { x: 26, y: 10, w: 44, h: 4 },
      data: { type: 'text', content: 'CNPJ: 00.000.000/0001-00', bold: false, size: 1, align: 'center', invert: false, underline: false },
    },
    {
      id: 'nossonum', locked: false, label: 'Nosso Número',
      geometry: { x: 72, y: 2, w: 24, h: 14 },
      data: { type: 'row', cells: [
        { text: 'Nosso Nº', width: 100, align: 'right', bold: false },
      ]},
    },

    // ── Divider ───────────────────────────────────────────────
    {
      id: 'div1', locked: false,
      geometry: { x: 2, y: 17, w: 94, h: 2 },
      data: { type: 'divider', style: 'line', char: '' },
    },

    // ── Row 2: Beneficiário | Pagador | Vencimento + Valor ───
    {
      id: 'bene_label', locked: false,
      geometry: { x: 2, y: 20, w: 30, h: 4 },
      data: { type: 'text', content: 'BENEFICIÁRIO', bold: true, size: 1, align: 'left', invert: false, underline: false },
    },
    {
      id: 'bene_name', locked: false,
      geometry: { x: 2, y: 25, w: 30, h: 4 },
      data: { type: 'text', content: '', bold: false, size: 1, align: 'left', invert: false, underline: false, variable: 'beneficiaryName' },
    },
    {
      id: 'payer_label', locked: false,
      geometry: { x: 34, y: 20, w: 30, h: 4 },
      data: { type: 'text', content: 'PAGADOR', bold: true, size: 1, align: 'left', invert: false, underline: false },
    },
    {
      id: 'payer_name', locked: false,
      geometry: { x: 34, y: 25, w: 30, h: 4 },
      data: { type: 'text', content: '', bold: false, size: 1, align: 'left', invert: false, underline: false, variable: 'payerName' },
    },
    {
      id: 'due_label', locked: false,
      geometry: { x: 66, y: 20, w: 30, h: 4 },
      data: { type: 'text', content: 'VENCIMENTO', bold: true, size: 1, align: 'right', invert: false, underline: false },
    },
    {
      id: 'due_value', locked: false,
      geometry: { x: 66, y: 25, w: 30, h: 4 },
      data: { type: 'text', content: '', bold: false, size: 1, align: 'right', invert: false, underline: false, variable: 'dueDate' },
    },

    // ── Divider ───────────────────────────────────────────────
    {
      id: 'div2', locked: false,
      geometry: { x: 2, y: 31, w: 94, h: 2 },
      data: { type: 'divider', style: 'dashed', char: '' },
    },

    // ── Row 3: Barcode (left 2/3) + QR + Amount (right 1/3) ──
    {
      id: 'barcode', locked: false, label: 'Código de barras ITF',
      geometry: { x: 2, y: 35, w: 62, h: 28 },
      data: { type: 'barcode', data: '', barcodeType: 'ITF', height: 60, moduleWidth: 2, hriPosition: 'none', align: 'center', variable: 'barcode' },
    },
    {
      id: 'amount_label', locked: false,
      geometry: { x: 66, y: 35, w: 30, h: 5 },
      data: { type: 'text', content: 'VALOR', bold: true, size: 1, align: 'center', invert: false, underline: false },
    },
    {
      id: 'amount_value', locked: false,
      geometry: { x: 66, y: 41, w: 30, h: 7 },
      data: { type: 'text', content: '', bold: true, size: 2, align: 'center', invert: false, underline: false, variable: 'amount' },
    },
    {
      id: 'qr', locked: false, label: 'QR Code Pix',
      geometry: { x: 68, y: 50, w: 26, h: 26 },
      data: { type: 'qrcode', data: '', size: 5, errorLevel: 'M', align: 'center', variable: 'pixPayload' },
    },

    // ── Spacer + cut ──────────────────────────────────────────
    {
      id: 'spacer', locked: false,
      geometry: { x: 2, y: 68, w: 94, h: 8 },
      data: { type: 'spacer', lines: 2 },
    },
  ],
};
