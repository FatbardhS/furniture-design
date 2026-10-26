import { materialById, SHEET, SLIDE_LENGTHS } from './catalog';
import { DEFAULT_DRAWER_HEIGHT, itemInterval, sortItems } from './interior';
import type { CabinetConfig, Column, ColumnDoors, Fixture, Layout, Part, Warning } from './types';

/** Gap between adjacent doors and around overlay doors. */
export const DOOR_GAP = 3;
/** Shelves sit back from the carcass front so doors and inner drawers clear them. */
export const SHELF_SETBACK = 20;
/** Plinth board is recessed from the carcass front. */
export const PLINTH_RECESS = 40;
/** Overlap between neighbouring sliding doors. */
export const SLIDING_OVERLAP = 30;
/** Inner drawers behind doors are set back so their handles clear the closed doors. */
export const INNER_DRAWER_SETBACK = 30;
/** Hinge count rules by door height (mm). */
const HINGE_HEIGHT_RULES: [number, number][] = [
  [900, 2],
  [1600, 3],
  [2000, 4],
  [2400, 5],
];
/** Rough load per hinge (kg) before another hinge is required. */
const KG_PER_HINGE = 5;
const SLIDE_SIDE_CLEARANCE = { ballBearing: 12.5, softCloseUndermount: 5 } as const;
const BAR_LENGTHS = [96, 128, 160, 192, 256, 320];

export function hingesForDoor(heightMm: number, weightKg: number): number {
  const byHeight = HINGE_HEIGHT_RULES.find(([h]) => heightMm <= h)?.[1] ?? 6;
  return Math.max(2, byHeight, Math.ceil(weightKg / KG_PER_HINGE));
}

/** Depth taken up in front of the carcass by the doors (overall depth stays as configured). */
export function frontAllowance(cfg: CabinetConfig): number {
  if (cfg.doorType === 'hinged') return cfg.thickness + 2;
  if (cfg.doorType === 'sliding') return cfg.thickness * 2 + 16;
  return 0;
}

/**
 * Doors for a column in the per-section layout. Columns the user hasn't configured get one door
 * (two if the column is wider than 600 mm), hinged towards the nearer outside edge.
 */
export function columnDoors(col: Column, index: number, columnCount: number, columnWidth: number): ColumnDoors {
  return col.doors ?? { count: columnWidth > 600 ? 2 : 1, hinge: index < columnCount / 2 ? 'left' : 'right', split: null };
}

const barLength = (space: number) => [...BAR_LENGTHS].reverse().find((l) => l <= space) ?? BAR_LENGTHS[0];

/**
 * Turn a configuration into physical parts. This is the single source of truth: the 3D renderer
 * draws exactly these parts and the BOM / cut list is computed from them.
 *
 * Coordinates (mm): x = 0 at the cabinet centre, y = 0 on the floor, z = -depth/2 at the back.
 */
export function buildLayout(cfg: CabinetConfig): Layout {
  const { width: W, height: H, depth: D, thickness: T, backThickness: Tb } = cfg;
  const P = Math.max(0, cfg.plinthHeight);
  const parts: Part[] = [];
  const fixtures: Fixture[] = [];
  const warnings: Warning[] = [];
  const hasDoors = cfg.doorType !== 'none';

  const Dc = D - Tb - frontAllowance(cfg);
  const zBack = -D / 2 + Tb;
  const zFront = zBack + Dc;
  const zMid = zBack + Dc / 2;
  const Wi = W - 2 * T;
  const floorY = P + T;
  const Hi = H - P - 2 * T;
  const n = Math.max(1, cfg.columns.length);
  const cw = (Wi - (n - 1) * T) / n;

  if (Dc < 250) warnings.push({ level: 'error', message: `Carcass depth is only ${Math.round(Dc)} mm — increase overall depth.` });
  if (Hi < 200) warnings.push({ level: 'error', message: 'Interior height is too small for this plinth / height combination.' });
  if (cw < 250) warnings.push({ level: 'warn', message: `Columns are only ${Math.round(cw)} mm wide — consider fewer columns.` });

  // --- Carcass ---------------------------------------------------------------
  for (const side of [-1, 1] as const) {
    parts.push({
      id: `side-${side}`,
      name: 'Side panel',
      category: 'side',
      material: 'carcass',
      length: H,
      width: Dc,
      thickness: T,
      bandLong: 1,
      bandShort: 0,
      position: [side * (W / 2 - T / 2), H / 2, zMid],
      size: [T, H, Dc],
      grain: 'y',
    });
  }
  for (const [id, name, y] of [
    ['bottom', 'Bottom panel', P + T / 2],
    ['top', 'Top panel', H - T / 2],
  ] as const) {
    parts.push({
      id,
      name,
      category: 'topBottom',
      material: 'carcass',
      length: Wi,
      width: Dc,
      thickness: T,
      bandLong: 1,
      bandShort: 0,
      position: [0, y, zMid],
      size: [Wi, T, Dc],
      grain: 'x',
    });
  }
  if (P > 0) {
    parts.push({
      id: 'plinth',
      name: 'Plinth (toe kick)',
      category: 'plinth',
      material: 'carcass',
      length: Wi,
      width: P,
      thickness: T,
      bandLong: 1,
      bandShort: 0,
      position: [0, P / 2, zFront - PLINTH_RECESS - T / 2],
      size: [Wi, P, T],
      grain: 'x',
    });
  }

  // Back panel: split into vertical strips if a single piece won't fit on a sheet.
  const backW = W - 4;
  const backH = H - P - 4;
  const fitsSheet = (a: number, b: number) =>
    (Math.max(a, b) <= SHEET.length && Math.min(a, b) <= SHEET.width);
  let backPieces = 1;
  while (!fitsSheet(backW / backPieces, backH) && backPieces < 8) backPieces++;
  const pieceW = backW / backPieces;
  for (let i = 0; i < backPieces; i++) {
    parts.push({
      id: `back-${i}`,
      name: 'Back panel (HDF)',
      category: 'back',
      material: 'back',
      length: backH,
      width: pieceW,
      thickness: Tb,
      bandLong: 0,
      bandShort: 0,
      position: [-backW / 2 + pieceW * (i + 0.5), P + 2 + backH / 2, -D / 2 + Tb / 2],
      size: [pieceW - (backPieces > 1 ? 1 : 0), backH, Tb],
      grain: 'y',
    });
  }

  // --- Columns, dividers and interior ------------------------------------------
  const colLeft = (i: number) => -Wi / 2 + i * (cw + T);
  for (let i = 0; i < n - 1; i++) {
    parts.push({
      id: `divider-${i}`,
      name: 'Divider',
      category: 'divider',
      material: 'carcass',
      length: Hi,
      width: Dc,
      thickness: T,
      bandLong: 1,
      bandShort: 0,
      position: [colLeft(i) + cw + T / 2, floorY + Hi / 2, zMid],
      size: [T, Hi, Dc],
      grain: 'y',
    });
  }

  const slideLen = [...SLIDE_LENGTHS].reverse().find((l) => l <= Dc - T - 10 - (hasDoors ? INNER_DRAWER_SETBACK : 0));
  const drawerFrontZ = zFront - T / 2 - (hasDoors ? INNER_DRAWER_SETBACK : 0);

  cfg.columns.forEach((col, ci) => {
    const cx = colLeft(ci) + cw / 2;
    const label = `column ${ci + 1}`;
    const sorted = sortItems(col.items);

    // Validation: bounds and overlaps.
    sorted.forEach((it, idx) => {
      const [lo, hi] = itemInterval(it, T);
      if (lo < 0 || hi > Hi) warnings.push({ level: 'error', message: `A ${it.type} in ${label} is outside the interior (0–${Math.round(Hi)} mm).` });
      const next = sorted[idx + 1];
      if (next) {
        const [nlo] = itemInterval(next, T);
        if (nlo < hi - 0.5) warnings.push({ level: 'error', message: `A ${it.type} and a ${next.type} overlap in ${label}.` });
      }
    });

    for (const it of sorted) {
      if (it.type === 'shelf') {
        const len = cw - 2;
        if (len > 900 && T <= 19) warnings.push({ level: 'warn', message: `Shelf span of ${Math.round(len)} mm in ${label} may sag — add a divider or use thicker board.` });
        parts.push({
          id: `shelf-${it.id}`,
          name: 'Shelf',
          category: 'shelf',
          material: 'carcass',
          length: len,
          width: Dc - SHELF_SETBACK,
          thickness: T,
          bandLong: 1,
          bandShort: 0,
          position: [cx, floorY + it.y + T / 2, zBack + (Dc - SHELF_SETBACK) / 2],
          size: [len, T, Dc - SHELF_SETBACK],
          grain: 'x',
        });
      } else if (it.type === 'rod') {
        fixtures.push({ kind: 'rod', id: `rod-${it.id}`, position: [cx, floorY + it.y, zMid], length: cw - 4 });
      } else {
        const h = it.height ?? DEFAULT_DRAWER_HEIGHT;
        if (!slideLen) {
          warnings.push({ level: 'error', message: `Not enough depth for drawer slides in ${label}.` });
          continue;
        }
        const key = `drawer-${it.id}`;
        const motion = { key, type: 'drawer' as const, travel: slideLen * 0.8 };
        const frontW = cw - 4;
        const frontH = h - 4;
        const frontY = floorY + it.y + h / 2;
        parts.push({
          id: `dfront-${it.id}`,
          name: 'Drawer front',
          category: 'drawerFront',
          material: 'front',
          length: frontW,
          width: frontH,
          thickness: T,
          bandLong: 2,
          bandShort: 2,
          position: [cx, frontY, drawerFrontZ],
          size: [frontW, frontH, T],
          grain: 'x',
          motion,
        });

        const clear = SLIDE_SIDE_CLEARANCE[cfg.slideType];
        const boxW = cw - 2 * clear;
        const boxD = slideLen;
        const boxH = Math.max(60, h - 50);
        const boxBottom = floorY + it.y + 15;
        const boxZ = drawerFrontZ - T / 2 - boxD / 2;
        if (boxH < 80) warnings.push({ level: 'warn', message: `Drawer in ${label} is very shallow (${h} mm).` });

        for (const s of [-1, 1] as const) {
          parts.push({
            id: `dside-${it.id}-${s}`,
            name: 'Drawer side',
            category: 'drawerSide',
            material: 'carcass',
            length: boxD,
            width: boxH,
            thickness: T,
            bandLong: 1,
            bandShort: 0,
            position: [cx + s * (boxW / 2 - T / 2), boxBottom + boxH / 2, boxZ],
            size: [T, boxH, boxD],
            grain: 'z',
            motion,
          });
        }
        for (const e of [-1, 1] as const) {
          parts.push({
            id: `dend-${it.id}-${e}`,
            name: 'Drawer box front/back',
            category: 'drawerEnd',
            material: 'carcass',
            length: boxW - 2 * T,
            width: boxH,
            thickness: T,
            bandLong: 1,
            bandShort: 0,
            position: [cx, boxBottom + boxH / 2, boxZ + e * (boxD / 2 - T / 2)],
            size: [boxW - 2 * T, boxH, T],
            grain: 'x',
            motion,
          });
        }
        parts.push({
          id: `dbottom-${it.id}`,
          name: 'Drawer bottom (HDF)',
          category: 'drawerBottom',
          material: 'back',
          length: boxW,
          width: boxD,
          thickness: Tb,
          bandLong: 0,
          bandShort: 0,
          position: [cx, boxBottom - Tb / 2, boxZ],
          size: [boxW, Tb, boxD],
          grain: 'x',
          motion,
        });

        if (cfg.handleType !== 'none') {
          fixtures.push({
            kind: 'handle',
            id: `dhandle-${it.id}`,
            position: [cx, frontY, drawerFrontZ + T / 2],
            orientation: 'horizontal',
            length: cfg.handleType === 'bar' ? barLength(frontW * 0.5) : 0,
            motionKey: key,
          });
        }
      }
    }
  });

  // --- Doors -----------------------------------------------------------------
  let doorInfo = { count: 0, width: 0, height: 0, weightKg: 0, hingeTotal: 0 };
  const density = materialById(cfg.frontFinish.materialId).density;

  if (cfg.doorType === 'hinged') {
    const z = zFront + 2 + T / 2;
    const doorBottom = P + 2;
    const doorTop = H - 2;

    /**
     * One overlay door spanning [x0, x1] × [y0, y1]. The handle goes on the free edge: near the
     * bottom of an upper door, near the top of a lower door, or at a comfortable height otherwise.
     */
    const addDoor = (x0: number, x1: number, y0: number, y1: number, hingeLeft: boolean, handleAt: 'low' | 'mid' | 'high') => {
      const dw = x1 - x0;
      const dh = y1 - y0;
      if (dw < 50 || dh < 50) return;
      const x = (x0 + x1) / 2;
      const y = (y0 + y1) / 2;
      const weight = dw * dh * T * 1e-9 * density;
      doorInfo.count++;
      doorInfo.hingeTotal += hingesForDoor(dh, weight);
      if (dw * dh > doorInfo.width * doorInfo.height) doorInfo = { ...doorInfo, width: dw, height: dh, weightKg: weight };

      const key = `door-${doorInfo.count - 1}`;
      parts.push({
        id: key,
        name: 'Door',
        category: 'door',
        material: 'front',
        length: dh,
        width: dw,
        thickness: T,
        bandLong: 2,
        bandShort: 2,
        position: [x, y, z],
        size: [dw, dh, T],
        grain: 'y',
        motion: { key, type: 'hinge', pivot: [hingeLeft ? x0 : x1, 0, z - T / 2], dir: hingeLeft ? -1 : 1 },
      });
      if (cfg.handleType !== 'none') {
        const len = cfg.handleType === 'bar' ? barLength(Math.min(320, dh * 0.3)) : 0;
        const comfy = dh > 1300 ? Math.min(y, 1050) : y;
        const handleY =
          handleAt === 'high' ? Math.min(y1 - 80 - len / 2, Math.max(y, 1050)) :
          handleAt === 'low' ? Math.max(y0 + 80 + len / 2, Math.min(y, 1050)) :
          comfy;
        fixtures.push({
          kind: 'handle',
          id: `handle-${key}`,
          position: [hingeLeft ? x1 - 40 : x0 + 40, handleY, z + T / 2],
          orientation: 'vertical',
          length: len,
          motionKey: key,
        });
      }
    };

    if (cfg.doorLayout === 'perColumn') {
      cfg.columns.forEach((col, ci) => {
        const d = columnDoors(col, ci, n, cw);
        if (!d.count) return;
        // Outer doors cover the side panel fully; doors meeting at a divider each cover half of it.
        const x0 = ci === 0 ? -W / 2 + 2 : colLeft(ci) - T / 2 + DOOR_GAP / 2;
        const x1 = ci === n - 1 ? W / 2 - 2 : colLeft(ci) + cw + T / 2 - DOOR_GAP / 2;
        const rows: [number, number, 'low' | 'mid' | 'high'][] = [];
        if (d.split == null) {
          rows.push([doorBottom, doorTop, 'mid']);
        } else {
          if (d.split < 100 || d.split > Hi - 100) {
            warnings.push({ level: 'warn', message: `Door split in column ${ci + 1} is too close to the top or bottom.` });
          }
          const s = floorY + d.split;
          rows.push([doorBottom, s - DOOR_GAP / 2, 'high'], [s + DOOR_GAP / 2, doorTop, 'low']);
        }
        for (const [y0, y1, handleAt] of rows) {
          if (d.count === 1) {
            addDoor(x0, x1, y0, y1, d.hinge === 'left', handleAt);
          } else {
            const mid = (x0 + x1) / 2;
            addDoor(x0, mid - DOOR_GAP / 2, y0, y1, true, handleAt);
            addDoor(mid + DOOR_GAP / 2, x1, y0, y1, false, handleAt);
          }
        }
      });
    } else {
      const nd = Math.min(8, Math.max(1, cfg.doorCount));
      const dw = (W - 4 - DOOR_GAP * (nd - 1)) / nd;
      for (let i = 0; i < nd; i++) {
        const x0 = -W / 2 + 2 + i * (dw + DOOR_GAP);
        addDoor(x0, x0 + dw, doorBottom, doorTop, nd === 1 || i < nd / 2, 'mid');
      }
    }

    if (doorInfo.width > 650) warnings.push({ level: 'warn', message: `Hinged doors up to ${Math.round(doorInfo.width)} mm wide — more than 600 mm is not recommended; add doors.` });
    if (doorInfo.height > 2400) warnings.push({ level: 'warn', message: `Doors are ${Math.round(doorInfo.height)} mm tall — tall doors may warp; consider splitting them.` });
  } else if (cfg.doorType === 'sliding') {
    const nd = Math.min(4, Math.max(2, cfg.doorCount));
    const dh = H - P - 4;
    const dw = (W + (nd - 1) * SLIDING_OVERLAP) / nd;
    const weight = (dw * dh * T * 1e-9) * density;
    doorInfo = { count: nd, width: dw, height: dh, weightKg: weight, hingeTotal: 0 };
    if (dw < 500) warnings.push({ level: 'warn', message: `Sliding doors are only ${Math.round(dw)} mm wide — use fewer doors.` });
    if (weight > 40) warnings.push({ level: 'warn', message: `Each sliding door weighs ~${weight.toFixed(0)} kg — check the track's load rating.` });

    const y = P + 2 + dh / 2;
    for (let i = 0; i < nd; i++) {
      const front = i % 2 === 1;
      const z = front ? D / 2 - T / 2 : D / 2 - T * 1.5 - 8;
      const x = -W / 2 + dw / 2 + i * (dw - SLIDING_OVERLAP);
      const key = `door-${i}`;
      parts.push({
        id: key,
        name: 'Sliding door',
        category: 'door',
        material: 'front',
        length: dh,
        width: dw,
        thickness: T,
        bandLong: 2,
        bandShort: 2,
        position: [x, y, z],
        size: [dw, dh, T],
        grain: 'y',
        // Front-track doors slide left over their neighbour; rear-track doors stay put.
        motion: { key, type: 'slide', travel: front ? -(dw - SLIDING_OVERLAP) : 0 },
      });
      if (cfg.handleType !== 'none') {
        const rightEdge = i === nd - 1 || (front && i !== 0);
        fixtures.push({
          kind: 'handle',
          id: `handle-${key}`,
          position: [rightEdge ? x + dw / 2 - 70 : x - dw / 2 + 70, Math.min(y, 1050), z + T / 2],
          orientation: 'vertical',
          length: cfg.handleType === 'bar' ? barLength(Math.min(320, dh * 0.3)) : 0,
          motionKey: key,
        });
      }
    }
  }

  return {
    parts,
    fixtures,
    warnings,
    interior: { width: Wi, height: Hi, depth: Dc, columnWidth: cw, floorY },
    doors: doorInfo,
  };
}
