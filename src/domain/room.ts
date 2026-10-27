import { addDrawer, slideClearance, slideFor } from './layout';
import type { BedItem, CabinetConfig, DresserItem, Fixture, MirrorItem, MirrorShape, Part, Placement, RoomItem, Warning } from './types';

/** Ids of a room item's parts start with this; its placement group is the same string. */
export const roomPrefix = (id: string) => `x:${id}:`;
export const roomGroup = (id: string) => `x:${id}`;

export const ROOM_LABELS = { dresser: 'Komodë', mirror: 'Pasqyrë', bed: 'Shtrat' } as const;
export const MIRROR_LABELS: Record<MirrorShape, string> = {
  none: 'Pa pasqyrë',
  rect: 'Drejtkëndëshe',
  round: 'E rrumbullakët',
  oval: 'Ovale',
  arch: 'Hark',
  pill: 'Kapsulë',
};
export const HEADBOARD_LABELS = { none: 'Pa kokë', low: 'E ulët', panel: 'Panel', tall: 'E lartë' } as const;
const HEADBOARD_HEIGHT = { none: 330, low: 700, panel: 1000, tall: 1250 } as const;

/** Glass area of a mirror shape in m². Round mirrors use the smaller side as their diameter. */
export function mirrorArea(shape: Exclude<MirrorShape, 'none'>, w: number, h: number): number {
  const mm2 = (() => {
    switch (shape) {
      case 'rect':
        return w * h;
      case 'round':
        return (Math.PI * Math.min(w, h) ** 2) / 4;
      case 'oval':
        return (Math.PI * w * h) / 4;
      case 'arch':
        return w * Math.max(0, h - w / 2) + (Math.PI * w * w) / 8;
      case 'pill':
        return w * Math.max(0, h - w) + (Math.PI * w * w) / 4;
    }
  })();
  return mm2 / 1e6;
}

interface Built {
  parts: Part[];
  fixtures: Fixture[];
  warnings: Warning[];
  groups: Record<string, Placement>;
  mirrorArea: number;
}

/**
 * Free-standing bedroom furniture around the wardrobe. Each item is built in its own frame —
 * x centred, y = 0 on the floor, back against the wall at −z — and placed by its group.
 */
export function buildRoomItems(cfg: CabinetConfig): Built {
  const out: Built = { parts: [], fixtures: [], warnings: [], groups: {}, mirrorArea: 0 };
  for (const item of cfg.extras ?? []) {
    const group = roomGroup(item.id);
    out.groups[group] = { position: [item.x, 0, item.z], rotation: item.rotation };
    if (item.kind === 'dresser') buildDresser(cfg, item, out);
    else if (item.kind === 'mirror') buildMirror(item, out);
    else buildBed(cfg, item, out);
  }
  return out;
}

/** Board helper: a box part in a room item's frame. */
function board(
  item: RoomItem,
  out: Built,
  key: string,
  name: string,
  material: Part['material'],
  size: [number, number, number],
  position: [number, number, number],
  grain: Part['grain'],
  T: number,
) {
  // Cut size: the two largest box dimensions; thickness is the smallest.
  const [a, b] = [...size].sort((x, y) => y - x);
  out.parts.push({
    id: roomPrefix(item.id) + key,
    name,
    category: 'panel',
    material,
    length: a,
    width: b,
    thickness: material === 'back' ? Math.min(...size) : T,
    bandLong: material === 'back' ? 0 : 1,
    bandShort: material === 'front' ? 2 : 0,
    position,
    size,
    grain,
    group: roomGroup(item.id),
  });
}

function buildDresser(cfg: CabinetConfig, it: DresserItem, out: Built) {
  const T = cfg.thickness;
  const Tb = cfg.backThickness;
  const { width: w, height: h, depth: d } = it;
  const P = 60;
  const dc = d - Tb - T - 2;
  const zBack = -d / 2 + Tb;
  const zFront = zBack + dc;
  const zMid = zBack + dc / 2;
  const pre = roomPrefix(it.id);

  for (const s of [-1, 1]) board(it, out, `side-${s}`, 'Anësore komode', 'carcass', [T, h - T, dc], [s * (w / 2 - T / 2), (h - T) / 2, zMid], 'y', T);
  // The top runs over the sides and the drawer fronts.
  board(it, out, 'top', 'Kapaku i komodës', 'front', [w, T, d - Tb], [0, h - T / 2, zBack + (d - Tb) / 2], 'x', T);
  board(it, out, 'bottom', 'Fundi i komodës', 'carcass', [w - 2 * T, T, dc], [0, P + T / 2, zMid], 'x', T);
  board(it, out, 'plinth', 'Sokla e komodës', 'carcass', [w - 2 * T, P, T], [0, P / 2, zFront - 30 - T / 2], 'x', T);
  board(it, out, 'back', 'Shpina e komodës (HDF)', 'back', [w - 4, h - P - 4, Tb], [0, P + 2 + (h - P - 4) / 2, -d / 2 + Tb / 2], 'y', T);
  const innerH = h - T - P - T;
  if (it.perRow === 2) board(it, out, 'divider', 'Ndarëse komode', 'carcass', [T, innerH, dc], [0, P + T + innerH / 2, zMid], 'y', T);

  const slideLen = slideFor(dc - 10);
  if (!slideLen) {
    out.warnings.push({
      level: 'error',
      message: `${ROOM_LABELS.dresser} është shumë e cekët për shina sirtari — rriteni thellësinë.`,
      focus: { tab: 'room', extraId: it.id },
    });
  } else {
    // Overlay fronts from the plinth to just under the top, in equal rows.
    const rows = Math.max(1, Math.round(it.rows));
    const gap = 3;
    const y0 = P + 2;
    const rowH = (h - T - 2 - y0) / rows;
    const frontW = (w - 4 - gap * (it.perRow - 1)) / it.perRow;
    const cwI = it.perRow === 1 ? w - 2 * T : (w - 3 * T) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < it.perRow; c++) {
        const frontX = -w / 2 + 2 + frontW / 2 + c * (frontW + gap);
        const frontH = rowH - gap;
        const slotBottom = y0 + r * rowH;
        addDrawer(out.parts, out.fixtures, {
          id: `${r}-${c}`,
          prefix: pre,
          group: roomGroup(it.id),
          frontX,
          frontY: slotBottom + rowH / 2,
          frontW,
          frontH,
          frontZ: d / 2 - T / 2,
          boxW: cwI - 2 * slideClearance(cfg.slideType),
          boxBottom: Math.max(P + T + 2, slotBottom + 15),
          boxH: Math.max(60, frontH - 50),
          slideLen,
          T,
          Tb,
          handleType: cfg.handleType,
        });
      }
    }
  }

  if (it.mirror !== 'none') {
    out.fixtures.push({
      kind: 'mirror',
      id: `${pre}mirror`,
      shape: it.mirror,
      width: it.mirrorWidth,
      height: it.mirrorHeight,
      // Hung on the wall, 12 cm above the top.
      position: [0, h + 120 + it.mirrorHeight / 2, -d / 2 + 4],
      group: roomGroup(it.id),
    });
    out.mirrorArea += mirrorArea(it.mirror, it.mirrorWidth, it.mirrorHeight);
  }
}

function buildMirror(it: MirrorItem, out: Built) {
  out.fixtures.push({
    kind: 'mirror',
    id: `${roomPrefix(it.id)}mirror`,
    shape: it.shape,
    width: it.width,
    height: it.height,
    position: [0, it.bottom + it.height / 2, 4],
    group: roomGroup(it.id),
  });
  out.mirrorArea += mirrorArea(it.shape, it.width, it.height);
}

/** Box bed: rails to the floor, a base board under the mattress and a headboard against the wall. */
function buildBed(cfg: CabinetConfig, it: BedItem, out: Built) {
  const T = cfg.thickness;
  const mw = it.mattressWidth;
  const ml = it.mattressLength;
  const railH = 330;
  const baseTop = railH - 60;
  const iw = mw + 10;
  const il = ml + 10;
  const wf = iw + 2 * T;
  const lf = il + 2 * T;
  const hh = HEADBOARD_HEIGHT[it.headboard];
  const pre = roomPrefix(it.id);

  for (const s of [-1, 1]) board(it, out, `rail-${s}`, 'Anësore shtrati', 'front', [T, railH, il], [s * (wf / 2 - T / 2), railH / 2, 0], 'z', T);
  board(it, out, 'foot', 'Fundi i shtratit (këmbët)', 'front', [wf, railH, T], [0, railH / 2, lf / 2 - T / 2], 'x', T);
  board(it, out, 'head', 'Koka e shtratit', 'front', [wf, hh, T], [0, hh / 2, -lf / 2 + T / 2], it.headboard === 'none' ? 'x' : 'y', T);
  board(it, out, 'base', 'Baza e shtratit', 'carcass', [iw, T, il], [0, baseTop - T / 2, 0], 'z', T);
  if (mw >= 1200) board(it, out, 'support', 'Mbajtëse qendrore e bazës', 'carcass', [T, baseTop - T, il], [0, (baseTop - T) / 2, 0], 'z', T);

  const mattressH = 220;
  out.fixtures.push({ kind: 'mattress', id: `${pre}mattress`, position: [0, baseTop + mattressH / 2, 0], size: [mw, mattressH, ml], group: roomGroup(it.id) });
  const pillows = mw >= 1200 ? 2 : 1;
  const pw = Math.min(650, (mw - 80) / pillows - 40);
  for (let i = 0; i < pillows; i++) {
    const x = pillows === 1 ? 0 : (i === 0 ? -1 : 1) * (mw / 4);
    out.fixtures.push({
      kind: 'pillow',
      id: `${pre}pillow-${i}`,
      position: [x, baseTop + mattressH + 55, -ml / 2 + 60 + 200],
      size: [pw, 120, 400],
      group: roomGroup(it.id),
    });
  }
}

/** Footprint (width along x, depth along z) of a room item before rotation, mm. */
export function roomFootprint(cfg: CabinetConfig, it: RoomItem): [number, number] {
  if (it.kind === 'dresser') return [it.width, it.depth];
  if (it.kind === 'mirror') return [it.width, 30];
  return [it.mattressWidth + 10 + 2 * cfg.thickness, it.mattressLength + 10 + 2 * cfg.thickness];
}

export type RoomPreset = 'dresser' | 'nightstand' | 'mirror' | 'bed';

/**
 * A new room item with sensible defaults, lined up against the wardrobe's back wall next to
 * whatever is already there (on the side away from a corner wing).
 */
export function newRoomItem(cfg: CabinetConfig, preset: RoomPreset, id: string): RoomItem {
  const wallZ = -cfg.depth / 2;
  const base = { id, x: 0, z: 0, rotation: 0 as const };
  const item: RoomItem =
    preset === 'dresser'
      ? { ...base, kind: 'dresser', width: 1200, height: 850, depth: 450, rows: 3, perRow: 2, mirror: 'round', mirrorWidth: 750, mirrorHeight: 750 }
      : preset === 'nightstand'
        ? { ...base, kind: 'dresser', width: 500, height: 550, depth: 400, rows: 2, perRow: 1, mirror: 'none', mirrorWidth: 500, mirrorHeight: 700 }
        : preset === 'mirror'
          ? { ...base, kind: 'mirror', shape: 'arch', width: 600, height: 1700, bottom: 100 }
          : { ...base, kind: 'bed', mattressWidth: 1600, mattressLength: 2000, headboard: 'panel' };

  const [fw, fd] = roomFootprint(cfg, item);
  const toLeft = cfg.corner?.side === 'right';
  // Edge of the wall already taken by the wardrobe and items standing against it.
  let edge = toLeft ? -cfg.width / 2 : cfg.width / 2;
  for (const other of cfg.extras ?? []) {
    if (other.rotation % 180 !== 0) continue;
    const [ow] = roomFootprint(cfg, other);
    edge = toLeft ? Math.min(edge, other.x - ow / 2) : Math.max(edge, other.x + ow / 2);
  }
  const gap = 150;
  item.x = Math.round(toLeft ? edge - gap - fw / 2 : edge + gap + fw / 2);
  item.z = Math.round(item.kind === 'mirror' ? wallZ : wallZ + fd / 2);
  return item;
}
