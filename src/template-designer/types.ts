import type {
  TextAlign,
  BarcodeType,
  ImageDitherMode,
  QRErrorLevel,
  DividerStyle,
  PrintOrientation,
  PrinterModel,
} from '../types';

// ─────────────────────────────────────────────────────────────
//  Template Designer — Types
// ─────────────────────────────────────────────────────────────

export type DesignerBlockType =
  | 'text'
  | 'barcode'
  | 'qrcode'
  | 'image'
  | 'divider'
  | 'row'
  | 'box'       // decorative bordered box
  | 'spacer';

// ── Block position & size on the paper canvas ─────────────────

export interface BlockGeometry {
  /** X position in mm from left edge of paper */
  x: number;
  /** Y position in mm from top of paper */
  y: number;
  /** Width in mm */
  w: number;
  /** Height in mm — auto for most blocks */
  h: number;
}

// ── Block data variants ───────────────────────────────────────

export interface TextBlockData {
  type: 'text';
  content: string;
  bold: boolean;
  size: 1 | 2 | 3 | 4;
  align: TextAlign;
  invert: boolean;
  underline: boolean;
  /** Variable binding — value comes from print-time data */
  variable?: string;
}

export interface BarcodeBlockData {
  type: 'barcode';
  data: string;
  variable?: string;
  barcodeType: BarcodeType;
  height: number;
  moduleWidth: 1 | 2 | 3 | 4 | 5 | 6;
  hriPosition: 'none' | 'above' | 'below' | 'both';
  align: TextAlign;
}

export interface QRCodeBlockData {
  type: 'qrcode';
  data: string;
  variable?: string;
  size: number;
  errorLevel: QRErrorLevel;
  align: TextAlign;
}

export interface ImageBlockData {
  type: 'image';
  /** URI, require() result as string ref, or base64 */
  source: string;
  /** Width in dots (0 = fit to block width) */
  widthDots: number;
  dither: ImageDitherMode;
  align: TextAlign;
}

export interface DividerBlockData {
  type: 'divider';
  style: DividerStyle;
  char: string;
}

export interface RowBlockData {
  type: 'row';
  cells: Array<{
    text: string;
    variable?: string;
    width: number;
    align: TextAlign;
    bold: boolean;
  }>;
}

export interface BoxBlockData {
  type: 'box';
  /** Character used for top/bottom border */
  hChar: string;
  /** Character used for left/right border */
  vChar: string;
  /** Lines of text inside the box */
  lines: string[];
}

export interface SpacerBlockData {
  type: 'spacer';
  lines: number;
}

export type BlockData =
  | TextBlockData
  | BarcodeBlockData
  | QRCodeBlockData
  | ImageBlockData
  | DividerBlockData
  | RowBlockData
  | BoxBlockData
  | SpacerBlockData;

// ── Full block (geometry + data) ──────────────────────────────

export interface DesignerBlock {
  id: string;
  geometry: BlockGeometry;
  data: BlockData;
  locked: boolean;
  label?: string; // user-facing name
}

// ── Template definition ───────────────────────────────────────

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  orientation: PrintOrientation;
  printerModel: PrinterModel;
  /** Paper width in mm */
  paperWidth: 58 | 80;
  /** Estimated paper length in mm (for canvas height) */
  canvasHeight: number;
  blocks: DesignerBlock[];
  variables: TemplateVariable[];
  createdAt: string;
  updatedAt: string;
  version: string;
}

// ── Paper geometry helpers ────────────────────────────────────

/** mm → screen pixels at a given scale */
export function mmToPx(mm: number, scale: number): number {
  return mm * scale;
}

/** screen pixels → mm at a given scale */
export function pxToMm(px: number, scale: number): number {
  return px / scale;
}

/** Snap mm value to grid */
export function snapToGrid(mm: number, gridMm: number): number {
  return Math.round(mm / gridMm) * gridMm;
}

/** Estimated block height in mm based on content */
export function estimateBlockHeightMm(data: BlockData): number {
  switch (data.type) {
    case 'text':    return 4 * (data.size ?? 1);
    case 'barcode': return data.height / 8 + 4;
    case 'qrcode':  return (data.size ?? 4) * 3;
    case 'image':   return 20;
    case 'divider': return 2;
    case 'row':     return 4;
    case 'box':     return (data.lines.length + 2) * 4;
    case 'spacer':  return data.lines * 3.6;
    default:        return 6;
  }
}

// ── Block type metadata ───────────────────────────────────────

export const BLOCK_META: Record<DesignerBlockType, {
  icon:  string;
  label: string;
  color: string;
  defaultW: number; // mm
}> = {
  text:    { icon: 'T',  label: 'Texto',     color: '#7c6ef0', defaultW: 70 },
  barcode: { icon: '▦',  label: 'Barcode',   color: '#f59e0b', defaultW: 75 },
  qrcode:  { icon: '⬛', label: 'QR Code',   color: '#8b5cf6', defaultW: 25 },
  image:   { icon: '🖼', label: 'Imagem',    color: '#ec4899', defaultW: 30 },
  divider: { icon: '─',  label: 'Divisor',   color: '#6b7280', defaultW: 75 },
  row:     { icon: '▤',  label: 'Colunas',   color: '#10b981', defaultW: 75 },
  box:     { icon: '□',  label: 'Caixa',     color: '#0ea5e9', defaultW: 70 },
  spacer:  { icon: '↕',  label: 'Espaço',    color: '#4b5563', defaultW: 75 },
};

// ── Default block factories ───────────────────────────────────

export function createDefaultBlock(
  type: DesignerBlockType,
  x = 2,
  y = 2,
  paperWidth = 80,
): DesignerBlock {
  const meta = BLOCK_META[type];
  const w = Math.min(meta.defaultW, paperWidth - x - 2);

  let data: BlockData;
  switch (type) {
    case 'text':
      data = { type, content: 'Novo texto', bold: false, size: 1, align: 'left', invert: false, underline: false };
      break;
    case 'barcode':
      data = { type, data: '00190000090010248002700440003000000027630000125000', barcodeType: 'ITF', height: 60, moduleWidth: 2, hriPosition: 'none', align: 'center' };
      break;
    case 'qrcode':
      data = { type, data: 'https://exemplo.com', size: 5, errorLevel: 'M', align: 'center' };
      break;
    case 'image':
      data = { type, source: '', widthDots: 0, dither: 'floyd-steinberg', align: 'center' };
      break;
    case 'divider':
      data = { type, style: 'line', char: '' };
      break;
    case 'row':
      data = { type, cells: [{ text: 'Col 1', width: 50, align: 'left', bold: false }, { text: 'Col 2', width: 50, align: 'right', bold: false }] };
      break;
    case 'box':
      data = { type, hChar: '─', vChar: '│', lines: ['Conteúdo da caixa'] };
      break;
    case 'spacer':
      data = { type, lines: 2 };
      break;
  }

  const h = estimateBlockHeightMm(data);

  return {
    id:       Math.random().toString(36).slice(2, 9),
    geometry: { x, y, w, h },
    data,
    locked:   false,
  };
}

// ── TypeScript code generator ─────────────────────────────────

export function generateTypeScriptCode(template: TemplateDefinition): string {
  const varList = template.variables.map(v => `  ${v.name}: string; // ${v.description}`).join('\n');
  const hasVars = template.variables.length > 0;

  const blockLines = template.blocks.map(block => {
    const { data } = block;

    switch (data.type) {
      case 'text': {
        const opts: string[] = [];
        if (data.bold)      opts.push('bold: true');
        if (data.size > 1)  opts.push(`size: ${data.size}`);
        if (data.align !== 'left') opts.push(`align: '${data.align}'`);
        if (data.invert)    opts.push('invert: true');
        if (data.underline) opts.push('underline: true');
        const content = data.variable ? `data.${data.variable}` : `'${data.content}'`;
        const optsStr = opts.length ? `, { ${opts.join(', ')} }` : '';
        return `    .text(${content}${optsStr})`;
      }

      case 'barcode': {
        const d = data.variable ? `data.${data.variable}` : `'${data.data}'`;
        const opts = [
          `type: '${data.barcodeType}'`,
          `height: ${data.height}`,
          `width: ${data.moduleWidth}`,
          `hriPosition: '${data.hriPosition}'`,
          `align: '${data.align}'`,
        ].join(', ');
        return `    .barcode(${d}, { ${opts} })`;
      }

      case 'qrcode': {
        const d = data.variable ? `data.${data.variable}` : `'${data.data}'`;
        return `    .qrCode(${d}, { size: ${data.size}, errorLevel: '${data.errorLevel}', align: '${data.align}' })`;
      }

      case 'image': {
        const src = data.source.startsWith('require')
          ? data.source
          : `'${data.source}'`;
        const w = data.widthDots ? `, width: ${data.widthDots}` : '';
        return `    .image({ source: ${src}${w}, dither: '${data.dither}', align: '${data.align}' })`;
      }

      case 'divider': {
        if (data.char) return `    .divider({ style: '${data.style}', char: '${data.char}' })`;
        if (data.style !== 'line') return `    .divider({ style: '${data.style}' })`;
        return `    .divider()`;
      }

      case 'row': {
        const cells = data.cells.map(c => {
          const t = c.variable ? `data.${c.variable}` : `'${c.text}'`;
          const b = c.bold ? ', bold: true' : '';
          return `{ text: ${t}, width: ${c.width}, align: '${c.align}'${b} }`;
        });
        return `    .row([\n      ${cells.join(',\n      ')},\n    ])`;
      }

      case 'spacer':
        return `    .feed(${data.lines})`;

      default:
        return `    // ${data.type} block`;
    }
  }).join('\n');

  const interfacePart = hasVars
    ? `export interface ${toPascalCase(template.name)}Data {\n${varList}\n}\n\n`
    : '';

  const fnParam = hasVars ? `data: ${toPascalCase(template.name)}Data` : '';
  const fnArg   = hasVars ? ', data' : '';

  return `// ──────────────────────────────────────────────────────
//  Template: ${template.name}
//  ${template.description}
//  Gerado automaticamente pelo Siga Printer Designer
//  Modelo: ${template.printerModel} | ${template.paperWidth}mm | ${template.orientation}
// ──────────────────────────────────────────────────────

import { ThermalPrinter } from 'siga-printer';
import type { ConnectedThermalPrinter, PrintResult } from 'siga-printer';

${interfacePart}export class ${toPascalCase(template.name)}Template {

  static async build(
    printer: ThermalPrinter,${hasVars ? `\n    ${fnParam},` : ''}
  ): Promise<ThermalPrinter> {
    printer
      .init()
      .setOrientation('${template.orientation}')
${blockLines}
      .cut('full', { feed: 4 });

    return printer;
  }

  static async print(
    printer: ConnectedThermalPrinter,${hasVars ? `\n    ${fnParam},` : ''}
  ): Promise<PrintResult> {
    await ${toPascalCase(template.name)}Template.build(printer${fnArg});
    return printer.print();
  }
}
`;
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}
