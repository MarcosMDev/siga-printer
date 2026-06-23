import { ThermalPrinter } from '../builder/ThermalPrinter';
import type { ConnectedThermalPrinter } from '../builder/ThermalPrinter';
import type { PrintResult } from '../types';

// ─────────────────────────────────────────────────────────────
//  ReceiptTemplate
//  Cupom / recibo genérico com itens, totais e rodapé.
// ─────────────────────────────────────────────────────────────

export interface ReceiptItem {
  name:        string;
  quantity:    number;
  unitPrice:   string;
  totalPrice:  string;
  /** Optional: code or SKU */
  code?:       string;
  /** Show unit price line below the item name */
  showUnit?:   boolean;
}

export interface ReceiptTotals {
  subtotal?:  string;
  discount?:  string;
  tax?:       string;
  shipping?:  string;
  total:      string;
}

export interface ReceiptPayment {
  method:   string;  // 'Dinheiro', 'Débito', 'Crédito', 'Pix'
  amount:   string;
  change?:  string;  // Troco
  installments?: number;
  cardLast4?: string;
}

export interface ReceiptData {
  company: {
    name:     string;
    cnpj?:    string;
    address?: string;
    phone?:   string;
    logoSource?: string | number;
  };
  customer?: {
    name?:     string;
    document?: string;
  };
  order?: {
    number:    string;
    date:      string;
    operator?: string;
    terminal?: string;
  };
  items:     ReceiptItem[];
  totals:    ReceiptTotals;
  payments:  ReceiptPayment[];
  footer?: {
    message?: string;
    website?: string;
    /** Show QR code pointing to URL */
    qrUrl?:   string;
  };
}

export class ReceiptTemplate {
  static async build(
    printer: ThermalPrinter,
    data:    ReceiptData,
  ): Promise<ThermalPrinter> {
    const { company, customer, order, items, totals, payments, footer } = data;

    printer.init();

    // ── Header ───────────────────────────────────────────────
    if (company.logoSource) {
      printer
        .image({ source: company.logoSource, width: 180, align: 'center', dither: 'atkinson' })
        .feed(1);
    }

    printer.text(company.name, { bold: true, size: 2, align: 'center' });

    if (company.cnpj)    printer.text(`CNPJ: ${company.cnpj}`,      { align: 'center' });
    if (company.address) printer.text(company.address,               { align: 'center' });
    if (company.phone)   printer.text(`Tel: ${company.phone}`,       { align: 'center' });

    printer.divider();

    // ── Order info ───────────────────────────────────────────
    if (order) {
      printer.row([
        { text: `Pedido: ${order.number}`, width: 55, align: 'left' },
        { text: order.date,                width: 45, align: 'right' },
      ]);

      if (order.operator || order.terminal) {
        printer.row([
          { text: order.operator ? `Op: ${order.operator}` : '', width: 55, align: 'left'  },
          { text: order.terminal ? `Cx: ${order.terminal}` : '', width: 45, align: 'right' },
        ]);
      }

      printer.divider();
    }

    // ── Customer ─────────────────────────────────────────────
    if (customer && (customer.name || customer.document)) {
      printer.row([
        { text: customer.name     ?? '',  width: 60, align: 'left'  },
        { text: customer.document ?? '',  width: 40, align: 'right' },
      ]);
      printer.divider();
    }

    // ── Items ────────────────────────────────────────────────
    printer.row([
      { text: 'ITEM',   width: 55, align: 'left',  bold: true },
      { text: 'QTD',    width: 15, align: 'center', bold: true },
      { text: 'TOTAL',  width: 30, align: 'right',  bold: true },
    ]);
    printer.divider({ style: 'dashed' });

    for (const item of items) {
      // Item name line (truncated if needed)
      printer.row([
        { text: item.name,        width: 55, align: 'left'   },
        { text: `${item.quantity}x`, width: 15, align: 'center' },
        { text: item.totalPrice,  width: 30, align: 'right'  },
      ]);

      // Optional unit price line
      if (item.showUnit !== false && item.quantity > 1) {
        printer.text(` un. ${item.unitPrice}`, { size: 1 });
      }
    }

    printer.divider();

    // ── Totals ───────────────────────────────────────────────
    if (totals.subtotal) {
      printer.row([
        { text: 'Subtotal', width: 65, align: 'left'  },
        { text: totals.subtotal, width: 35, align: 'right' },
      ]);
    }
    if (totals.discount) {
      printer.row([
        { text: 'Desconto', width: 65, align: 'left'  },
        { text: `- ${totals.discount}`, width: 35, align: 'right' },
      ]);
    }
    if (totals.tax) {
      printer.row([
        { text: 'Impostos', width: 65, align: 'left'  },
        { text: totals.tax, width: 35, align: 'right' },
      ]);
    }
    if (totals.shipping) {
      printer.row([
        { text: 'Frete', width: 65, align: 'left'  },
        { text: totals.shipping, width: 35, align: 'right' },
      ]);
    }

    printer.divider({ style: 'dashed' });

    printer.row([
      { text: 'TOTAL', width: 60, align: 'left',  bold: true },
      { text: totals.total, width: 40, align: 'right', bold: true },
    ]);

    printer.divider();

    // ── Payments ─────────────────────────────────────────────
    printer.section('PAGAMENTO');

    for (const pay of payments) {
      let label = pay.method;
      if (pay.cardLast4)     label += ` *${pay.cardLast4}`;
      if (pay.installments && pay.installments > 1) label += ` ${pay.installments}x`;

      printer.row([
        { text: label,       width: 60, align: 'left'  },
        { text: pay.amount,  width: 40, align: 'right', bold: true },
      ]);

      if (pay.change) {
        printer.row([
          { text: 'Troco', width: 60, align: 'left' },
          { text: pay.change, width: 40, align: 'right' },
        ]);
      }
    }

    printer.divider();

    // ── Footer ───────────────────────────────────────────────
    if (footer) {
      if (footer.message) {
        printer.text(footer.message, { align: 'center' });
      }
      if (footer.website) {
        printer.text(footer.website, { align: 'center' });
      }
      if (footer.qrUrl) {
        printer.feed(1);
        printer.qrCode(footer.qrUrl, { size: 4, align: 'center' });
      }
    }

    printer.feed(2);
    printer.cut('full', { feed: 4 });

    return printer;
  }

  static async print(
    printer: ConnectedThermalPrinter,
    data:    ReceiptData,
  ): Promise<PrintResult> {
    await ReceiptTemplate.build(printer, data);
    return printer.print();
  }
}
