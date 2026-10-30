import { addDrawer, slideClearance, slideFor } from './layout';
import { roomBounds, shellWarnings, type Bounds } from './shell';
import type {
  BedItem,
  CabinetConfig,
  CushionStyle,
  DresserItem,
  Fixture,
  HeadboardDesign,
  MirrorItem,
  MirrorShape,
  Part,
  PieceStyle,
  Placement,
  RoomItem,
  Warning,
} from './types';

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
export const HEADBOARD_DESIGN_LABELS: Record<HeadboardDesign, string> = { flat: 'E lëmuar', panels: 'Me kornizë', fluted: 'Me kanale', slats: 'Me shufra' };
export const CUSHION_LABELS: Record<CushionStyle, string> = { none: 'Pa jastëkë', panel: 'Një panel', channels: 'Vertikale', tufted: 'Katrorë' };
export const PIECE_STYLE_LABELS: Record<PieceStyle, string> = { flat: 'E lëmuar', shaker: 'Me kornizë', fluted: 'Me kanale' };
/** Upholstery fabric swatches. */
export const FABRICS = [
  { name: 'Bezhë', hex: '#cbbfae' },
  { name: 'Krem', hex: '#ebe3d3' },
  { name: 'Gri', hex: '#9a9a98' },
  { name: 'Antracit', hex: '#4b4d50' },
  { name: 'Ulliri', hex: '#7f8a6c' },
  { name: 'Blu', hex: '#3d4f6e' },
  { name: 'Rozë', hex: '#c9a19b' },
  { name: 'Bordo', hex: '#6e2f34' },
];
/** Headboard height (mm) of the presets older saves used. */
const LEGACY_HEADBOARD = { none: 330, low: 700, panel: 1000, tall: 1250 } as const;
const LEG_HEIGHT = 120;

/** A bed with every optional field filled in (older saves only had the headboard preset). */
export function bedSpec(it: BedItem): Required<BedItem> {
  const frameHeight = it.frameHeight ?? 330;
  return {
    ...it,
    headboardHeight: Math.max(frameHeight, it.headboardHeight ?? LEGACY_HEADBOARD[it.headboard]),
    headboardExtra: it.headboardExtra ?? 0,
    headboardDesign: it.headboardDesign ?? 'flat',
    cushions: it.cushions ?? 'none',
    fabric: it.fabric ?? FABRICS[0].hex,
    frameHeight,
    base: it.base ?? 'box',
    finish: it.finish ?? 'front',
  };
}

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

/** Which piece of a room item a part / fixture key belongs to, for editing one piece at a time. */
export type RoomPiece = 'head' | 'frame' | 'mattress' | 'mirror' | 'body';
export function roomPiece(key: string): RoomPiece {
  if (/^(head|hb-|slat-|cushion-)/.test(key)) return 'head';
  if (/^(mattress|pillow)/.test(key)) return 'mattress';
  if (key === 'mirror') return 'mirror';
  if (/^(rail|foot|base|support|leg)/.test(key)) return 'frame';
  return 'body';
}

interface Built {
  parts: Part[];
  fixtures: Fixture[];
  warnings: Warning[];
  groups: Record<string, Placement>;
  mirrorArea: number;
  upholsteryArea: number;
}

/**
 * Free-standing bedroom furniture around the wardrobe. Each item is built in its own frame —
 * x centred, y = 0 on the floor, back against the wall at −z — and placed by its group.
 */
export function buildRoomItems(cfg: CabinetConfig): Built {
  const out: Built = { parts: [], fixtures: [], warnings: shellWarnings(cfg), groups: {}, mirrorArea: 0, upholsteryArea: 0 };
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
  style?: Part['style'],
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
    style,
  });
}

/** Four square legs under a footprint `w` × `d` centred at z = `zc`, inset from the corners. */
function legs(item: RoomItem, out: Built, w: number, d: number, zc: number, h: number, T: number, material: Part['material'], name: string) {
  const s = 50;
  const inset = 30;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      board(item, out, `leg-${sx}${sz}`, name, material, [s, h, s], [sx * (w / 2 - inset - s / 2), h / 2, zc + sz * (d / 2 - inset - s / 2)], 'y', T);
    }
  }
}

function buildDresser(cfg: CabinetConfig, it: DresserItem, out: Built) {
  const T = cfg.thickness;
  const Tb = cfg.backThickness;
  const { width: w, height: h, depth: d } = it;
  const onLegs = it.base === 'legs';
  // Recessed plinth, or the body lifted onto legs.
  const P = onLegs ? LEG_HEIGHT : 60;
  const dc = d - Tb - T - 2;
  const zBack = -d / 2 + Tb;
  const zFront = zBack + dc;
  const zMid = zBack + dc / 2;
  const pre = roomPrefix(it.id);
  const sideH = h - T - (onLegs ? P : 0);
  const sideY = (onLegs ? P : 0) + sideH / 2;

  for (const s of [-1, 1]) board(it, out, `side-${s}`, 'Anësore komode', 'carcass', [T, sideH, dc], [s * (w / 2 - T / 2), sideY, zMid], 'y', T);
  // The top runs over the sides and the drawer fronts.
  board(it, out, 'top', 'Kapaku i komodës', 'front', [w, T, d - Tb], [0, h - T / 2, zBack + (d - Tb) / 2], 'x', T);
  board(it, out, 'bottom', 'Fundi i komodës', 'carcass', [w - 2 * T, T, dc], [0, P + T / 2, zMid], 'x', T);
  if (onLegs) legs(it, out, w, d, 0, P, T, 'front', 'Këmbë komode');
  else board(it, out, 'plinth', 'Sokla e komodës', 'carcass', [w - 2 * T, P, T], [0, P / 2, zFront - 30 - T / 2], 'x', T);
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
          style: it.frontStyle ?? 'flat',
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

/**
 * Bed: side rails and foot board (to the floor, or on legs), a base board under the mattress, and
 * a headboard against the wall that can be taller / wider than the frame, panelled, fluted or
 * slatted, with upholstered cushions on its front.
 */
function buildBed(cfg: CabinetConfig, item: BedItem, out: Built) {
  const it = bedSpec(item);
  const T = cfg.thickness;
  const mat = it.finish;
  const mw = it.mattressWidth;
  const ml = it.mattressLength;
  const onLegs = it.base === 'legs';
  const railTop = it.frameHeight;
  const railBottom = onLegs ? LEG_HEIGHT : 0;
  const railH = railTop - railBottom;
  const railY = railBottom + railH / 2;
  const baseTop = railTop - 60;
  const iw = mw + 10;
  const il = ml + 10;
  const wf = iw + 2 * T;
  const lf = il + 2 * T;
  const pre = roomPrefix(it.id);

  // --- Frame ---
  for (const s of [-1, 1]) board(it, out, `rail-${s}`, 'Anësore shtrati', mat, [T, railH, il], [s * (wf / 2 - T / 2), railY, 0], 'z', T);
  board(it, out, 'foot', 'Fundi i shtratit (këmbët)', mat, [wf, railH, T], [0, railY, lf / 2 - T / 2], 'x', T);
  board(it, out, 'base', 'Baza e shtratit', 'carcass', [iw, T, il], [0, baseTop - T / 2, 0], 'z', T);
  if (mw >= 1200) board(it, out, 'support', 'Mbajtëse qendrore e bazës', 'carcass', [T, baseTop - T, il], [0, (baseTop - T) / 2, 0], 'z', T);
  if (onLegs) legs(it, out, wf, lf, 0, railBottom, T, mat, 'Këmbë shtrati');

  // --- Headboard ---
  const hh = it.headboardHeight;
  const hw = wf + 2 * it.headboardExtra;
  const hz = -lf / 2 + T / 2;
  if (it.headboardDesign === 'slats') {
    // Vertical slats on a thin back board.
    board(it, out, 'hb-back', 'Shpina e kokës së shtratit', 'carcass', [hw, hh, T], [0, hh / 2, hz - T], 'y', T);
    const slatW = 60;
    const pitch = 85;
    const n = Math.max(2, Math.floor((hw + pitch - slatW) / pitch));
    const x0 = -((n - 1) * pitch) / 2;
    for (let i = 0; i < n; i++) board(it, out, `slat-${i}`, 'Shufër e kokës së shtratit', mat, [slatW, hh, T], [x0 + i * pitch, hh / 2, hz], 'y', T);
  } else {
    const style = it.headboardDesign === 'panels' ? 'shaker' : it.headboardDesign === 'fluted' ? 'fluted' : undefined;
    board(it, out, 'head', 'Koka e shtratit', mat, [hw, hh, T], [0, hh / 2, hz], hh > hw ? 'y' : 'x', T, style);
  }

  // --- Cushions on the headboard, from just above the mattress to near its top edge ---
  const mattressH = 220;
  const mattressTop = baseTop + mattressH;
  const cushionDepth = it.cushions === 'none' ? 0 : 70;
  if (it.cushions !== 'none') {
    const y0 = mattressTop - 40;
    const y1 = hh - 60;
    const cw = (it.headboardExtra > 0 ? hw : wf) - 80;
    const front = -lf / 2 + T;
    if (y1 - y0 < 150) {
      out.warnings.push({
        level: 'warn',
        message: 'Koka e shtratit është shumë e ulët për jastëkë — rriteni lartësinë e kokës.',
        focus: { tab: 'room', extraId: it.id },
      });
    } else {
      const ch = y1 - y0;
      const add = (key: string, x: number, y: number, w: number, h: number) =>
        out.fixtures.push({ kind: 'cushion', id: `${pre}cushion-${key}`, position: [x, y, front + cushionDepth / 2], size: [w, h, cushionDepth], color: it.fabric, group: roomGroup(it.id) });
      if (it.cushions === 'panel') {
        add('0', 0, y0 + ch / 2, cw, ch);
      } else if (it.cushions === 'channels') {
        const n = Math.max(2, Math.round(cw / 190));
        const w = (cw - (n - 1) * 6) / n;
        for (let i = 0; i < n; i++) add(`${i}`, -cw / 2 + w / 2 + i * (w + 6), y0 + ch / 2, w, ch);
      } else {
        const cols = Math.max(2, Math.round(cw / 280));
        const rows = Math.max(1, Math.round(ch / 280));
        const w = (cw - (cols - 1) * 6) / cols;
        const h = (ch - (rows - 1) * 6) / rows;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) add(`${r}-${c}`, -cw / 2 + w / 2 + c * (w + 6), y0 + h / 2 + r * (h + 6), w, h);
      }
      out.upholsteryArea += (cw * ch) / 1e6;
    }
  }

  // --- Mattress and pillows ---
  out.fixtures.push({ kind: 'mattress', id: `${pre}mattress`, position: [0, baseTop + mattressH / 2, 0], size: [mw, mattressH, ml], group: roomGroup(it.id) });
  const pillows = mw >= 1200 ? 2 : 1;
  const pw = Math.min(650, (mw - 80) / pillows - 40);
  for (let i = 0; i < pillows; i++) {
    const x = pillows === 1 ? 0 : (i === 0 ? -1 : 1) * (mw / 4);
    out.fixtures.push({
      kind: 'pillow',
      id: `${pre}pillow-${i}`,
      position: [x, mattressTop + 55, -ml / 2 + 60 + 200 + cushionDepth],
      size: [pw, 120, 400],
      group: roomGroup(it.id),
    });
  }
}

/** Footprint (width along x, depth along z) of a room item before rotation, mm. */
export function roomFootprint(cfg: CabinetConfig, it: RoomItem): [number, number] {
  if (it.kind === 'dresser') return [it.width, it.depth];
  if (it.kind === 'mirror') return [it.width, 30];
  const b = bedSpec(it);
  return [it.mattressWidth + 10 + 2 * cfg.thickness + 2 * b.headboardExtra, it.mattressLength + 10 + 2 * cfg.thickness];
}

/** Free space kept between the wardrobe and a room item, so end doors can swing open. */
const WARDROBE_GAP = 150;
/** Free space kept between two room items. */
const ITEM_GAP = 20;

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Floor rectangle of a room item, turned by its rotation, grown by `pad` on every side. */
function itemRect(cfg: CabinetConfig, it: RoomItem, pad = 0): Rect {
  const [w, d] = roomFootprint(cfg, it);
  const [hx, hz] = it.rotation % 180 === 0 ? [w / 2, d / 2] : [d / 2, w / 2];
  return { x0: it.x - hx - pad, x1: it.x + hx + pad, z0: it.z - hz - pad, z1: it.z + hz + pad };
}

const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.z0 < b.z1 - 0.5 && b.z0 < a.z1 - 0.5;

/**
 * Room items moved apart so none stands inside the wardrobe, the corner wing or another item.
 * Items are settled in list order; one that overlaps slides along its wall (x, or z when turned
 * sideways) to the nearest free spot. Returns `cfg.extras` itself when nothing had to move.
 */
export function separateRoomItems(cfg: CabinetConfig): RoomItem[] {
  const items = cfg.extras ?? [];
  const { width: W, depth: D } = cfg;
  // Fixed obstacles, already grown by the gap an item must keep from them.
  const taken: Rect[] = [{ x0: -W / 2 - WARDROBE_GAP, x1: W / 2 + WARDROBE_GAP, z0: -D / 2 - WARDROBE_GAP, z1: D / 2 + WARDROBE_GAP }];
  const side = cfg.corner?.side ?? 'none';
  if (side !== 'none') {
    const x0 = side === 'left' ? -W / 2 : W / 2 - D;
    taken.push({ x0: x0 - WARDROBE_GAP, x1: x0 + D + WARDROBE_GAP, z0: D / 2, z1: D / 2 + 2 + cfg.corner.length + WARDROBE_GAP });
  }

  const walls = roomBounds(cfg);
  let moved = false;
  const out = items.map((orig) => {
    // Inside the walls first: an item pushed against a wall stops there.
    const it = walls ? clampInto(itemRect(cfg, orig), orig, walls) : orig;
    const r = itemRect(cfg, it);
    const inside = (x: number, z: number) =>
      !walls || (r.x0 + x - it.x >= walls.x0 - 0.5 && r.x1 + x - it.x <= walls.x1 + 0.5 && r.z0 + z - it.z >= walls.z0 - 0.5 && r.z1 + z - it.z <= walls.z1 + 0.5);
    const blocked = (x: number, z: number) => {
      const s = { x0: r.x0 + x - it.x, x1: r.x1 + x - it.x, z0: r.z0 + z - it.z, z1: r.z1 + z - it.z };
      return !inside(x, z) || taken.some((t) => overlaps(s, t));
    };
    let best = { x: it.x, z: it.z };
    if (blocked(it.x, it.z)) {
      // Spots just either side of each obstacle along the item's wall; take the nearest free one.
      const alongX = it.rotation % 180 === 0;
      const half = alongX ? (r.x1 - r.x0) / 2 : (r.z1 - r.z0) / 2;
      const starts = alongX ? taken.flatMap((t) => [t.x0 - half, t.x1 + half]) : taken.flatMap((t) => [t.z0 - half, t.z1 + half]);
      // Turned items stay in front of the back wall.
      const minZ = -D / 2 + half;
      const free = starts
        .filter((c) => alongX || c >= minZ)
        .map((c) => (alongX ? { x: c, z: it.z } : { x: it.x, z: c }))
        .filter((p) => !blocked(p.x, p.z))
        .sort((a, b) => Math.abs(a.x - it.x) + Math.abs(a.z - it.z) - (Math.abs(b.x - it.x) + Math.abs(b.z - it.z)));
      if (free.length) best = { x: Math.round(free[0].x), z: Math.round(free[0].z) };
    }
    const placed = best.x === orig.x && best.z === orig.z ? orig : ({ ...orig, ...best } as RoomItem);
    if (placed !== orig) moved = true;
    taken.push(itemRect(cfg, placed, ITEM_GAP));
    return placed;
  });
  return moved ? out : items;
}

/** The item moved the least distance that puts its rectangle `r` inside the walls (centred if it can't fit). */
function clampInto(r: Rect, it: RoomItem, b: Bounds): RoomItem {
  const fit = (lo: number, hi: number, min: number, max: number) => (hi - lo > max - min ? (min + max) / 2 - (lo + hi) / 2 : lo < min ? min - lo : hi > max ? max - hi : 0);
  const dx = Math.round(fit(r.x0, r.x1, b.x0, b.x1));
  const dz = Math.round(fit(r.z0, r.z1, b.z0, b.z1));
  return dx || dz ? { ...it, x: it.x + dx, z: it.z + dz } : it;
}

export type RoomPreset ='dresser' | 'nightstand' | 'mirror' | 'bed';

/**
 * A new room item with sensible defaults, lined up against the wardrobe's back wall next to
 * whatever is already there (on the side away from a corner wing).
 */
export function newRoomItem(cfg: CabinetConfig, preset: RoomPreset, id: string): RoomItem {
  const wallZ = -cfg.depth / 2;
  const base = { id, x: 0, z: 0, rotation: 0 as const };
  const item: RoomItem =
    preset === 'dresser'
      ? { ...base, kind: 'dresser', width: 1200, height: 850, depth: 450, rows: 3, perRow: 2, mirror: 'round', mirrorWidth: 750, mirrorHeight: 750, frontStyle: 'flat', base: 'plinth' }
      : preset === 'nightstand'
        ? { ...base, kind: 'dresser', width: 500, height: 550, depth: 400, rows: 2, perRow: 1, mirror: 'none', mirrorWidth: 500, mirrorHeight: 700, frontStyle: 'flat', base: 'legs' }
        : preset === 'mirror'
          ? { ...base, kind: 'mirror', shape: 'arch', width: 600, height: 1700, bottom: 100 }
          : {
              ...base,
              kind: 'bed',
              mattressWidth: 1600,
              mattressLength: 2000,
              headboard: 'panel',
              headboardHeight: 1100,
              headboardExtra: 0,
              headboardDesign: 'flat',
              cushions: 'channels',
              fabric: FABRICS[0].hex,
              frameHeight: 330,
              base: 'box',
              finish: 'front',
            };

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
