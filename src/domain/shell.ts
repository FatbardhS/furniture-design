import type { CabinetConfig, Opening, RoomShell, WallSide, Warning } from './types';

export const WALL_THICKNESS = 100;
export const WALL_LABELS: Record<WallSide, string> = { back: 'Muri prapa', left: 'Muri majtas', right: 'Muri djathtas', front: 'Muri para' };
export const OPENING_LABELS = { window: 'Dritare', door: 'Derë' } as const;

/** "4 m" / "3,5 m" / "0,95 m" — metres with the Albanian decimal comma, no trailing zeros. */
export const fmtM = (mm: number) => `${String(+(mm / 1000).toFixed(2)).replace('.', ',')} m`;

export interface Bounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Inner faces of the walls in wardrobe coordinates (the wardrobe's back is on the back wall), or null without a room. */
export function roomBounds(cfg: CabinetConfig): Bounds | null {
  const r = cfg.room;
  if (!r?.enabled) return null;
  const x0 = -cfg.width / 2 - r.wardrobeX;
  const z0 = -cfg.depth / 2;
  return { x0, x1: x0 + r.width, z0, z1: z0 + r.length };
}

/** Length of a wall along the inside of the room. */
export const wallLength = (r: RoomShell, wall: WallSide) => (wall === 'back' || wall === 'front' ? r.width : r.length);

/**
 * Where a wall runs: its start (where `offset` is measured from), its direction and its inward
 * normal. Back and front walls are measured from the left wall, side walls from the back wall.
 */
export function wallFrame(b: Bounds, wall: WallSide): { start: [number, number]; dir: [number, number]; normal: [number, number] } {
  switch (wall) {
    case 'back':
      return { start: [b.x0, b.z0], dir: [1, 0], normal: [0, 1] };
    case 'front':
      return { start: [b.x0, b.z1], dir: [1, 0], normal: [0, -1] };
    case 'left':
      return { start: [b.x0, b.z0], dir: [0, 1], normal: [1, 0] };
    case 'right':
      return { start: [b.x1, b.z0], dir: [0, 1], normal: [-1, 0] };
  }
}

/** A 4 × 4 m room with the wardrobe centred on the back wall, and a window and a door on the left wall (in the default view). */
export function defaultRoom(cfg: Pick<CabinetConfig, 'width'>, uid: (p: string) => string): RoomShell {
  const width = 4000;
  return {
    enabled: true,
    width,
    length: 4000,
    height: 2600,
    wardrobeX: Math.max(0, Math.round((width - cfg.width) / 2)),
    openings: [
      { id: uid('op'), kind: 'window', wall: 'left', offset: 1500, width: 1200, height: 1400, sill: 900 },
      { id: uid('op'), kind: 'door', wall: 'left', offset: 3200, width: 900, height: 2100, sill: 0 },
    ],
  };
}

/** Stretches of a wall already used, [start, end] along it: openings, and the wardrobe on the back wall. */
function usedAlong(cfg: CabinetConfig, r: RoomShell, wall: WallSide): [number, number][] {
  const used = r.openings.filter((o) => o.wall === wall).map((o): [number, number] => [o.offset - o.width / 2, o.offset + o.width / 2]);
  if (wall === 'back') used.push([r.wardrobeX, r.wardrobeX + cfg.width]);
  return used;
}

/**
 * A new window or door on the first wall with room for it, preferring `wall`, then the walls
 * seen in the default view, kept 20 cm clear of corners and of what is already there.
 */
export function newOpening(cfg: CabinetConfig, r: RoomShell, kind: Opening['kind'], wall: WallSide, id: string): Opening {
  const width = kind === 'door' ? 900 : 1200;
  const base = kind === 'door' ? { height: Math.min(2100, r.height - 100), sill: 0 } : { height: 1400, sill: 900 };
  const clear = 200;
  for (const w of [wall, ...(['left', 'back', 'right', 'front'] as const).filter((x) => x !== wall)]) {
    const len = wallLength(r, w);
    const used = usedAlong(cfg, r, w);
    for (let c = width / 2 + clear; c <= len - width / 2 - clear; c += 50) {
      if (used.every(([a, b]) => c + width / 2 + clear <= a || c - width / 2 - clear >= b)) return { id, kind, wall: w, offset: c, width, ...base };
    }
  }
  return { id, kind, wall, offset: Math.round(wallLength(r, wall) / 2), width, ...base };
}

/** Things about the room that would stop the furniture going in or the doors and windows working. */
export function shellWarnings(cfg: CabinetConfig): Warning[] {
  const r = cfg.room;
  const b = roomBounds(cfg);
  if (!r || !b) return [];
  const out: Warning[] = [];
  const room = (message: string, level: Warning['level'] = 'warn', openingId?: string): Warning => ({ level, message, focus: { tab: 'room', field: 'room', openingId } });
  if (r.wardrobeX + cfg.width > r.width) out.push(room(`Dollapi (${fmtM(cfg.width)}) nuk hyn në murin prapa nga pozicioni i tij — zvogëloni gjerësinë ose lëvizeni.`, 'error'));
  if (cfg.height > r.height) out.push(room(`Dollapi (${fmtM(cfg.height)}) është më i lartë se muret e dhomës (${fmtM(r.height)}).`, 'error'));
  if (cfg.depth >= r.length) out.push(room('Dhoma është më e cekët se dollapi.', 'error'));

  // What stands against each wall, as [start, end] along it, with its height.
  const against: Record<WallSide, [number, number, number][]> = { back: [[r.wardrobeX, r.wardrobeX + cfg.width, cfg.height]], left: [], right: [], front: [] };
  const side = cfg.corner?.side ?? 'none';
  if (side !== 'none') {
    const wingX0 = side === 'left' ? r.wardrobeX : r.wardrobeX + cfg.width - cfg.depth;
    const run: [number, number, number] = [0, cfg.depth + 2 + cfg.corner.length, cfg.height];
    if (side === 'left' && wingX0 < 50) against.left.push(run);
    if (side === 'right' && r.width - (wingX0 + cfg.depth) < 50) against.right.push(run);
  }

  for (const o of r.openings) {
    const name = `${OPENING_LABELS[o.kind]} në ${WALL_LABELS[o.wall].toLowerCase()}`;
    const len = wallLength(r, o.wall);
    const a = o.offset - o.width / 2;
    const e = o.offset + o.width / 2;
    if (a < 0 || e > len || o.sill + o.height > r.height) {
      out.push(room(`${name} del jashtë murit — ndryshoni pozicionin ose përmasat.`, 'error', o.id));
      continue;
    }
    if (against[o.wall].some(([s, t, h]) => Math.min(t, e) - Math.max(s, a) > 5 && o.sill < h)) {
      out.push(room(`${name} mbulohet nga dollapi.`, 'warn', o.id));
    }
    for (const p of r.openings) {
      if (p === o || p.wall !== o.wall || r.openings.indexOf(p) < r.openings.indexOf(o)) continue;
      const overlapX = Math.min(e, p.offset + p.width / 2) - Math.max(a, p.offset - p.width / 2);
      const overlapY = Math.min(o.sill + o.height, p.sill + p.height) - Math.max(o.sill, p.sill);
      if (overlapX > 0 && overlapY > 0) out.push(room(`${name} mbivendoset me një hapje tjetër.`, 'warn', o.id));
    }
  }
  return out;
}
