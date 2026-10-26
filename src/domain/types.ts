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
}

export type DoorType = 'none' | 'hinged' | 'sliding';
/** Hinged doors spread evenly across the full width, or configured per column. */
export type DoorLayout = 'even' | 'perColumn';
export type HandleType = 'bar' | 'knob' | 'none';
export type HandleFinish = 'chrome' | 'black' | 'brass';
export type HingeType = 'standard' | 'softClose';
export type SlideType = 'ballBearing' | 'softCloseUndermount';

export interface Finish {
  materialId: string;
  /** Hex colour applied as a tint over the material texture. */
  color: string;
  /** 0 = dead matte, 1 = high gloss lacquer. */
  gloss: number;
}

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
  hingeType: HingeType;
  slideType: SlideType;
  carcassFinish: Finish;
  frontFinish: Finish;
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
  handle: { bar: number; knob: number; none: number };
  hangingRodPerM: number;
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
  | 'drawerBottom';

export type PartMaterial = 'carcass' | 'front' | 'back';
export type Axis = 'x' | 'y' | 'z';
export type Vec3 = [number, number, number];

export type Motion =
  | { key: string; type: 'hinge'; pivot: Vec3; dir: 1 | -1 }
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
}

export type Fixture =
  | { kind: 'rod'; id: string; position: Vec3; length: number; motionKey?: string }
  | {
      kind: 'handle';
      id: string;
      position: Vec3;
      orientation: 'vertical' | 'horizontal';
      length: number;
      motionKey?: string;
    };

export interface Warning {
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface Layout {
  parts: Part[];
  fixtures: Fixture[];
  warnings: Warning[];
  interior: {
    width: number;
    height: number;
    depth: number;
    columnWidth: number;
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
}
