import { defaultRoom } from './shell';
import type { CabinetConfig, Column, PricingConfig } from './types';

export interface MaterialDef {
  id: string;
  name: string;
  /** Wood materials get a procedural grain texture; solids are plain lacquer / melamine. */
  kind: 'wood' | 'solid';
  defaultColor: string;
  defaultGloss: number;
  /** Default board price per m² (EUR). */
  pricePerM2: number;
  /** Density in kg/m³, used for door weight → hinge count. */
  density: number;
}

/**
 * Board prices are Kosovo defaults (EUR/m², 18 mm), based on regional Egger / Kronospan list
 * prices: white melamine ~11, standard wood decors 15–17, premium plain colours ~19,
 * high-gloss lacquered / acrylic MDF 40+. Every price is editable in the Prices tab.
 */
export const MATERIALS: MaterialDef[] = [
  { id: 'oak', name: 'Lis natyral', kind: 'wood', defaultColor: '#c89b6a', defaultGloss: 0.2, pricePerM2: 16, density: 720 },
  { id: 'sonoma', name: 'Lis Sonoma', kind: 'wood', defaultColor: '#cfae7f', defaultGloss: 0.15, pricePerM2: 15, density: 720 },
  { id: 'walnut', name: 'Arrë amerikane', kind: 'wood', defaultColor: '#6b4a32', defaultGloss: 0.25, pricePerM2: 19, density: 720 },
  { id: 'wenge', name: 'Wenge', kind: 'wood', defaultColor: '#4a3426', defaultGloss: 0.2, pricePerM2: 17, density: 720 },
  { id: 'cherry', name: 'Qershi', kind: 'wood', defaultColor: '#a4573a', defaultGloss: 0.25, pricePerM2: 17, density: 720 },
  { id: 'beech', name: 'Ah', kind: 'wood', defaultColor: '#dcb48a', defaultGloss: 0.2, pricePerM2: 15, density: 720 },
  { id: 'pine', name: 'Pishë nordike', kind: 'wood', defaultColor: '#e2bf86', defaultGloss: 0.15, pricePerM2: 15, density: 680 },
  { id: 'ash', name: 'Frashër gri', kind: 'wood', defaultColor: '#a49c92', defaultGloss: 0.15, pricePerM2: 16, density: 720 },
  { id: 'white-matte', name: 'Melaminë e bardhë mat', kind: 'solid', defaultColor: '#ecebe7', defaultGloss: 0.1, pricePerM2: 11, density: 700 },
  { id: 'white-gloss', name: 'MDF e bardhë me shkëlqim', kind: 'solid', defaultColor: '#f4f4f2', defaultGloss: 0.95, pricePerM2: 42, density: 750 },
  { id: 'black-gloss', name: 'MDF e zezë me shkëlqim', kind: 'solid', defaultColor: '#151515', defaultGloss: 0.95, pricePerM2: 45, density: 750 },
  { id: 'black-matte', name: 'E zezë mat', kind: 'solid', defaultColor: '#222222', defaultGloss: 0.08, pricePerM2: 17, density: 750 },
  { id: 'light-gray', name: 'Gri e çelët', kind: 'solid', defaultColor: '#c9c9c6', defaultGloss: 0.15, pricePerM2: 14, density: 700 },
  { id: 'gray', name: 'Gri antracit', kind: 'solid', defaultColor: '#6d6f72', defaultGloss: 0.3, pricePerM2: 16, density: 750 },
  { id: 'cashmere', name: 'Kashmir', kind: 'solid', defaultColor: '#cdbfae', defaultGloss: 0.2, pricePerM2: 17, density: 750 },
  { id: 'beige', name: 'Bezhë', kind: 'solid', defaultColor: '#e3d5bd', defaultGloss: 0.15, pricePerM2: 15, density: 700 },
  { id: 'sage', name: 'Gjelbër ulliri', kind: 'solid', defaultColor: '#8a9a7b', defaultGloss: 0.15, pricePerM2: 19, density: 750 },
  { id: 'navy', name: 'Blu e errët', kind: 'solid', defaultColor: '#2c3e5a', defaultGloss: 0.2, pricePerM2: 19, density: 750 },
];

export const materialById = (id: string): MaterialDef => MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];

/** Quick colour swatches offered under the colour picker. */
export const COLOR_PALETTE = [
  { name: 'E bardhë', hex: '#f5f5f2' },
  { name: 'Krem', hex: '#efe6d2' },
  { name: 'Bezhë', hex: '#d9c7a8' },
  { name: 'Kafe e çelët', hex: '#b48a5e' },
  { name: 'Kafe', hex: '#7a5232' },
  { name: 'Gri e çelët', hex: '#c4c4c0' },
  { name: 'Gri', hex: '#85878a' },
  { name: 'Antracit', hex: '#45484c' },
  { name: 'E zezë', hex: '#1d1d1d' },
  { name: 'Ulliri', hex: '#7d8c6a' },
  { name: 'Blu', hex: '#33476a' },
  { name: 'Bordo', hex: '#6e2a2e' },
];

export const HANDLE_LABELS = {
  bar: 'Dorezë shufër',
  square: 'Shufër katrore',
  long: 'Shufër e gjatë',
  knob: 'Dorezë e rrumbullakët',
  edge: 'Profil në buzë',
  gola: 'Profil i futur (gola)',
  none: 'Push-to-open (pa dorezë)',
} as const;
export const HANDLE_FINISH_LABELS = {
  chrome: 'Krom',
  inox: 'Inoks',
  black: 'E zezë',
  gunmetal: 'Antracit',
  brass: 'Bronz',
  gold: 'Ari',
  white: 'E bardhë',
} as const;
export const FRONT_STYLE_LABELS = {
  flat: 'E lëmuar',
  shaker: 'Me kornizë',
  fluted: 'Me kanale',
  glass: 'Me xham',
  mirror: 'Me pasqyrë',
} as const;
/** Display names for BOM quantity units. */
export const UNIT_LABELS = { pcs: 'copë', pairs: 'palë', m: 'm', sets: 'set' } as const;
export const HINGE_LABELS = { standard: 'Pagllama standarde', softClose: 'Pagllama me mbyllje të butë' } as const;
export const SLIDE_LABELS = { ballBearing: 'Shina me sfera', softCloseUndermount: 'Shina nën sirtar me mbyllje të butë' } as const;

/** Standard drawer slide lengths in mm. */
export const SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550, 600, 650];

/**
 * Common section widths (mm) used by carpenters in Kosovo and the wider region: hinged door
 * panels stay within ~450–600 mm, so 600 suits one door and 800–1200 suit a pair.
 */
export const STANDARD_SECTION_WIDTHS = [600, 800, 900, 1000, 1200];
/** Widest hinged door before hinges strain; above this a section gets two doors. */
export const MAX_SINGLE_DOOR = 600;

/** Standard board sheet size (mm), used to estimate the number of sheets to order. */
export const SHEET = { length: 2800, width: 2070 };

let seq = 0;
export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function defaultConfig(): CabinetConfig {
  return {
    width: 1800,
    height: 2200,
    depth: 600,
    thickness: 18,
    backThickness: 3,
    plinthHeight: 80,
    construction: 'dividers',
    sectionFit: { enabled: false, width: 1000, doors: 'auto', remainderSide: 'right' },
    columns: [
      {
        id: uid('col'),
        items: [
          { id: uid('it'), type: 'shelf', y: 1700 },
          { id: uid('it'), type: 'rod', y: 1640 },
        ],
      },
      {
        id: uid('col'),
        items: [
          { id: uid('it'), type: 'drawer', y: 0, height: 220 },
          { id: uid('it'), type: 'drawer', y: 220, height: 220 },
          { id: uid('it'), type: 'drawer', y: 440, height: 220 },
          { id: uid('it'), type: 'shelf', y: 700 },
          { id: uid('it'), type: 'shelf', y: 1040 },
          { id: uid('it'), type: 'shelf', y: 1380 },
          { id: uid('it'), type: 'shelf', y: 1700 },
        ],
      },
      {
        id: uid('col'),
        items: [
          { id: uid('it'), type: 'shelf', y: 1700 },
          { id: uid('it'), type: 'rod', y: 1640 },
          { id: uid('it'), type: 'shelf', y: 900 },
          { id: uid('it'), type: 'rod', y: 840 },
        ],
      },
    ],
    doorType: 'hinged',
    doorLayout: 'even',
    doorCount: 3,
    handleType: 'bar',
    handleFinish: 'chrome',
    frontStyle: 'flat',
    hingeType: 'softClose',
    slideType: 'softCloseUndermount',
    carcassFinish: { materialId: 'white-matte', color: '#ecebe7', gloss: 0.1 },
    frontFinish: { materialId: 'oak', color: '#c89b6a', gloss: 0.2 },
    corner: { side: 'none', length: 1200, columns: defaultWingColumns() },
    extras: [],
    room: defaultRoom({ width: 1800 }, uid),
  };
}

/** Starting interior of a corner wing: hanging space and a shelved section. */
export function defaultWingColumns(): Column[] {
  return [
    {
      id: uid('col'),
      items: [
        { id: uid('it'), type: 'shelf', y: 1700 },
        { id: uid('it'), type: 'rod', y: 1640 },
      ],
    },
    {
      id: uid('col'),
      items: [
        { id: uid('it'), type: 'shelf', y: 400 },
        { id: uid('it'), type: 'shelf', y: 800 },
        { id: uid('it'), type: 'shelf', y: 1200 },
        { id: uid('it'), type: 'shelf', y: 1700 },
      ],
    },
  ];
}

/**
 * Kosovo default prices (EUR). Boards come from MATERIALS; hardware reflects local resellers of
 * generic and Blum-type fittings; labour is a share of materials + hardware, which lands a
 * standard 2-door wardrobe close to what Kosovo workshops quote. TVSH is the standard 18%.
 */
export function defaultPricing(): PricingConfig {
  return {
    currency: '€',
    boardPrices: Object.fromEntries(MATERIALS.map((m) => [m.id, m.pricePerM2])),
    backPanelPerM2: 3.5,
    edgeBandingPerM: 0.55,
    wastePercent: 12,
    hinge: { standard: 1.2, softClose: 3.5 },
    slidePair: { ballBearing: 4.5, softCloseUndermount: 14 },
    handle: { bar: 3, square: 4, long: 9, knob: 1.5, edge: 5, gola: 8, none: 4.5 },
    frontStylePerM2: { flat: 0, shaker: 15, fluted: 20, glass: 55, mirror: 40 },
    hangingRodPerM: 4,
    // Foam, fabric and upholstering for headboard cushions.
    upholsteryPerM2: 45,
    rodMount: 0.8,
    shelfSupport: 0.05,
    slidingTrackPerM: 15,
    slidingRollerSet: 10,
    laborMode: 'percent',
    laborValue: 70,
    installationFee: 40,
    vatPercent: 18,
  };
}
