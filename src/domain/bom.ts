import { HANDLE_FINISH_LABELS, HANDLE_LABELS, HINGE_LABELS, materialById, SHEET, SLIDE_LABELS } from './catalog';
import { frontStyleOf } from './layout';
import type { CabinetConfig, Layout, Part, PartMaterial, PricingConfig, FrontStyle } from './types';

/** Extra edge banding per banded edge, for trimming the overhang at both ends. */
export const BANDING_TRIM_MM = 30;
export const SHELF_SUPPORTS_PER_SHELF = 4;
export const MOUNTS_PER_ROD = 2;

export const partArea = (p: Part) => (p.length * p.width) / 1e6;

export function partBanding(p: Part): number {
  const edges = p.bandLong + p.bandShort;
  return (p.bandLong * p.length + p.bandShort * p.width + edges * BANDING_TRIM_MM) / 1000;
}

export interface BoardLine {
  material: PartMaterial;
  label: string;
  /** Material id when it's a priced board, 'back' for HDF. */
  priceKey: string;
  netArea: number;
  grossArea: number;
  sheets: number;
  parts: number;
}

export interface HardwareLine {
  id: string;
  name: string;
  qty: number;
  unit: 'pcs' | 'pairs' | 'm' | 'sets';
  unitPrice: number;
  total: number;
}

export interface CutListRow {
  name: string;
  material: string;
  length: number;
  width: number;
  thickness: number;
  qty: number;
  bandLong: number;
  bandShort: number;
  area: number;
}

export interface Bom {
  boards: BoardLine[];
  edgeBandingM: number;
  hardware: HardwareLine[];
  cutList: CutListRow[];
  totalBoardArea: number;
  partCount: number;
  frontStyle: FrontStyle;
  /** Area (m²) of the fronts that get a design: doors, plus drawer fronts for milled designs. */
  styledFrontArea: number;
  /** The same area split by design, since single doors can have their own (m²). */
  styledFronts: Partial<Record<FrontStyle, number>>;
  /** Mirror glass of room items (dresser mirrors, wall mirrors), m². */
  mirrorArea: number;
  /** Upholstered headboard cushions, m². */
  upholsteryArea: number;
}

const round = (v: number, dp = 3) => Math.round(v * 10 ** dp) / 10 ** dp;

export function materialLabel(cfg: CabinetConfig, m: PartMaterial): string {
  if (m === 'back') return `HDF ${cfg.backThickness} mm`;
  const finish = m === 'carcass' ? cfg.carcassFinish : cfg.frontFinish;
  return `${materialById(finish.materialId).name} ${cfg.thickness} mm`;
}

/** Group identical parts into cut-list rows. */
export function buildCutList(cfg: CabinetConfig, parts: Part[]): CutListRow[] {
  const rows = new Map<string, CutListRow>();
  for (const p of parts) {
    const L = Math.round(p.length);
    const Wd = Math.round(p.width);
    const key = [p.name, p.material, L, Wd, p.thickness, p.bandLong, p.bandShort].join('|');
    const row = rows.get(key);
    if (row) {
      row.qty++;
      row.area = round(row.area + partArea(p));
    } else {
      rows.set(key, {
        name: p.name,
        material: materialLabel(cfg, p.material),
        length: L,
        width: Wd,
        thickness: p.thickness,
        qty: 1,
        bandLong: p.bandLong,
        bandShort: p.bandShort,
        area: round(partArea(p)),
      });
    }
  }
  const order: Record<string, number> = {};
  parts.forEach((p, i) => (order[p.name] ??= i));
  return [...rows.values()].sort((a, b) => order[a.name] - order[b.name] || b.length * b.width - a.length * a.width);
}

/** Front area per design: every door by its own design, drawer fronts only for milled designs. */
function styledFronts(cfg: CabinetConfig, parts: Part[]) {
  const byStyle: Partial<Record<FrontStyle, number>> = {};
  for (const p of parts) {
    const style = frontStyleOf(cfg, p);
    const milled = style === 'shaker' || style === 'fluted';
    // Room-item boards (e.g. a panelled headboard) only count when they carry their own design.
    const counts = p.category === 'door' || (p.category === 'drawerFront' && milled) || (p.category === 'panel' && !!p.style && milled);
    if (counts) byStyle[style] = (byStyle[style] ?? 0) + partArea(p);
  }
  for (const k of Object.keys(byStyle) as FrontStyle[]) byStyle[k] = round(byStyle[k]!);
  return { styledFronts: byStyle, styledFrontArea: round(Object.values(byStyle).reduce((s, v) => s + v, 0)) };
}

export function buildBom(cfg: CabinetConfig, layout: Layout, pricing: PricingConfig): Bom {
  const { parts, fixtures } = layout;
  const waste = 1 + pricing.wastePercent / 100;
  const sheetArea = (SHEET.length * SHEET.width) / 1e6;

  const priceKeyOf = (m: PartMaterial) =>
    m === 'back' ? 'back' : (m === 'carcass' ? cfg.carcassFinish : cfg.frontFinish).materialId;

  const boards: BoardLine[] = [];
  for (const m of ['carcass', 'front', 'back'] as const) {
    const ps = parts.filter((p) => p.material === m);
    if (!ps.length) continue;
    const net = ps.reduce((s, p) => s + partArea(p), 0);
    boards.push({
      material: m,
      label: `${m === 'carcass' ? 'Korpusi' : m === 'front' ? 'Frontet' : 'Shpina & fundet e sirtarëve'} — ${materialLabel(cfg, m)}`,
      priceKey: priceKeyOf(m),
      netArea: round(net),
      grossArea: round(net * waste),
      sheets: Math.ceil((net * waste) / sheetArea),
      parts: ps.length,
    });
  }

  const edgeBandingM = round(parts.reduce((s, p) => s + partBanding(p), 0), 2);

  // --- Hardware ---
  const doors = parts.filter((p) => p.category === 'door').length;
  const drawers = parts.filter((p) => p.category === 'drawerFront').length;
  const shelves = parts.filter((p) => p.category === 'shelf').length;
  const rods = fixtures.filter((f) => f.kind === 'rod');
  const rodMeters = round(rods.reduce((s, r) => s + r.length, 0) / 1000, 2);

  const hw: Omit<HardwareLine, 'total'>[] = [];
  if (cfg.doorType === 'hinged' && doors) {
    hw.push({
      id: 'hinge',
      name: HINGE_LABELS[cfg.hingeType],
      qty: layout.doors.hingeTotal,
      unit: 'pcs',
      unitPrice: pricing.hinge[cfg.hingeType],
    });
  }
  if (cfg.doorType === 'sliding' && doors) {
    const run = cfg.width + (cfg.corner?.side !== 'none' ? (cfg.corner?.length ?? 0) : 0);
    hw.push({ id: 'track', name: 'Shina për dyer rrëshqitëse (lart + poshtë)', qty: round(run / 1000, 2), unit: 'm', unitPrice: pricing.slidingTrackPerM });
    hw.push({ id: 'roller', name: 'Set rrotash për derë rrëshqitëse', qty: doors, unit: 'sets', unitPrice: pricing.slidingRollerSet });
  }
  if (drawers) {
    hw.push({ id: 'slide', name: SLIDE_LABELS[cfg.slideType], qty: drawers, unit: 'pairs', unitPrice: pricing.slidePair[cfg.slideType] });
  }
  if (doors + drawers) {
    hw.push({
      id: 'handle',
      name: cfg.handleType === 'none' ? 'Mekanizëm push-to-open' : `${HANDLE_LABELS[cfg.handleType]} (${HANDLE_FINISH_LABELS[cfg.handleFinish].toLowerCase()})`,
      qty: doors + drawers,
      unit: 'pcs',
      unitPrice: pricing.handle[cfg.handleType],
    });
  }
  if (rods.length) {
    hw.push({ id: 'rod', name: 'Shufër varëse (ovale, krom)', qty: rodMeters, unit: 'm', unitPrice: pricing.hangingRodPerM });
    hw.push({ id: 'rodMount', name: 'Mbajtëse shufre', qty: rods.length * MOUNTS_PER_ROD, unit: 'pcs', unitPrice: pricing.rodMount });
  }
  if (shelves) {
    hw.push({ id: 'shelfSupport', name: 'Kunj mbajtës rafti', qty: shelves * SHELF_SUPPORTS_PER_SHELF, unit: 'pcs', unitPrice: pricing.shelfSupport });
  }

  return {
    boards,
    edgeBandingM,
    hardware: hw.map((h) => ({ ...h, total: round(h.qty * h.unitPrice, 2) })),
    cutList: buildCutList(cfg, parts),
    totalBoardArea: round(boards.reduce((s, b) => s + b.netArea, 0)),
    partCount: parts.length,
    frontStyle: cfg.frontStyle,
    ...styledFronts(cfg, parts),
    mirrorArea: round(layout.mirrorArea ?? 0),
    upholsteryArea: round(layout.upholsteryArea ?? 0),
  };
}
