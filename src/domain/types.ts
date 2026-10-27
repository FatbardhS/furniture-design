/** All internal lengths are millimetres. Areas are m², lengths for edge banding / rods are metres. */

export type Unit = 'mm' | 'cm';

export type ItemType = 'shelf' | 'rod' | 'drawer';

export interface InteriorItem {
  id: string;
  type: ItemType;
  /** Distance from the interior floor of the column to the item's bottom (rod: its centre line). */
  y: number;
  /** Drawer front height (drawers only). */
  height?: number;
}

/** Doors for one column when hinged doors are laid out per section. */
export interface ColumnDoors {
  /** 0 = open section, 1 = single door, 2 = pair of doors. */
  count: 0 | 1 | 2;
  /** Hinge side of a single door. */
  hinge: 'left' | 'right';
  /** Split into upper and lower doors at this height from the interior floor (mm). null = full height. */
  split: number | null;
}

export interface Column {
  id: string;
  items: InteriorItem[];
  /** Only used when doorLayout is 'perColumn'; a default is derived when missing. */
  doors?: ColumnDoors;
  /** Outer width of this section in mm; sections without one share the width equally. */
  width?: number;
}

/** One carcass split by dividers, or a row of separate cabinet boxes (each with its own sides). */
export type Construction = 'dividers' | 'modules';

/** Derive the column count from the overall width: as many sections of `width` as fit. */
export interface SectionFit {
  enabled: boolean;
  /** Standard section width in mm. Leftover width is spread evenly over the sections. */
  width: number;
  /** Doors per section; 'auto' = 1 door up to 600 mm, 2 doors above. */
  doors: 'auto' | 0 | 1 | 2;
  /** Where the narrower leftover section goes when the width isn't a multiple of `width`. */
  remainderSide?: 'left' | 'right';
}

export type DoorType = 'none' | 'hinged' | 'sliding';
/** Hinged doors spread evenly across the full width, or configured per column. */
export type DoorLayout = 'even' | 'perColumn';
export type HandleType = 'bar' | 'square' | 'long' | 'knob' | 'edge' | 'gola' | 'none';
export type HandleFinish = 'chrome' | 'inox' | 'black' | 'gunmetal' | 'brass' | 'gold' | 'white';
/** Door / drawer front design. */
export type FrontStyle = 'flat' | 'shaker' | 'fluted' | 'glass' | 'mirror';
export type HingeType = 'standard' | 'softClose';
export type SlideType = 'ballBearing' | 'softCloseUndermount';

export interface Finish {
  materialId: string;
  /** Hex colour applied as a tint over the material texture. */
  color: string;
  /** 0 = dead matte, 1 = high gloss lacquer. */
  gloss: number;
}

/** A second wardrobe run along the side wall, making an L. */
export interface CornerWing {
  side: 'none' | 'left' | 'right';
  /** Outer length of the wing along the side wall (mm), measured from the main wardrobe's front. */
  length: number;
  columns: Column[];
}

export type MirrorShape = 'none' | 'rect' | 'round' | 'oval' | 'arch' | 'pill';
export type Headboard = 'none' | 'low' | 'panel' | 'tall';

interface RoomItemBase {
  id: string;
  /** Centre of the item's footprint on the floor (mm, same axes as the wardrobe). */
  x: number;
  z: number;
  /** Turn about the vertical axis; 0 = back against the wall behind the wardrobe. */
  rotation: 0 | 90 | 180 | 270;
}

/** Chest of drawers / nightstand, optionally with a mirror on the wall above it. */
export interface DresserItem extends RoomItemBase {
  kind: 'dresser';
  width: number;
  height: number;
  depth: number;
  /** Drawer rows and drawers per row. */
  rows: number;
  perRow: 1 | 2;
  mirror: MirrorShape;
  mirrorWidth: number;
  mirrorHeight: number;
  /** Drawer front design (defaults to flat). */
  frontStyle?: PieceStyle;
  /** Stands on a recessed plinth or on four legs. */
  base?: 'plinth' | 'legs';
}

/** Designs a room item's fronts / headboard can take (glass and mirror stay wardrobe-only). */
export type PieceStyle = 'flat' | 'shaker' | 'fluted';
export type HeadboardDesign = 'flat' | 'panels' | 'fluted' | 'slats';
/** Upholstered cushions on the headboard. */
export type CushionStyle = 'none' | 'panel' | 'channels' | 'tufted';

export interface MirrorItem extends RoomItemBase {
  kind: 'mirror';
  shape: Exclude<MirrorShape, 'none'>;
  width: number;
  height: number;
  /** Height of the mirror's bottom edge above the floor. */
  bottom: number;
}

export interface BedItem extends RoomItemBase {
  kind: 'bed';
  mattressWidth: number;
  mattressLength: number;
  /** Older saves only have this preset; the fields below override it. */
  headboard: Headboard;
  /** Headboard height from the floor (mm). */
  headboardHeight?: number;
  /** How far the headboard reaches past the frame on each side (mm), e.g. to back the nightstands. */
  headboardExtra?: number;
  headboardDesign?: HeadboardDesign;
  cushions?: CushionStyle;
  /** Upholstery fabric colour (hex). */
  fabric?: string;
  /** Height of the side rails / foot board (mm). */
  frameHeight?: number;
  base?: 'box' | 'legs';
  /** Which finish the frame and headboard use: the wardrobe fronts or its carcass. */
  finish?: 'front' | 'carcass';
}

export type RoomItem = DresserItem | MirrorItem | BedItem;

export interface CabinetConfig {
  width: number;
  height: number;
  depth: number;
  /** Board (carcass / front) thickness, typically 18 mm. */
  thickness: number;
  /** HDF back panel thickness, typically 3 mm. */
  backThickness: number;
  /** Toe-kick height. 0 = no plinth. */
  plinthHeight: number;
  construction: Construction;
  sectionFit: SectionFit;
  columns: Column[];
  doorType: DoorType;
  doorLayout: DoorLayout;
  doorCount: number;
  handleType: HandleType;
  handleFinish: HandleFinish;
  frontStyle: FrontStyle;
  /** Per-door design overriding `frontStyle`, keyed by door part id (e.g. one mirror door). */
  doorStyles?: Record<string, FrontStyle>;
  hingeType: HingeType;
  slideType: SlideType;
  carcassFinish: Finish;
  frontFinish: Finish;
  corner: CornerWing;
  /** Other bedroom furniture placed around the wardrobe. */
  extras: RoomItem[];
}

export type LaborMode = 'percent' | 'perM2' | 'fixed';

export interface PricingConfig {
  currency: string;
  /** Board price per m², keyed by material id. */
  boardPrices: Record<string, number>;
  backPanelPerM2: number;
  edgeBandingPerM: number;
  /** Cutting waste added to board areas, in percent. */
  wastePercent: number;
  hinge: { standard: number; softClose: number };
  slidePair: { ballBearing: number; softCloseUndermount: number };
  handle: Record<HandleType, number>;
  /** Extra cost per m² of door front for each design (milling, glass, mirror). */
  frontStylePerM2: Record<FrontStyle, number>;
  hangingRodPerM: number;
  /** Upholstered headboard cushions, per m² of cushion front (foam, fabric, work). */
  upholsteryPerM2: number;
  rodMount: number;
  shelfSupport: number;
  slidingTrackPerM: number;
  slidingRollerSet: number;
  laborMode: LaborMode;
  laborValue: number;
  installationFee: number;
  vatPercent: number;
}

export type PartCategory =
  | 'side'
  | 'topBottom'
  | 'divider'
  | 'shelf'
  | 'plinth'
  | 'back'
  | 'door'
  | 'drawerFront'
  | 'drawerSide'
  | 'drawerEnd'
  | 'drawerBottom'
  /** Spacer strips that let inner drawers clear open hinged doors. */
  | 'spacer'
  /** Fixed front panel covering the blind part of a corner. */
  | 'filler'
  /** Boards of free-standing furniture (dresser carcass, bed frame). */
  | 'panel';

export type PartMaterial = 'carcass' | 'front' | 'back';
export type Axis = 'x' | 'y' | 'z';
export type Vec3 = [number, number, number];

export type Motion =
  | { key: string; type: 'hinge'; pivot: Vec3; dir: 1 | -1; /** Opening angle in degrees. */ angle: number }
  | { key: string; type: 'drawer'; travel: number }
  | { key: string; type: 'slide'; travel: number };

/** One physical board piece. Carries both cut-list data and its placement in the 3D scene. */
export interface Part {
  id: string;
  name: string;
  category: PartCategory;
  material: PartMaterial;
  /** Cut dimensions: length runs along the grain. */
  length: number;
  width: number;
  thickness: number;
  /** Number of banded long edges (0–2) and short edges (0–2). */
  bandLong: number;
  bandShort: number;
  /** Scene placement: centre and box size in mm, world axes (y up, +z = front). */
  position: Vec3;
  size: Vec3;
  grain: Axis;
  motion?: Motion;
  /** Section the part belongs to, when it belongs to exactly one (per-section doors). */
  column?: number;
  /** Placement group (corner wing or a room item); position is relative to it. */
  group?: string;
  /** Surface design of this board (room item fronts, headboards); overrides the wardrobe's. */
  style?: FrontStyle;
}

export type Fixture = (
  | { kind: 'rod'; id: string; position: Vec3; length: number; motionKey?: string }
  | { kind: 'mirror'; id: string; position: Vec3; shape: Exclude<MirrorShape, 'none'>; width: number; height: number; motionKey?: string }
  | { kind: 'mattress' | 'pillow'; id: string; position: Vec3; size: Vec3; motionKey?: string }
  | { kind: 'cushion'; id: string; position: Vec3; size: Vec3; color: string; motionKey?: string }
  | {
      kind: 'handle';
      id: string;
      position: Vec3;
      orientation: 'vertical' | 'horizontal';
      length: number;
      /** Which way the front's edge lies from the handle (+x / +y = 1), for edge-mounted profiles. */
      side?: 1 | -1;
      motionKey?: string;
    }
) & { group?: string };

/** Where a placement group sits: offset (mm) and turn about the vertical axis (degrees). */
export interface Placement {
  position: Vec3;
  rotation: number;
}

/** Where a warning can be fixed: which panel, section, items or field, and which parts to light up in 3D. */
export interface WarningFocus {
  tab: 'size' | 'interior' | 'doors' | 'room';
  column?: number;
  /** The column / items are in the corner wing rather than the main run. */
  wing?: boolean;
  /** Room item the warning or selection is about. */
  extraId?: string;
  itemIds?: string[];
  field?: 'depth' | 'height' | 'plinth' | 'sections' | 'doorCount' | 'corner';
  /** Part / fixture ids to highlight in the 3D view. */
  partIds?: string[];
}

export interface Warning {
  level: 'info' | 'warn' | 'error';
  message: string;
  focus?: WarningFocus;
}

export interface Layout {
  parts: Part[];
  fixtures: Fixture[];
  warnings: Warning[];
  /** Placement of every group referenced by parts / fixtures. */
  groups: Record<string, Placement>;
  interior: {
    width: number;
    height: number;
    depth: number;
    /** Interior width of the first section (all sections when they are equal). */
    columnWidth: number;
    /** Interior width of every section. */
    columnWidths: number[];
    floorY: number;
  };
  doors: {
    count: number;
    /** Size and weight of the largest door. */
    width: number;
    height: number;
    weightKg: number;
    /** Total hinges over all doors (each door's count depends on its own height and weight). */
    hingeTotal: number;
  };
  /** Interior of the corner wing, when there is one. */
  wing?: { interior: Layout['interior'] };
  /** Mirror glass area of the room items, m². */
  mirrorArea: number;
  /** Upholstered headboard cushion area, m². */
  upholsteryArea: number;
}

/** The warning focus the user is currently looking at; `nonce` changes on every click. */
export type ActiveFocus = WarningFocus & { nonce: number; tone: 'warning' | 'select' };
