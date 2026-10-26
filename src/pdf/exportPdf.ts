import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { Bom } from '../domain/bom';
import { FRONT_STYLE_LABELS, HANDLE_FINISH_LABELS, HANDLE_LABELS, HINGE_LABELS, materialById, SLIDE_LABELS, UNIT_LABELS } from '../domain/catalog';
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
const ITEM_SHORT = { shelf: 'raft', rod: 'shufër', drawer: 'sirtar' } as const;
const LEVEL_LABELS = { error: 'GABIM', warn: 'KUJDES', info: 'INFO' } as const;
const DOOR_TYPE_LABELS = { none: 'pa dyer', hinged: 'me pagllama', sliding: 'rrëshqitëse' } as const;
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
  doc.text('Oferta & lista e materialeve', M, 11);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  doc.text(`${quoteNo}  ·  ${now.toLocaleDateString('de-DE')}`, M, 18);
  doc.setFont('helvetica', 'bold').setFontSize(15);
  doc.text(money(quote.grandTotal), pageW - M, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text(pricing.vatPercent > 0 ? `me ${pricing.vatPercent}% TVSH` : 'pa TVSH', pageW - M, 18, { align: 'right' });

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
      ? 'E hapur (pa dyer)'
      : config.doorType === 'hinged' && config.doorLayout === 'perColumn'
        ? `${layout.doors.count} dyer me pagllama, për seksion (më e madhja ${L(layout.doors.width)} × ${L(layout.doors.height)})`
        : `${layout.doors.count} × ${DOOR_TYPE_LABELS[config.doorType]} (${L(layout.doors.width)} × ${L(layout.doors.height)})`;
  const specRows: RowInput[] = [
    ['Përmasat (Gj × L × Th)', `${L(config.width)} × ${L(config.height)} × ${L(config.depth)}`],
    ['Brendësia (Gj × L × Th)', `${L(layout.interior.width)} × ${L(layout.interior.height)} × ${L(layout.interior.depth)}`],
    ['Trashësia pllakë / shpinë', `${config.thickness} mm / ${config.backThickness} mm`],
    ['Bazamenti', config.plinthHeight ? L(config.plinthHeight) : 'Pa bazament'],
    ['Ndërtimi', config.construction === 'modules' ? 'Module të veçanta' : 'Një korpus me ndarëse'],
    ['Seksionet (gjerësia e brendshme)', layout.interior.columnWidths.map((w) => L(w)).join(' + ')],
    ['Dyert', doorText],
    ['Materiali i fronteve', `${materialById(config.frontFinish.materialId).name} (${config.frontFinish.color})`],
    ['Materiali i korpusit', `${materialById(config.carcassFinish.materialId).name} (${config.carcassFinish.color})`],
    ['Dizajni i dyerve', FRONT_STYLE_LABELS[config.frontStyle]],
    ['Dorezat', config.handleType === 'none' ? HANDLE_LABELS.none : `${HANDLE_LABELS[config.handleType]}, ${HANDLE_FINISH_LABELS[config.handleFinish].toLowerCase()}`],
    ...(config.doorType === 'hinged' ? [['Pagllamat', `${HINGE_LABELS[config.hingeType]} × ${layout.doors.hingeTotal} gjithsej`]] : []),
    ['Shinat e sirtarëve', SLIDE_LABELS[config.slideType]],
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
  heading(doc, 'Brendësia e seksioneve', y);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['Seksioni', 'Rafte', 'Shufra', 'Sirtarë', 'Pozicionet nga fundi i brendshëm']],
    body: config.columns.map((col, i) => {
      const count = (t: string) => col.items.filter((it) => it.type === t).length;
      const positions = [...col.items]
        .sort((a, b) => a.y - b.y)
        .map((it) => `${ITEM_SHORT[it.type]}@${+toUnit(it.y, unit).toFixed(1)}${it.type === 'drawer' ? `(l${+toUnit(it.height ?? 0, unit).toFixed(1)})` : ''}`)
        .join(', ');
      return [`${i + 1}`, count('shelf'), count('rod'), count('drawer'), positions || '—'];
    }),
    ...tableStyle(),
    columnStyles: { 4: { fontSize: 7, textColor: MUTED } },
  });
  y = lastY(doc) + 8;

  // --- Cost summary ---
  heading(doc, 'Oferta e çmimit', y);
  const costRows: RowInput[] = [
    ...quote.materialLines.map((l) => [l.label, l.detail, money(l.amount)]),
    ...bom.hardware.map((h) => [h.name, `${h.qty} ${UNIT_LABELS[h.unit]} × ${h.unitPrice.toFixed(2)}`, money(h.total)]),
    ['Puna e punëtorisë', quote.laborDetail, money(quote.laborSubtotal)],
    ...(quote.installation > 0 ? [['Montimi & transporti', 'Çmim fiks', money(quote.installation)]] : []),
  ];
  const totals: RowInput[] = [
    ['Nëntotali i materialit', '', money(quote.materialSubtotal)],
    ['Nëntotali i okovëve', '', money(quote.hardwareSubtotal)],
    ['Puna & shërbimet', '', money(quote.laborSubtotal + quote.installation)],
    ['Totali neto', '', money(quote.net)],
    ...(pricing.vatPercent > 0 ? [[`TVSH ${pricing.vatPercent}%`, '', money(quote.vat)]] : []),
    ['TOTALI PËRFUNDIMTAR', '', money(quote.grandTotal)],
  ];
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['Artikulli', 'Llogaritja', 'Shuma']],
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
  heading(doc, 'Lista e materialeve — pllakat', y);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['Materiali', 'Pjesë', 'Neto m²', `+${pricing.wastePercent}% humbje m²`, 'Pllaka 2800×2070']],
    body: [
      ...bom.boards.map((b) => [b.label, b.parts, b.netArea.toFixed(3), b.grossArea.toFixed(3), b.sheets]),
      ['Kanti (shirit)', '', `${bom.edgeBandingM.toFixed(2)} m`, '', ''],
    ],
    ...tableStyle(),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });
  y = lastY(doc) + 8;

  heading(doc, 'Lista e materialeve — okovët', y);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['Artikulli', 'Sasia', 'Çmimi për njësi', 'Totali']],
    body: bom.hardware.length
      ? bom.hardware.map((h) => [h.name, `${h.qty} ${UNIT_LABELS[h.unit]}`, money(h.unitPrice), money(h.total)])
      : [['Nuk nevojiten okovë', '', '', '']],
    ...tableStyle(),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  y = lastY(doc) + 8;

  heading(doc, `Lista e prerjeve (${unit}) — gjatësia sipas fladrës`, y);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M },
    head: [['#', 'Pjesa', 'Materiali', 'Gjatësia', 'Gjerësia', 'Trash. mm', 'Sasia', 'Kanti Gj/Sh', 'm²']],
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
    heading(doc, 'Vërejtje teknike', y);
    autoTable(doc, {
      startY: y + 2,
      margin: { left: M, right: M },
      body: layout.warnings.map((w) => [LEVEL_LABELS[w.level], w.message]),
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
    doc.text(`${quoteNo} · Çmimet janë të përafërta dhe vlejnë 30 ditë.`, M, h - 8);
    doc.text(`Faqja ${i} / ${pages}`, pageW - M, h - 8, { align: 'right' });
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
