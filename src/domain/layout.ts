import { materialById, SHEET, SLIDE_LENGTHS } from './catalog';
import { DEFAULT_DRAWER_HEIGHT, itemInterval, sortItems } from './interior';
import type { CabinetConfig, Column, ColumnDoors, Fixture, InteriorItem, Layout, Part, Warning } from './types';

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
const ITEM_NAMES = { shelf: 'Rafti', rod: 'Shufra varëse', drawer: 'Sirtari' } as const;

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

/** Ids of the 3D parts / fixtures an interior item turns into (see the column loop in buildLayout). */
export function itemPartIds(it: InteriorItem): string[] {
  if (it.type === 'shelf') return [`shelf-${it.id}`];
  if (it.type === 'rod') return [`rod-${it.id}`];
  return [`dfront-${it.id}`, `dside-${it.id}--1`, `dside-${it.id}-1`, `dend-${it.id}--1`, `dend-${it.id}-1`, `dbottom-${it.id}`];
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
  // Separate modules: every section is its own box, so neighbours stand side panel to side panel.
  const modular = cfg.construction === 'modules' && n > 1;
  const moduleW = W / n;
  const cw = modular ? moduleW - 2 * T : (Wi - (n - 1) * T) / n;
  const colLeft = (i: number) => (modular ? -W / 2 + i * moduleW + T : -Wi / 2 + i * (cw + T));
  /** x of the line between section i−1 and i: a divider's centre, or the joint between modules. */
  const boundary = (i: number) =>
    i <= 0 ? -W / 2 : i >= n ? W / 2 : modular ? -W / 2 + i * moduleW : colLeft(i) - T / 2;


  // --- Carcass ---------------------------------------------------------------
  /** One cabinet box spanning [x0, x1]: sides, top, bottom, plinth and back. */
  const addBox = (x0: number, x1: number, tag: string) => {
    const bw = x1 - x0;
    const inner = bw - 2 * T;
    const cx = (x0 + x1) / 2;
    for (const side of [-1, 1] as const) {
      parts.push({
        id: `${tag}side-${side}`,
        name: 'Anësore',
        category: 'side',
        material: 'carcass',
        length: H,
        width: Dc,
        thickness: T,
        bandLong: 1,
        bandShort: 0,
        position: [cx + side * (bw / 2 - T / 2), H / 2, zMid],
        size: [T, H, Dc],
        grain: 'y',
      });
    }
    for (const [id, name, y] of [
      ['bottom', 'Fundi (poshtë)', P + T / 2],
      ['top', 'Kapaku (lart)', H - T / 2],
    ] as const) {
      parts.push({
        id: `${tag}${id}`,
        name,
        category: 'topBottom',
        material: 'carcass',
        length: inner,
        width: Dc,
        thickness: T,
        bandLong: 1,
        bandShort: 0,
        position: [cx, y, zMid],
        size: [inner, T, Dc],
        grain: 'x',
      });
    }
    if (P > 0) {
      parts.push({
        id: `${tag}plinth`,
        name: 'Bazamenti (sokla)',
        category: 'plinth',
        material: 'carcass',
        length: inner,
        width: P,
        thickness: T,
        bandLong: 1,
        bandShort: 0,
        position: [cx, P / 2, zFront - PLINTH_RECESS - T / 2],
        size: [inner, P, T],
        grain: 'x',
      });
    }

    // Back panel: split into vertical strips if a single piece won't fit on a sheet.
    const backW = bw - 4;
    const backH = H - P - 4;
    const fitsSheet = (a: number, b: number) => Math.max(a, b) <= SHEET.length && Math.min(a, b) <= SHEET.width;
    let backPieces = 1;
    while (!fitsSheet(backW / backPieces, backH) && backPieces < 8) backPieces++;
    const pieceW = backW / backPieces;
    for (let i = 0; i < backPieces; i++) {
      parts.push({
        id: `${tag}back-${i}`,
        name: 'Shpina (HDF)',
        category: 'back',
        material: 'back',
        length: backH,
        width: pieceW,
        thickness: Tb,
        bandLong: 0,
        bandShort: 0,
        position: [cx - backW / 2 + pieceW * (i + 0.5), P + 2 + backH / 2, -D / 2 + Tb / 2],
        size: [pieceW - (backPieces > 1 ? 1 : 0), backH, Tb],
        grain: 'y',
      });
    }
  };

  if (modular) {
    for (let i = 0; i < n; i++) addBox(boundary(i), boundary(i + 1), `m${i}-`);
  } else {
    addBox(-W / 2, W / 2, '');
  }

  // --- Columns, dividers and interior ------------------------------------------
  for (let i = 0; i < (modular ? 0 : n - 1); i++) {
    parts.push({
      id: `divider-${i}`,
      name: 'Ndarëse',
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
    const label = `seksionin ${ci + 1}`;
    const sorted = sortItems(col.items);

    // Validation: bounds and overlaps.
    sorted.forEach((it, idx) => {
      const [lo, hi] = itemInterval(it, T);
      if (lo < 0 || hi > Hi) {
        warnings.push({
          level: 'error',
          message: `${ITEM_NAMES[it.type]} në ${label} del jashtë hapësirës së brendshme (0–${Math.round(Hi)} mm).`,
          focus: { tab: 'interior', column: ci, itemIds: [it.id], partIds: itemPartIds(it) },
        });
      }
      const next = sorted[idx + 1];
      if (next) {
        const [nlo] = itemInterval(next, T);
        if (nlo < hi - 0.5) {
          warnings.push({
            level: 'error',
            message: `${ITEM_NAMES[it.type]} dhe ${ITEM_NAMES[next.type].toLowerCase()} mbivendosen në ${label}.`,
            focus: { tab: 'interior', column: ci, itemIds: [it.id, next.id], partIds: [...itemPartIds(it), ...itemPartIds(next)] },
          });
        }
      }
    });

    for (const it of sorted) {
      if (it.type === 'shelf') {
        const len = cw - 2;
        if (len > 900 && T <= 19) {
          warnings.push({
            level: 'warn',
            message: `Rafti ${Math.round(len)} mm në ${label} mund të përkulet — shtoni ndarëse ose pllakë më të trashë.`,
            focus: { tab: 'interior', column: ci, itemIds: [it.id], partIds: itemPartIds(it) },
          });
        }
        parts.push({
          id: `shelf-${it.id}`,
          name: 'Raft',
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
          warnings.push({
            level: 'error',
            message: `Nuk ka thellësi të mjaftueshme për shinat e sirtarit në ${label}.`,
            focus: { tab: 'size', field: 'depth', column: ci },
          });
          continue;
        }
        const key = `drawer-${it.id}`;
        const motion = { key, type: 'drawer' as const, travel: slideLen * 0.8 };
        const frontW = cw - 4;
        const frontH = h - 4;
        const frontY = floorY + it.y + h / 2;
        parts.push({
          id: `dfront-${it.id}`,
          name: 'Balli i sirtarit',
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
        if (boxH < 80) {
          warnings.push({
            level: 'warn',
            message: `Sirtari në ${label} është shumë i ulët (${h} mm).`,
            focus: { tab: 'interior', column: ci, itemIds: [it.id], partIds: itemPartIds(it) },
          });
        }

        for (const s of [-1, 1] as const) {
          parts.push({
            id: `dside-${it.id}-${s}`,
            name: 'Anësore sirtari',
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
            name: 'Para/prapa sirtari',
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
          name: 'Fundi i sirtarit (HDF)',
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
        name: 'Derë',
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
        const x0 = ci === 0 ? -W / 2 + 2 : boundary(ci) + DOOR_GAP / 2;
        const x1 = ci === n - 1 ? W / 2 - 2 : boundary(ci + 1) - DOOR_GAP / 2;
        const rows: [number, number, 'low' | 'mid' | 'high'][] = [];
        const firstDoor = doorInfo.count;
        const badSplit = d.split != null && (d.split < 100 || d.split > Hi - 100);
        if (d.split == null) {
          rows.push([doorBottom, doorTop, 'mid']);
        } else {
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
        if (badSplit) {
          const ids = Array.from({ length: doorInfo.count - firstDoor }, (_, k) => `door-${firstDoor + k}`);
          warnings.push({
            level: 'warn',
            message: `Ndarja e dyerve në seksionin ${ci + 1} është shumë afër lartë ose poshtë.`,
            focus: { tab: 'doors', column: ci, partIds: ids },
          });
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

    const doorsWhere = (test: (p: Part) => boolean) => parts.filter((p) => p.category === 'door' && test(p)).map((p) => p.id);
    if (doorInfo.width > 650) {
      warnings.push({
        level: 'warn',
        message: `Dyer deri në ${Math.round(doorInfo.width)} mm të gjera — mbi 600 mm nuk rekomandohet; shtoni dyer.`,
        focus: { tab: 'doors', field: cfg.doorLayout === 'even' ? 'doorCount' : undefined, partIds: doorsWhere((p) => p.width > 650) },
      });
    }
    if (doorInfo.height > 2400) {
      warnings.push({
        level: 'warn',
        message: `Dyert janë ${Math.round(doorInfo.height)} mm të larta — mund të shtrembërohen; ndajini lart/poshtë.`,
        focus: { tab: 'doors', partIds: doorsWhere((p) => p.length > 2400) },
      });
    }
  } else if (cfg.doorType === 'sliding') {
    const nd = Math.min(4, Math.max(2, cfg.doorCount));
    const dh = H - P - 4;
    const dw = (W + (nd - 1) * SLIDING_OVERLAP) / nd;
    const weight = (dw * dh * T * 1e-9) * density;
    doorInfo = { count: nd, width: dw, height: dh, weightKg: weight, hingeTotal: 0 };
    const allDoors = Array.from({ length: nd }, (_, i) => `door-${i}`);
    if (dw < 500) {
      warnings.push({
        level: 'warn',
        message: `Dyert rrëshqitëse janë vetëm ${Math.round(dw)} mm të gjera — përdorni më pak dyer.`,
        focus: { tab: 'doors', field: 'doorCount', partIds: allDoors },
      });
    }
    if (weight > 40) {
      warnings.push({
        level: 'warn',
        message: `Çdo derë rrëshqitëse peshon ~${weight.toFixed(0)} kg — kontrolloni kapacitetin e shinës.`,
        focus: { tab: 'doors', field: 'doorCount', partIds: allDoors },
      });
    }

    const y = P + 2 + dh / 2;
    for (let i = 0; i < nd; i++) {
      const front = i % 2 === 1;
      const z = front ? D / 2 - T / 2 : D / 2 - T * 1.5 - 8;
      const x = -W / 2 + dw / 2 + i * (dw - SLIDING_OVERLAP);
      const key = `door-${i}`;
      parts.push({
        id: key,
        name: 'Derë rrëshqitëse',
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

  // Carcass-wide checks run last so they can point at the parts they concern.
  const idsOf = (...cats: string[]) => parts.filter((p) => cats.includes(p.category)).map((p) => p.id);
  if (Dc < 250) {
    warnings.unshift({
      level: 'error',
      message: `Thellësia e korpusit është vetëm ${Math.round(Dc)} mm — rriteni thellësinë.`,
      focus: { tab: 'size', field: 'depth', partIds: idsOf('side', 'topBottom') },
    });
  }
  if (Hi < 200) {
    warnings.unshift({
      level: 'error',
      message: 'Lartësia e brendshme është shumë e vogël për këtë bazament / lartësi.',
      focus: { tab: 'size', field: 'plinth', partIds: idsOf('side', 'plinth') },
    });
  }
  if (cw < 250) {
    warnings.unshift({
      level: 'warn',
      message: `Seksionet janë vetëm ${Math.round(cw)} mm të gjera — përdorni më pak seksione.`,
      focus: { tab: 'size', field: 'sections', partIds: idsOf('divider', 'side') },
    });
  }

  return {
    parts,
    fixtures,
    warnings,
    interior: { width: modular ? n * cw : Wi, height: Hi, depth: Dc, columnWidth: cw, floorY },
    doors: doorInfo,
  };
}
