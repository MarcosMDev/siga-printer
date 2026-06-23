import { ThermalPrinter } from '../builder/ThermalPrinter';
import type { ConnectedThermalPrinter } from '../builder/ThermalPrinter';
import type { PrintResult } from '../types';

// ─────────────────────────────────────────────────────────────
//  BoletoTemplate
//
//  Ready-to-use template for Brazilian bank slips (boletos).
//  Handles:
//    - Bank header with logo
//    - Beneficiary and payer data
//    - Due date, amount, nosso número
//    - ITF-25 barcode (44-digit or 47-digit)
//    - QR Code Pix (if pixKey provided)
//    - Instructions block
//    - Full cut
//
//  Usage:
//    const printer = await ThermalPrinter.connect({ type: 'usb' });
//    await BoletoTemplate.print(printer, {
//      bank: { name: 'Banco Exemplo S.A.', cnpj: '00.000.000/0001-00' },
//      beneficiary: { name: 'Empresa XYZ', cnpj: '11.111.111/0001-11' },
//      payer: { name: 'João da Silva', document: '123.456.789-00' },
//      boleto: {
//        nossoNumero: '00012345',
//        dueDate: '10/08/2025',
//        amount: 'R$ 1.250,00',
//        barcode: '34191090080000008214800082194207197960000125000',
//        digitableLine: '34191.09008 00000.082148 00082.194207 1 97960000125000',
//        pixKey: '00020126360014BR.GOV.BCB.PIX...',
//      },
//      instructions: [
//        'Não receber após vencimento.',
//        'Multa de 2% ao mês após vencimento.',
//      ],
//    });
// ─────────────────────────────────────────────────────────────

export interface BoletoData {
  bank: {
    name: string;
    cnpj?: string;
    /** Local image URI or require() */
    logoSource?: string | number;
  };
  beneficiary: {
    name: string;
    cnpj?: string;
    cpf?: string;
    address?: string;
  };
  payer: {
    name: string;
    /** CPF or CNPJ */
    document?: string;
    address?: string;
  };
  boleto: {
    nossoNumero: string;
    dueDate: string;
    amount: string;
    /** 44-digit barcode (without spaces or dots) */
    barcode: string;
    /** Human-readable digitable line */
    digitableLine: string;
    /** Pix payload for QR Code (optional) */
    pixKey?: string;
    /** Reference number / document number */
    documentNumber?: string;
    /** Species (Tipo) */
    species?: string;
    /** Acceptance */
    acceptance?: string;
    /** Processing date */
    processingDate?: string;
  };
  instructions?: string[];
  /** Print QR Code for Pix (default: true if pixKey provided) */
  printQR?: boolean;
}

export class BoletoTemplate {
  static async build(
    printer: ThermalPrinter,
    data:    BoletoData,
  ): Promise<ThermalPrinter> {
    const { bank, beneficiary, payer, boleto, instructions } = data;

    printer.init();

    // ── Bank header ──────────────────────────────────────────
    if (bank.logoSource) {
      printer.image({
        source: bank.logoSource,
        width:  200,
        align:  'center',
        dither: 'atkinson', // sharper for logos
      });
      printer.feed(1);
    }

    printer.text(bank.name, {
      bold:  true,
      size:  2,
      align: 'center',
    });

    if (bank.cnpj) {
      printer.text(`CNPJ: ${bank.cnpj}`, { align: 'center' });
    }

    printer.divider();

    // ── Beneficiary ──────────────────────────────────────────
    printer.section('CEDENTE / BENEFICIÁRIO');

    printer.row([
      { text: beneficiary.name, width: 70, align: 'left', bold: true },
      { text: beneficiary.cnpj ?? beneficiary.cpf ?? '', width: 30, align: 'right' },
    ]);

    if (beneficiary.address) {
      printer.text(beneficiary.address, { align: 'left' });
    }

    // ── Boleto fields ────────────────────────────────────────
    printer.divider();

    printer.row([
      { text: 'Nosso Número',   width: 35, align: 'left'  },
      { text: 'Vencimento',     width: 30, align: 'left'  },
      { text: 'Valor',          width: 35, align: 'right' },
    ]);

    printer.row([
      { text: boleto.nossoNumero,  width: 35, align: 'left',  bold: true },
      { text: boleto.dueDate,      width: 30, align: 'left',  bold: true },
      { text: boleto.amount,       width: 35, align: 'right', bold: true },
    ]);

    printer.divider();

    if (boleto.documentNumber || boleto.species || boleto.processingDate) {
      printer.row([
        { text: 'Nº Documento',       width: 40, align: 'left'  },
        { text: 'Espécie',            width: 20, align: 'center'},
        { text: 'Data Processamento', width: 40, align: 'right' },
      ]);

      printer.row([
        { text: boleto.documentNumber  ?? '', width: 40, align: 'left'   },
        { text: boleto.species         ?? '', width: 20, align: 'center' },
        { text: boleto.processingDate  ?? '', width: 40, align: 'right'  },
      ]);

      printer.divider();
    }

    // ── Payer ────────────────────────────────────────────────
    printer.section('SACADO / PAGADOR');

    printer.row([
      { text: payer.name,              width: 70, align: 'left'  },
      { text: payer.document ?? '',    width: 30, align: 'right' },
    ]);

    if (payer.address) {
      printer.text(payer.address);
    }

    printer.divider();

    // ── Instructions ─────────────────────────────────────────
    if (instructions && instructions.length > 0) {
      printer.section('INSTRUÇÕES');
      for (const inst of instructions) {
        printer.text(`• ${inst}`);
      }
      printer.divider();
    }

    // ── Digitable line ───────────────────────────────────────
    printer.text('Linha Digitável:', { bold: true, align: 'center' });
    printer.text(boleto.digitableLine, { align: 'center', size: 1 });
    printer.feed(1);

    // ── ITF-25 Barcode ───────────────────────────────────────
    printer.barcode(boleto.barcode, {
      type:        'ITF',
      height:      60,
      width:       2,
      hriPosition: 'none', // we already printed the digitable line above
      align:       'center',
    });

    // ── Pix QR Code ──────────────────────────────────────────
    if (boleto.pixKey && data.printQR !== false) {
      printer.feed(1);
      printer.text('Pague com Pix:', { bold: true, align: 'center' });
      printer.qrCode(boleto.pixKey, {
        size:       5,
        errorLevel: 'M',
        align:      'center',
      });
    }

    // ── Footer ───────────────────────────────────────────────
    printer.feed(2);
    printer.cut('full', { feed: 4 });

    return printer;
  }

  /**
   * Build and immediately print a boleto.
   */
  static async print(
    printer: ConnectedThermalPrinter,
    data:    BoletoData,
  ): Promise<PrintResult> {
    await BoletoTemplate.build(printer, data);
    return printer.print();
  }
}
