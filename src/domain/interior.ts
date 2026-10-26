import { MAX_SINGLE_DOOR, uid } from './catalog';
import type { CabinetConfig, Column, InteriorItem, ItemType, SectionFit } from './types';

export const ROD_CLEARANCE = 15;
export const DEFAULT_DRAWER_HEIGHT = 200;
const SNAP = 10;

const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Vertical space an item occupies inside its column, [bottom, top] in mm from the interior floor. */
export function itemInterval(item: InteriorItem, thickness: number): [number, number] {
  switch (item.type) {
    case 'shelf':
      return [item.y, item.y + thickness];
    case 'drawer':
      return [item.y, item.y + (item.height ?? DEFAULT_DRAWER_HEIGHT)];
    case 'rod':
      return [item.y - ROD_CLEARANCE, item.y + ROD_CLEARANCE];
  }
}

export const sortItems = (items: InteriorItem[]) => [...items].sort((a, b) => a.y - b.y);

/** Free vertical gaps in a column, largest-first is up to the caller. */
export function freeGaps(column: Column, interiorHeight: number, thickness: number): [number, number][] {
  const intervals = column.items.map((it) => itemInterval(it, thickness)).sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let cursor = 0;
  for (const [lo, hi] of intervals) {
    if (lo > cursor) gaps.push([cursor, lo]);
    cursor = Math.max(cursor, hi);
  }
  if (cursor < interiorHeight) gaps.push([cursor, interiorHeight]);
  return gaps;
}

/**
 * Pick a sensible spot for a new item: shelves split the largest gap, rods hang just below
 * whatever closes the largest gap from above, drawers stack from the bottom up.
 * Returns null if nothing fits.
 */
export function placeNewItem(
  column: Column,
  type: ItemType,
  interiorHeight: number,
  thickness: number,
): InteriorItem | null {
  const gaps = freeGaps(column, interiorHeight, thickness);
  if (!gaps.length) return null;

  if (type === 'drawer') {
    const h = DEFAULT_DRAWER_HEIGHT;
    const gap = gaps.find(([lo, hi]) => hi - lo >= h);
    return gap ? { id: uid('it'), type, y: gap[0], height: h } : null;
  }

  const [lo, hi] = gaps.reduce((best, g) => (g[1] - g[0] > best[1] - best[0] ? g : best));
  if (type === 'shelf') {
    if (hi - lo < thickness + 40) return null;
    return { id: uid('it'), type, y: snap((lo + hi - thickness) / 2) };
  }
  // rod
  if (hi - lo < 120) return null;
  const closedAbove = hi < interiorHeight;
  const y = closedAbove ? snap(hi - 60) : snap(Math.min(hi - 80, lo + 1700));
  return { id: uid('it'), type, y };
}

/** Spread the column's shelves evenly in the space above its drawers. */
export function distributeShelves(column: Column, interiorHeight: number, thickness: number): Column {
  const shelves = column.items.filter((i) => i.type === 'shelf');
  if (!shelves.length) return column;
  const drawerTop = column.items
    .filter((i) => i.type === 'drawer')
    .reduce((m, d) => Math.max(m, d.y + (d.height ?? DEFAULT_DRAWER_HEIGHT)), 0);
  const span = interiorHeight - drawerTop;
  const step = (span - shelves.length * thickness) / (shelves.length + 1);
  const ordered = sortItems(shelves);
  const moved = new Map(ordered.map((s, i) => [s.id, snap(drawerTop + step * (i + 1) + thickness * i)]));
  return { ...column, items: column.items.map((it) => (moved.has(it.id) ? { ...it, y: moved.get(it.id)! } : it)) };
}

/** A fresh column for when the user adds one: a shelf near the top and two below. */
export function newColumn(interiorHeight: number, thickness: number): Column {
  const top = snap(interiorHeight - 380);
  return {
    id: uid('col'),
    items: [
      { id: uid('it'), type: 'shelf', y: top },
      { id: uid('it'), type: 'shelf', y: snap(top / 3 * 2) },
      { id: uid('it'), type: 'shelf', y: snap(top / 3 - thickness) },
    ],
  };
}

/** Leftovers narrower than this are spread over the sections instead of becoming their own. */
export const MIN_REMAINDER_SECTION = 300;

export interface SectionPlan {
  /** Outer width of every section, left to right. */
  widths: number[];
  /** Width of the extra leftover section, or 0 if there is none. */
  remainder: number;
  /** Leftover too narrow for its own section, spread over the others instead. */
  spread: number;
}

/**
 * As many standard-width sections as fit. Whatever is left becomes one more, narrower section
 * (e.g. 300 cm at 120 cm → 120 + 120 + 60), unless it is under 30 cm, then it is spread evenly.
 */
export function planSections(width: number, fit: SectionFit): SectionPlan {
  const std = Math.max(100, fit.width);
  const full = Math.floor(width / std);
  const rest = width - full * std;
  if (full === 0) return { widths: [width], remainder: 0, spread: 0 };
  if (rest < 1) return { widths: Array(full).fill(std), remainder: 0, spread: 0 };
  if (rest >= MIN_REMAINDER_SECTION) {
    const fulls: number[] = Array(full).fill(std);
    return { widths: fit.remainderSide === 'left' ? [rest, ...fulls] : [...fulls, rest], remainder: rest, spread: 0 };
  }
  return { widths: Array(full).fill(width / full), remainder: 0, spread: rest };
}

/** Doors a section gets under the fit setting: 'auto' = 1 door up to 60 cm, 2 above. */
export const fitDoorsFor = (sectionWidth: number, doors: SectionFit['doors']): 0 | 1 | 2 =>
  doors === 'auto' ? (sectionWidth > MAX_SINGLE_DOOR ? 2 : 1) : doors;

/**
 * Apply the "fit sections to a standard width" setting: lay out the planned sections (including a
 * narrower leftover one) and give each its doors. Existing section interiors are kept.
 */
export function applySectionFit(cfg: CabinetConfig): CabinetConfig {
  const { sectionFit: fit } = cfg;
  if (!fit.enabled) return cfg;
  const { widths } = planSections(cfg.width, fit);
  const n = widths.length;
  const interiorHeight = cfg.height - cfg.plinthHeight - 2 * cfg.thickness;

  const columns = widths.map((width, i): Column => {
    const col = cfg.columns[i] ?? newColumn(interiorHeight, cfg.thickness);
    const count = fitDoorsFor(width, fit.doors);
    return { ...col, width, doors: { count, hinge: i < n / 2 ? 'left' : 'right', split: col.doors?.split ?? null } };
  });
  const anyDoors = columns.some((c) => c.doors!.count > 0);
  return { ...cfg, columns, doorType: anyDoors ? 'hinged' : 'none', doorLayout: 'perColumn' };
}
