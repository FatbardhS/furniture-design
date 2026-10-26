import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { Bom } from '../domain/bom';
import { HANDLE_LABELS, HINGE_LABELS, materialById, SLIDE_LABELS } from '../domain/catalog';
import type { Layout as CabinetLayout } from '../domain/types';
import { formatMoney, type Quote } from '../domain/pricing';
import type { CabinetConfig, PricingConfig, Unit } from '../domain/types';
import { fmtLen, toUnit } from '../domain/units';

interface ReportInput {
  config: CabinetConfig;
  pricing: PricingConfig;
  layout: CabinetLayout;
  bom: Bom;
  quote: Quote;
  unit: Unit;
  /** PNG data URL of the 3D view. */
  snapshot?: string;
}

const INK: [number, number, number] = [28, 25, 23];
const MUTED: [number, number, number] = [120, 113, 108];
const ACCENT: [number, number, number] = [176, 122, 72];
const M = 14; // page margin, mm

export function buildQuotePdf({ config, pricing, layout, bom, quote, unit, snapshot }: ReportInput) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const money = (v: number) => formatMoney(v, pricing.currency);
  const L = (mm: number) => fmtLen(mm, unit);
  const now = new Date();
  const quoteNo = `Q-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  // --- Header ---
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageW, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text('Cabinet Quote & Bill of Materials', M, 11);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  doc.text(`${quoteNo}  ·  ${now.toLocaleDateString('en-GB')}`, M, 18);
  doc.setFont('helvetica', 'bold').setFontSize(15);
  doc.text(money(quote.grandTotal), pageW - M, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text(pricing.vatPercent > 0 ? `incl. ${pricing.vatPercent}% VAT` : 'excl. VAT', pageW - M, 18, { align: 'right' });

  // --- Snapshot + configuration summary ---
  let y = 32;
  const imgW = 82;
  let imgH = 0;
  if (snapshot) {
    const props = doc.getImageProperties(snapshot);
    imgH = Math.min(100, (imgW * props.height) / props.width);
    const drawW = (imgH * props.width) / props.height;
    doc.setFillColor(245, 244, 242);
    doc.roundedRect(M, y, imgW, imgH, 2, 2, 'F');
    doc.addImage(snapshot, 'PNG', M + (imgW - drawW) / 2, y, drawW, imgH);
  }

  const doorText =
    config.doorType === 'none'
      ? 'Open (no doors)'
      : config.doorType === 'hinged' && config.doorLayout === 'perColumn'
        ? `${layout.doors.count} × hinged, per section (largest ${L(layout.doors.width)} × ${L(layout.doors.height)})`
        : `${layout.doors.count} × ${config.doorType} (${L(layout.doors.width)} × ${L(layout.doors.height)})`;
  const specRows: RowInput[] = [
    ['Overall size (W × H × D)', `${L(config.width)} × ${L(config.height)} × ${L(config.depth)}`],
    ['Interior (W × H × D)', `${L(layout.interior.width)} × ${L(layout.interior.height)} × ${L(layout.interior.depth)}`],
    ['Board / back thickness', `${config.thickness} mm / ${config.backThickness} mm`],
    ['Plinth', config.plinthHeight ? L(config.plinthHeight) : 'None'],
    ['Columns', `${config.columns.length} × ${L(layout.interior.columnWidth)}`],
    ['Doors', doorText],
    ['Front finish', `${materialById(config.frontFinish.materialId).name} (${config.frontFinish.color})`],
    ['Carcass finish', `${materialById(config.carcassFinish.materialId).name} (${config.carcassFinish.color})`],
    ['Handles', config.handleType === 'none' ? HANDLE_LABELS.none : `${HANDLE_LABELS[config.handleType]}, ${config.handleFinish}`],
    ...(config.doorType === 'hinged' ? [['Hinges', `${HINGE_LABELS[config.hingeType]} × ${layout.doors.hingeTotal} total`]] : []),
    ['Drawer slides', SLIDE_LABELS[config.slideType]],
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: snapshot ? M + imgW + 6 : M, right: M },
    body: specRows,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 }, textColor: INK },
    columnStyles: { 0: { textColor: MUTED, cellWidth: 36 } },
  });
  y = Math.max(y + imgH, lastY(doc)) + 8;

  // --- Interior per column ---
  heading(doc, 'Interior layout', y);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['Column', 'Shelves', 'Hanging rods', 'Drawers', 'Positions from interior floor']],
    body: config.columns.map((col, i) => {
      const count = (t: string) => col.items.filter((it) => it.type === t).length;
      const positions = [...col.items]
        .sort((a, b) => a.y - b.y)
        .map((it) => `${it.type}@${+toUnit(it.y, unit).toFixed(1)}${it.type === 'drawer' ? `(h${+toUnit(it.height ?? 0, unit).toFixed(1)})` : ''}`)
        .join(', ');
      return [`${i + 1}`, count('shelf'), count('rod'), count('drawer'), positions || '—'];
    }),
    ...tableStyle(),
    columnStyles: { 4: { fontSize: 7, textColor: MUTED } },
  });
  y = lastY(doc) + 8;

  // --- Cost summary ---
  heading(doc, 'Price quote', y);
  const costRows: RowInput[] = [
    ...quote.materialLines.map((l) => [l.label, l.detail, money(l.amount)]),
    ...bom.hardware.map((h) => [h.name, `${h.qty} ${h.unit} × ${h.unitPrice.toFixed(2)}`, money(h.total)]),
    ['Workmanship', quote.laborDetail, money(quote.laborSubtotal)],
    ...(quote.installation > 0 ? [['Installation & delivery', 'Fixed fee', money(quote.installation)]] : []),
  ];
  const totals: RowInput[] = [
    ['Material subtotal', '', money(quote.materialSubtotal)],
    ['Hardware subtotal', '', money(quote.hardwareSubtotal)],
    ['Labor & services', '', money(quote.laborSubtotal + quote.installation)],
    ['Net total', '', money(quote.net)],
    ...(pricing.vatPercent > 0 ? [[`VAT ${pricing.vatPercent}%`, '', money(quote.vat)]] : []),
    ['GRAND TOTAL', '', money(quote.grandTotal)],
  ];
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['Item', 'Calculation', 'Amount']],
    body: costRows,
    foot: totals,
    showFoot: 'lastPage',
    ...tableStyle(),
    footStyles: { fillColor: [245, 244, 242], textColor: INK, fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 1: { textColor: MUTED }, 2: { halign: 'right', cellWidth: 28 } },
    didParseCell: (d) => {
      if (d.section === 'foot' && d.column.index === 2) d.cell.styles.halign = 'right';
      if (d.section === 'foot' && d.row.index === totals.length - 1) {
        d.cell.styles.fillColor = INK;
        d.cell.styles.textColor = [255, 255, 255];
        d.cell.styles.fontSize = 10;
      }
    },
  });

  // --- BOM ---
  y = lastY(doc) + 10;
  if (y > doc.internal.pageSize.getHeight() - 70) {
    doc.addPage();
    y = M + 4;
  }
  heading(doc, 'Bill of materials — boards', y);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['Material', 'Parts', 'Net area m²', `+${pricing.wastePercent}% waste m²`, 'Sheets 2800×2070']],
    body: [
      ...bom.boards.map((b) => [b.label, b.parts, b.netArea.toFixed(3), b.grossArea.toFixed(3), b.sheets]),
      ['Edge banding (kant)', '', `${bom.edgeBandingM.toFixed(2)} m`, '', ''],
    ],
    ...tableStyle(),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });
  y = lastY(doc) + 8;

  heading(doc, 'Bill of materials — hardware', y);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['Item', 'Quantity', 'Unit price', 'Total']],
    body: bom.hardware.length
      ? bom.hardware.map((h) => [h.name, `${h.qty} ${h.unit}`, money(h.unitPrice), money(h.total)])
      : [['No hardware required', '', '', '']],
    ...tableStyle(),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  y = lastY(doc) + 8;

  heading(doc, `Cut list (${unit}) — length along grain`, y);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['#', 'Part', 'Material', 'Length', 'Width', 'Thk mm', 'Qty', 'Edge L/S', 'm²']],
    body: bom.cutList.map((r, i) => [
      i + 1,
      r.name,
      r.material,
      +toUnit(r.length, unit).toFixed(1),
      +toUnit(r.width, unit).toFixed(1),
      r.thickness,
      r.qty,
      `${r.bandLong}/${r.bandShort}`,
      r.area.toFixed(3),
    ]),
    ...tableStyle(),
    columnStyles: {
      0: { cellWidth: 7, textColor: MUTED },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'center' },
      8: { halign: 'right' },
    },
  });

  if (layout.warnings.length) {
    y = lastY(doc) + 8;
    heading(doc, 'Design notes', y);
    autoTable(doc, {
      startY: y + 2,
      margin: { left: M, right: M },
      body: layout.warnings.map((w) => [w.level.toUpperCase(), w.message]),
      theme: 'plain',
      styles: { fontSize: 8, textColor: INK },
      columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold', textColor: ACCENT } },
    });
  }

  // --- Footer on every page ---
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7).setTextColor(...MUTED);
    const h = doc.internal.pageSize.getHeight();
    doc.text(`${quoteNo} · Prices are estimates and valid for 30 days.`, M, h - 8);
    doc.text(`Page ${i} / ${pages}`, pageW - M, h - 8, { align: 'right' });
  }

  return { doc, fileName: `${quoteNo}.pdf` };
}

function heading(doc: jsPDF, text: string, y: number) {
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK);
  doc.text(text, M, y);
  doc.setDrawColor(...ACCENT).setLineWidth(0.5);
  doc.line(M, y + 1.2, M + 12, y + 1.2);
}

function tableStyle() {
  return {
    theme: 'striped' as const,
    styles: { fontSize: 8, cellPadding: 1.6, textColor: INK, lineColor: [231, 229, 228] as [number, number, number] },
    headStyles: { fillColor: [68, 64, 60] as [number, number, number], textColor: 255, fontStyle: 'bold' as const, fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 250, 249] as [number, number, number] },
  };
}

const lastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export function exportQuotePdf(input: ReportInput) {
  const { doc, fileName } = buildQuotePdf(input);
  doc.save(fileName);
}
