import { materialById, SHEET, SLIDE_LENGTHS } from './catalog';
import { DEFAULT_DRAWER_HEIGHT, itemInterval, sortItems } from './interior';
import { buildRoomItems } from './room';
import { fmtLen } from './units';
import type { CabinetConfig, Column, ColumnDoors, Fixture, FrontStyle, HandleType, InteriorItem, Layout, Motion, Part, Placement, SlideType, Warning } from './types';

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
/**
 * Behind hinged doors, inner drawers run on spacer strips (one board thick) so an open door,
 * which stands in front of the side panel, doesn't catch the drawer front.
 */
export const DRAWER_SPACER = 18;
/** Doors next to an outer side open this far (degrees); doors meeting a neighbour or a corner stop at 90°. */
export const OUTER_DOOR_ANGLE = 105;
export const INNER_DOOR_ANGLE = 90;
/** Extra width of the blind corner beyond the wing's depth, so doors and handles on both runs clear. */
export const CORNER_CLEARANCE = 60;
/** Ids of the corner wing's parts start with this, and their group is 'wing'. */
export const WING_PREFIX = 'w:';
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
/** Warnings speak centimetres, like the rest of the interface. */
const cm = (mm: number) => fmtLen(mm, 'cm');
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

/**
 * Outer width of each section in mm, summing to the overall width. Sections without an explicit
 * width share equally; explicit widths are scaled if the overall width changed since.
 */
export function sectionWidths(cfg: CabinetConfig): number[] {
  const n = Math.max(1, cfg.columns.length);
  const raw = cfg.columns.length ? cfg.columns.map((c) => c.width ?? cfg.width / n) : [cfg.width];
  const sum = raw.reduce((s, v) => s + v, 0);
  return raw.map((v) => (v * cfg.width) / sum);
}

/** Ids of the 3D parts / fixtures an interior item turns into (see the column loop in buildLayout). */
export function itemPartIds(it: InteriorItem): string[] {
  if (it.type === 'shelf') return [`shelf-${it.id}`];
  if (it.type === 'rod') return [`rod-${it.id}`];
  return [
    `dfront-${it.id}`, `dside-${it.id}--1`, `dside-${it.id}-1`, `dend-${it.id}--1`, `dend-${it.id}-1`, `dbottom-${it.id}`,
    `dspacer-${it.id}--1`, `dspacer-${it.id}-1`,
  ];
}

export interface DrawerSpec {
  /** Id stem: parts become dfront-<id>, dside-<id>-±1, … */
  id: string;
  /** Prefix for part ids and the motion key (room items, wing). */
  prefix?: string;
  group?: string;
  frontX: number;
  frontY: number;
  frontW: number;
  frontH: number;
  /** z of the drawer front's centre. */
  frontZ: number;
  boxW: number;
  boxBottom: number;
  boxH: number;
  slideLen: number;
  T: number;
  Tb: number;
  handleType: HandleType;
  /** Front design when it differs from the wardrobe's (room items). */
  style?: FrontStyle;
}

/** One drawer: front, box (sides, ends, bottom) and handle, all moving together on its slides. */
export function addDrawer(parts: Part[], fixtures: Fixture[], d: DrawerSpec) {
  const pre = d.prefix ?? '';
  const { id, T, Tb, group } = d;
  const key = `${pre}drawer-${id}`;
  const motion: Motion = { key, type: 'drawer', travel: d.slideLen * 0.8 };
  parts.push({
    id: `${pre}dfront-${id}`,
    name: 'Balli i sirtarit',
    category: 'drawerFront',
    material: 'front',
    length: d.frontW,
    width: d.frontH,
    thickness: T,
    bandLong: 2,
    bandShort: 2,
    position: [d.frontX, d.frontY, d.frontZ],
    size: [d.frontW, d.frontH, T],
    grain: 'x',
    motion,
    group,
    style: d.style,
  });
  const boxD = d.slideLen;
  const boxZ = d.frontZ - T / 2 - boxD / 2;
  for (const s of [-1, 1] as const) {
    parts.push({
      id: `${pre}dside-${id}-${s}`,
      name: 'Anësore sirtari',
      category: 'drawerSide',
      material: 'carcass',
      length: boxD,
      width: d.boxH,
      thickness: T,
      bandLong: 1,
      bandShort: 0,
      position: [d.frontX + s * (d.boxW / 2 - T / 2), d.boxBottom + d.boxH / 2, boxZ],
      size: [T, d.boxH, boxD],
      grain: 'z',
      motion,
      group,
    });
  }
  for (const e of [-1, 1] as const) {
    parts.push({
      id: `${pre}dend-${id}-${e}`,
      name: 'Para/prapa sirtari',
      category: 'drawerEnd',
      material: 'carcass',
      length: d.boxW - 2 * T,
      width: d.boxH,
      thickness: T,
      bandLong: 1,
      bandShort: 0,
      position: [d.frontX, d.boxBottom + d.boxH / 2, boxZ + e * (boxD / 2 - T / 2)],
      size: [d.boxW - 2 * T, d.boxH, T],
      grain: 'x',
      motion,
      group,
    });
  }
  parts.push({
    id: `${pre}dbottom-${id}`,
    name: 'Fundi i sirtarit (HDF)',
    category: 'drawerBottom',
    material: 'back',
    length: d.boxW,
    width: boxD,
    thickness: Tb,
    bandLong: 0,
    bandShort: 0,
    position: [d.frontX, d.boxBottom - Tb / 2, boxZ],
    size: [d.boxW, Tb, boxD],
    grain: 'x',
    motion,
    group,
  });
  if (d.handleType !== 'none') {
    fixtures.push({
      kind: 'handle',
      id: `${pre}dhandle-${id}`,
      // Edge pulls and gola profiles sit on the drawer's top edge; others are centred.
      position: [d.frontX, onEdge(d.handleType) ? d.frontY + d.frontH / 2 : d.frontY, d.frontZ + T / 2],
      orientation: 'horizontal',
      length: handleLength(d.handleType, d.frontW, 0.5),
      side: 1,
      motionKey: key,
      group,
    });
  }
}

/** Longest standard slide that fits in `depth` mm of carcass. */
export const slideFor = (depth: number) => [...SLIDE_LENGTHS].reverse().find((l) => l <= depth);
/** Side clearance each slide type needs between drawer box and carcass. */
export const slideClearance = (t: SlideType) => SLIDE_SIDE_CLEARANCE[t];

/** Design of a front: a door's own override, else the wardrobe-wide design. */
export const frontStyleOf = (cfg: CabinetConfig, part: Part): FrontStyle =>
  part.style ?? ((part.category === 'door' && cfg.doorStyles?.[part.id]) || cfg.frontStyle);

/** Edge pulls and gola profiles mount on the front's edge rather than inset on its face. */
const onEdge = (type: HandleType) => type === 'edge' || type === 'gola';

/** Handle length in mm for a front that is `run` mm long in the handle's direction. */
function handleLength(type: HandleType, run: number, barShare: number): number {
  switch (type) {
    case 'bar':
    case 'square':
      return barLength(Math.min(320, run * barShare));
    case 'long':
      return Math.min(1000, Math.round(run * 0.55));
    case 'edge':
      return Math.min(200, Math.round(run * 0.4));
    case 'gola':
      return run - 10;
    default:
      return 0;
  }
}

const barLength = (space: number) => [...BAR_LENGTHS].reverse().find((l) => l <= space) ?? BAR_LENGTHS[0];

/** How one straight run of wardrobe meets a corner. */
interface RunOptions {
  /** Width (mm) at the left / right end hidden behind the other run: covered by a filler, no doors. */
  blindLeft?: number;
  blindRight?: number;
  /** This end meets a corner: the door there hinges away from it and opens only 90°. */
  tightLeft?: boolean;
  tightRight?: boolean;
}

type RunLayout = Omit<Layout, 'groups' | 'mirrorArea' | 'upholsteryArea' | 'wing'>;

/**
 * Turn a configuration into physical parts. This is the single source of truth: the 3D renderer
 * draws exactly these parts and the BOM / cut list is computed from them.
 *
 * Coordinates (mm): x = 0 at the cabinet centre, y = 0 on the floor, z = -depth/2 at the back.
 */
export function buildLayout(cfg: CabinetConfig): Layout {
  const side = cfg.corner?.side ?? 'none';
  const groups: Record<string, Placement> = {};
  const blind = cfg.depth + CORNER_CLEARANCE;
  const main = buildRun(
    cfg,
    side === 'left' ? { blindLeft: blind, tightLeft: true } : side === 'right' ? { blindRight: blind, tightRight: true } : {},
  );
  const parts = [...main.parts];
  const fixtures = [...main.fixtures];
  const warnings = [...main.warnings];
  const doors = { ...main.doors };
  let wing: Layout['wing'];

  if (side !== 'none') {
    const wcfg = wingConfig(cfg);
    // Left wing: its right end meets the main run; right wing: its left end.
    const w = buildRun(wcfg, side === 'left' ? { tightRight: true } : { tightLeft: true });
    const pre = (id: string) => WING_PREFIX + id;
    groups.wing = {
      position: [side === 'left' ? -cfg.width / 2 + cfg.depth / 2 : cfg.width / 2 - cfg.depth / 2, 0, cfg.depth / 2 + 2 + wcfg.width / 2],
      rotation: side === 'left' ? 90 : -90,
    };
    const preMotion = (m: Motion | undefined): Motion | undefined => (m ? { ...m, key: pre(m.key) } : undefined);
    parts.push(...w.parts.map((p) => ({ ...p, id: pre(p.id), motion: preMotion(p.motion), group: 'wing' })));
    fixtures.push(...w.fixtures.map((f) => ({ ...f, id: pre(f.id), motionKey: f.motionKey && pre(f.motionKey), group: 'wing' })));
    warnings.push(
      ...w.warnings.map((x) => ({
        ...x,
        message: `Krahu i këndit: ${x.message.charAt(0).toLowerCase()}${x.message.slice(1)}`,
        focus: x.focus && { ...x.focus, wing: true, partIds: x.focus.partIds?.map(pre) },
      })),
    );
    doors.count += w.doors.count;
    doors.hingeTotal += w.doors.hingeTotal;
    if (w.doors.width * w.doors.height > doors.width * doors.height) Object.assign(doors, { width: w.doors.width, height: w.doors.height, weightKg: w.doors.weightKg });
    wing = { interior: w.interior };
    if (cfg.width < blind + 300) {
      warnings.push({
        level: 'warn',
        message: `Dollapi kryesor duhet të jetë të paktën ${cm(blind + 300)} i gjerë që këndi të ketë hapësirë për dyer.`,
        focus: { tab: 'size', field: 'corner' },
      });
    }
  }

  const room = buildRoomItems(cfg);
  parts.push(...room.parts);
  fixtures.push(...room.fixtures);
  warnings.push(...room.warnings);
  Object.assign(groups, room.groups);

  // Warnings name parts by id; drop ids that weren't built (e.g. drawer spacers without doors).
  const ids = new Set([...parts.map((p) => p.id), ...fixtures.map((f) => f.id)]);
  for (const w of warnings) if (w.focus?.partIds) w.focus = { ...w.focus, partIds: w.focus.partIds.filter((id) => ids.has(id)) };

  return { parts, fixtures, warnings, groups, interior: main.interior, doors, wing, mirrorArea: room.mirrorArea, upholsteryArea: room.upholsteryArea };
}

/**
 * The corner wing as a wardrobe of its own: same height, depth, boards, doors and fronts as the
 * main run, its own length and sections. Doors are spread evenly across it.
 */
export function wingConfig(cfg: CabinetConfig): CabinetConfig {
  const length = cfg.corner.length;
  const doorCount =
    cfg.doorType === 'sliding' ? Math.min(4, Math.max(2, Math.round(length / 900))) : Math.min(8, Math.max(1, Math.ceil((length - 4) / 600)));
  return {
    ...cfg,
    width: length,
    columns: cfg.corner.columns.length ? cfg.corner.columns : [{ id: 'wing-empty', items: [] }],
    sectionFit: { ...cfg.sectionFit, enabled: false },
    doorLayout: 'even',
    doorCount,
    corner: { side: 'none', length: 0, columns: [] },
    extras: [],
  };
}

function buildRun(cfg: CabinetConfig, opts: RunOptions): RunLayout {
  const { width: W, height: H, depth: D, thickness: T, backThickness: Tb } = cfg;
  const blindL = opts.blindLeft ?? 0;
  const blindR = opts.blindRight ?? 0;
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
  // Sections may differ in width (e.g. 120 + 120 + 60 cm). `sw` are outer shares of W; with
  // dividers the interior space is split in the same proportions.
  const sw = sectionWidths(cfg);
  const before = (arr: number[], i: number) => arr.slice(0, i).reduce((s, v) => s + v, 0);
  const cws = sw.map((s) => (modular ? s - 2 * T : ((Wi - (n - 1) * T) * s) / W));
  const colLeft = (i: number) => (modular ? -W / 2 + before(sw, i) + T : -Wi / 2 + before(cws, i) + i * T);
  /** x of the line between section i−1 and i: a divider's centre, or the joint between modules. */
  const boundary = (i: number) =>
    i <= 0 ? -W / 2 : i >= n ? W / 2 : modular ? -W / 2 + before(sw, i) : colLeft(i) - T / 2;


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
      position: [colLeft(i) + cws[i] + T / 2, floorY + Hi / 2, zMid],
      size: [T, Hi, Dc],
      grain: 'y',
    });
  }

  const slideLen = slideFor(Dc - T - 10 - (hasDoors ? INNER_DRAWER_SETBACK : 0));
  const drawerFrontZ = zFront - T / 2 - (hasDoors ? INNER_DRAWER_SETBACK : 0);
  /** Does section ci sit behind hinged doors (so its drawers need spacers)? */
  const behindHinged = (ci: number) =>
    cfg.doorType === 'hinged' && (cfg.doorLayout !== 'perColumn' || columnDoors(cfg.columns[ci], ci, n, cws[ci]).count > 0);
  /** x-range of the blind corner, covered by the filler. */
  const blindRanges: [number, number][] = [];
  if (blindL > 0) blindRanges.push([-W / 2, -W / 2 + blindL]);
  if (blindR > 0) blindRanges.push([W / 2 - blindR, W / 2]);

  cfg.columns.forEach((col, ci) => {
    const cw = cws[ci];
    const cx = colLeft(ci) + cw / 2;
    const label = `seksionin ${ci + 1}`;
    const sorted = sortItems(col.items);
    const hiddenDrawers: InteriorItem[] = [];

    // Validation: bounds and overlaps.
    sorted.forEach((it, idx) => {
      const [lo, hi] = itemInterval(it, T);
      if (lo < 0 || hi > Hi) {
        warnings.push({
          level: 'error',
          message: `${ITEM_NAMES[it.type]} në ${label} del jashtë hapësirës së brendshme (0–${cm(Hi)}).`,
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
            message: `Rafti ${cm(len)} në ${label} mund të përkulet — shtoni ndarëse ose pllakë më të trashë.`,
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
        const spacer = behindHinged(ci) ? DRAWER_SPACER : 0;
        const frontW = cw - 4 - 2 * spacer;
        const frontH = h - 4;
        const frontY = floorY + it.y + h / 2;
        const boxW = cw - 2 * SLIDE_SIDE_CLEARANCE[cfg.slideType] - 2 * spacer;
        const boxH = Math.max(60, h - 50);
        const boxBottom = floorY + it.y + 15;
        addDrawer(parts, fixtures, {
          id: it.id,
          frontX: cx,
          frontY,
          frontW,
          frontH,
          frontZ: drawerFrontZ,
          boxW,
          boxBottom,
          boxH,
          slideLen,
          T,
          Tb,
          handleType: cfg.handleType,
        });
        if (spacer) {
          for (const s of [-1, 1] as const) {
            parts.push({
              id: `dspacer-${it.id}-${s}`,
              name: 'Distancer sirtari',
              category: 'spacer',
              material: 'carcass',
              length: slideLen,
              width: h - 10,
              thickness: spacer,
              bandLong: 1,
              bandShort: 0,
              position: [cx + s * (cw / 2 - spacer / 2), frontY, drawerFrontZ - T / 2 - slideLen / 2],
              size: [spacer, h - 10, slideLen],
              grain: 'z',
            });
          }
        }
        const fx0 = cx - frontW / 2;
        const fx1 = cx + frontW / 2;
        if (blindRanges.some(([a, b]) => Math.min(b, fx1) - Math.max(a, fx0) > 5)) hiddenDrawers.push(it);
        if (boxH < 80) {
          warnings.push({
            level: 'warn',
            message: `Sirtari në ${label} është shumë i ulët (${cm(h)}).`,
            focus: { tab: 'interior', column: ci, itemIds: [it.id], partIds: itemPartIds(it) },
          });
        }
      }
    }
    if (hiddenDrawers.length) {
      warnings.push({
        level: 'warn',
        message: `${hiddenDrawers.length === 1 ? 'Sirtari' : `${hiddenDrawers.length} sirtarë`} në ${label} ${hiddenDrawers.length === 1 ? 'është' : 'janë'} pas mbulesës së këndit dhe nuk hapen — zhvendosini në një seksion tjetër.`,
        focus: { tab: 'interior', column: ci, itemIds: hiddenDrawers.map((d) => d.id), partIds: hiddenDrawers.flatMap(itemPartIds) },
      });
    }
  });

  // --- Doors -----------------------------------------------------------------
  let doorInfo = { count: 0, width: 0, height: 0, weightKg: 0, hingeTotal: 0 };
  const density = materialById(cfg.frontFinish.materialId).density;
  // Doors run between the blind corners (if any); a fixed filler panel covers each blind part.
  const xL = blindL > 0 ? -W / 2 + blindL + DOOR_GAP / 2 : -W / 2 + 2;
  const xR = blindR > 0 ? W / 2 - blindR - DOOR_GAP / 2 : W / 2 - 2;
  if (hasDoors) {
    for (const [i, [a, b]] of blindRanges.entries()) {
      const x0 = a === -W / 2 ? a + 2 : a + DOOR_GAP / 2;
      const x1 = b === W / 2 ? b - 2 : b - DOOR_GAP / 2;
      const fh = H - P - 4;
      parts.push({
        id: `corner-filler-${i}`,
        name: 'Mbulesë këndi',
        category: 'filler',
        material: 'front',
        length: fh,
        width: x1 - x0,
        thickness: T,
        bandLong: 2,
        bandShort: 2,
        position: [(x0 + x1) / 2, P + 2 + fh / 2, cfg.doorType === 'sliding' ? D / 2 - T / 2 : zFront + 2 + T / 2],
        size: [x1 - x0, fh, T],
        grain: 'y',
      });
    }
  }

  if (cfg.doorType === 'hinged') {
    const z = zFront + 2 + T / 2;
    const doorBottom = P + 2;
    const doorTop = H - 2;
    /** At a corner the door hinges away from it, so doors on both runs can open at once. */
    const hingeSide = (x0: number, x1: number, hingeLeft: boolean) =>
      opts.tightLeft && x0 <= xL + 1 ? false : opts.tightRight && x1 >= xR - 1 ? true : hingeLeft;

    /**
     * One overlay door spanning [x0, x1] × [y0, y1]. The handle goes on the free edge: near the
     * bottom of an upper door, near the top of a lower door, or at a comfortable height otherwise.
     */
    const addDoor = (x0: number, x1: number, y0: number, y1: number, hingeWanted: boolean, handleAt: 'low' | 'mid' | 'high', column?: number) => {
      const dw = x1 - x0;
      const dh = y1 - y0;
      if (dw < 50 || dh < 50) return;
      const hingeLeft = hingeSide(x0, x1, hingeWanted);
      // A door hinged on an outer side may swing past 90°; one hinged next to a neighbouring door
      // or a corner stops at 90° so the two don't run into each other.
      const outer = hingeLeft ? x0 <= -W / 2 + 3 && !opts.tightLeft : x1 >= W / 2 - 3 && !opts.tightRight;
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
        // Pivot on the front edge: the door's back corner swings inwards, clear of the carcass and of
        // a neighbouring door hinged on the same divider.
        motion: { key, type: 'hinge', pivot: [hingeLeft ? x0 : x1, 0, z + T / 2], dir: hingeLeft ? -1 : 1, angle: outer ? OUTER_DOOR_ANGLE : INNER_DOOR_ANGLE },
        column,
      });
      if (cfg.handleType !== 'none') {
        const len = handleLength(cfg.handleType, dh, 0.3);
        const comfy = dh > 1300 ? Math.min(y, 1050) : y;
        const handleY =
          handleAt === 'high' ? Math.min(y1 - 80 - len / 2, Math.max(y, 1050)) :
          handleAt === 'low' ? Math.max(y0 + 80 + len / 2, Math.min(y, 1050)) :
          comfy;
        const edge = onEdge(cfg.handleType);
        fixtures.push({
          kind: 'handle',
          id: `handle-${key}`,
          position: [hingeLeft ? x1 - (edge ? 0 : 40) : x0 + (edge ? 0 : 40), cfg.handleType === 'gola' ? y : handleY, z + T / 2],
          orientation: 'vertical',
          side: hingeLeft ? 1 : -1,
          length: len,
          motionKey: key,
        });
      }
    };

    if (cfg.doorLayout === 'perColumn') {
      cfg.columns.forEach((col, ci) => {
        const d = columnDoors(col, ci, n, cws[ci]);
        if (!d.count) return;
        // Outer doors cover the side panel fully; doors meeting at a divider each cover half of it.
        const x0 = Math.max(xL, ci === 0 ? -W / 2 + 2 : boundary(ci) + DOOR_GAP / 2);
        const x1 = Math.min(xR, ci === n - 1 ? W / 2 - 2 : boundary(ci + 1) - DOOR_GAP / 2);
        // A section entirely behind the corner filler gets no door.
        if (x1 - x0 < 150) return;
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
            addDoor(x0, x1, y0, y1, d.hinge === 'left', handleAt, ci);
          } else {
            const mid = (x0 + x1) / 2;
            addDoor(x0, mid - DOOR_GAP / 2, y0, y1, true, handleAt, ci);
            addDoor(mid + DOOR_GAP / 2, x1, y0, y1, false, handleAt, ci);
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
      const dw = (xR - xL - DOOR_GAP * (nd - 1)) / nd;
      for (let i = 0; i < nd; i++) {
        const x0 = xL + i * (dw + DOOR_GAP);
        addDoor(x0, x0 + dw, doorBottom, doorTop, nd === 1 || i < nd / 2, 'mid');
      }
    }

    const doorsWhere = (test: (p: Part) => boolean) => parts.filter((p) => p.category === 'door' && test(p)).map((p) => p.id);
    if (doorInfo.width > 650) {
      warnings.push({
        level: 'warn',
        message: `Dyer deri në ${cm(doorInfo.width)} të gjera — mbi 60 cm nuk rekomandohet; shtoni dyer.`,
        focus: { tab: 'doors', field: cfg.doorLayout === 'even' ? 'doorCount' : undefined, partIds: doorsWhere((p) => p.width > 650) },
      });
    }
    if (doorInfo.height > 2400) {
      warnings.push({
        level: 'warn',
        message: `Dyert janë ${cm(doorInfo.height)} të larta — mund të shtrembërohen; ndajini lart/poshtë.`,
        focus: { tab: 'doors', partIds: doorsWhere((p) => p.length > 2400) },
      });
    }
  } else if (cfg.doorType === 'sliding') {
    const nd = Math.min(4, Math.max(2, cfg.doorCount));
    const dh = H - P - 4;
    // Sliding doors span the run between the blind corners (the full width without a corner).
    const sL = blindL > 0 ? xL : -W / 2;
    const sR = blindR > 0 ? xR : W / 2;
    const dw = (sR - sL + (nd - 1) * SLIDING_OVERLAP) / nd;
    const weight = (dw * dh * T * 1e-9) * density;
    doorInfo = { count: nd, width: dw, height: dh, weightKg: weight, hingeTotal: 0 };
    const allDoors = Array.from({ length: nd }, (_, i) => `door-${i}`);
    if (dw < 500) {
      warnings.push({
        level: 'warn',
        message: `Dyert rrëshqitëse janë vetëm ${cm(dw)} të gjera — përdorni më pak dyer.`,
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
      const x = sL + dw / 2 + i * (dw - SLIDING_OVERLAP);
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
          position: [
            rightEdge ? x + dw / 2 - (onEdge(cfg.handleType) ? 0 : 70) : x - dw / 2 + (onEdge(cfg.handleType) ? 0 : 70),
            cfg.handleType === 'gola' ? y : Math.min(y, 1050),
            z + T / 2,
          ],
          orientation: 'vertical',
          length: handleLength(cfg.handleType, dh, 0.3),
          side: rightEdge ? 1 : -1,
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
      message: `Thellësia e korpusit është vetëm ${cm(Dc)} — rriteni thellësinë.`,
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
  const narrowest = Math.min(...cws);
  if (narrowest < 250) {
    warnings.unshift({
      level: 'warn',
      message: `Seksionet janë vetëm ${cm(narrowest)} të gjera — përdorni më pak seksione.`,
      focus: { tab: 'size', field: 'sections', partIds: idsOf('divider', 'side') },
    });
  }

  return {
    parts,
    fixtures,
    warnings,
    interior: { width: modular ? before(cws, n) : Wi, height: Hi, depth: Dc, columnWidth: cws[0], columnWidths: cws, floorY },
    doors: doorInfo,
  };
}
