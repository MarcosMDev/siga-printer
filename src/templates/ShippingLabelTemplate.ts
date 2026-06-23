import { ThermalPrinter } from '../builder/ThermalPrinter';
import type { ConnectedThermalPrinter } from '../builder/ThermalPrinter';
import type { PrintResult } from '../types';

// ─────────────────────────────────────────────────────────────
//  ShippingLabelTemplate
//  Etiqueta de envio / despacho
// ─────────────────────────────────────────────────────────────

export interface ShippingLabelData {
  sender: {
    name:    string;
    address: string;
    city:    string;
    state:   string;
    zip:     string;
    phone?:  string;
  };
  recipient: {
    name:    string;
    address: string;
    city:    string;
    state:   string;
    zip:     string;
    phone?:  string;
    cpf?:    string;
  };
  package: {
    trackingCode:    string;
    service:         string;  // 'PAC', 'SEDEX', etc.
    weight?:         string;
    dimensions?:     string;
    declaredValue?:  string;
    orderNumber?:    string;
    instructions?:   string;
  };
}

export class ShippingLabelTemplate {
  static async build(
    printer: ThermalPrinter,
    data:    ShippingLabelData,
  ): Promise<ThermalPrinter> {
    const { sender, recipient, pkg } = { ...data, pkg: data.package };

    printer.init();

    // ── Service / title ──────────────────────────────────────
    printer.text(pkg.service, { bold: true, size: 3, align: 'center' });

    if (pkg.orderNumber) {
      printer.text(`Pedido: ${pkg.orderNumber}`, { align: 'center', bold: true });
    }

    printer.divider({ style: 'double' });

    // ── Tracking barcode ─────────────────────────────────────
    printer.barcode(pkg.trackingCode, {
      type:        'CODE128',
      height:      60,
      hriPosition: 'below',
      align:       'center',
    });

    printer.divider();

    // ── Recipient ────────────────────────────────────────────
    printer.text('DESTINATÁRIO', { bold: true, size: 1 });
    printer.text(recipient.name,    { bold: true, size: 2 });
    printer.text(recipient.address);
    printer.text(`${recipient.city} - ${recipient.state}`);
    printer.text(`CEP: ${recipient.zip}`, { bold: true });

    if (recipient.phone) printer.text(`Tel: ${recipient.phone}`);
    if (recipient.cpf)   printer.text(`CPF: ${recipient.cpf}`);

    printer.divider({ style: 'dashed' });

    // ── Sender ───────────────────────────────────────────────
    printer.text('REMETENTE', { bold: true });
    printer.text(`${sender.name} — ${sender.city}/${sender.state}`);
    printer.text(`CEP: ${sender.zip}`);
    if (sender.phone) printer.text(`Tel: ${sender.phone}`);

    printer.divider({ style: 'dashed' });

    // ── Package info ─────────────────────────────────────────
    const packageInfoCells: Array<{ text: string; width: number; align: 'left' | 'right' }> = [];

    if (pkg.weight) {
      packageInfoCells.push({ text: `Peso: ${pkg.weight}`, width: 50, align: 'left' });
    }
    if (pkg.dimensions) {
      packageInfoCells.push({ text: `Dim: ${pkg.dimensions}`, width: 50, align: 'right' });
    }

    if (packageInfoCells.length > 0) {
      printer.row(packageInfoCells);
    }

    if (pkg.declaredValue) {
      printer.text(`Valor declarado: ${pkg.declaredValue}`);
    }

    if (pkg.instructions) {
      printer.divider({ style: 'dashed' });
      printer.text(`⚠ ${pkg.instructions}`, { bold: true, align: 'center' });
    }

    printer.feed(2);
    printer.cut('full', { feed: 4 });

    return printer;
  }

  static async print(
    printer: ConnectedThermalPrinter,
    data:    ShippingLabelData,
  ): Promise<PrintResult> {
    await ShippingLabelTemplate.build(printer, data);
    return printer.print();
  }
}
