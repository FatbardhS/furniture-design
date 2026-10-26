import type { CabinetConfig, PricingConfig } from './types';

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

export const MATERIALS: MaterialDef[] = [
  { id: 'oak', name: 'Natural Oak', kind: 'wood', defaultColor: '#c89b6a', defaultGloss: 0.2, pricePerM2: 32, density: 720 },
  { id: 'walnut', name: 'American Walnut', kind: 'wood', defaultColor: '#6b4a32', defaultGloss: 0.25, pricePerM2: 44, density: 720 },
  { id: 'pine', name: 'Nordic Pine', kind: 'wood', defaultColor: '#e2bf86', defaultGloss: 0.15, pricePerM2: 22, density: 680 },
  { id: 'ash', name: 'Grey Ash', kind: 'wood', defaultColor: '#a49c92', defaultGloss: 0.15, pricePerM2: 30, density: 720 },
  { id: 'white-gloss', name: 'High-Gloss White MDF', kind: 'solid', defaultColor: '#f4f4f2', defaultGloss: 0.95, pricePerM2: 38, density: 750 },
  { id: 'white-matte', name: 'Matte White Melamine', kind: 'solid', defaultColor: '#ecebe7', defaultGloss: 0.1, pricePerM2: 16, density: 700 },
  { id: 'black-matte', name: 'Matte Black', kind: 'solid', defaultColor: '#222222', defaultGloss: 0.08, pricePerM2: 28, density: 750 },
  { id: 'gray', name: 'Anthracite Gray', kind: 'solid', defaultColor: '#6d6f72', defaultGloss: 0.3, pricePerM2: 26, density: 750 },
  { id: 'cashmere', name: 'Cashmere', kind: 'solid', defaultColor: '#cdbfae', defaultGloss: 0.2, pricePerM2: 27, density: 750 },
];

export const materialById = (id: string): MaterialDef => MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];

export const HANDLE_LABELS = { bar: 'Bar handle', knob: 'Round knob', none: 'Push-to-open (none)' } as const;
export const HINGE_LABELS = { standard: 'Standard hinge', softClose: 'Soft-close hinge' } as const;
export const SLIDE_LABELS = { ballBearing: 'Ball-bearing slides', softCloseUndermount: 'Soft-close undermount' } as const;

/** Standard drawer slide lengths in mm. */
export const SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550, 600, 650];

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
    hingeType: 'softClose',
    slideType: 'softCloseUndermount',
    carcassFinish: { materialId: 'white-matte', color: '#ecebe7', gloss: 0.1 },
    frontFinish: { materialId: 'oak', color: '#c89b6a', gloss: 0.2 },
  };
}

export function defaultPricing(): PricingConfig {
  return {
    currency: '€',
    boardPrices: Object.fromEntries(MATERIALS.map((m) => [m.id, m.pricePerM2])),
    backPanelPerM2: 6,
    edgeBandingPerM: 0.9,
    wastePercent: 12,
    hinge: { standard: 1.5, softClose: 3.8 },
    slidePair: { ballBearing: 7, softCloseUndermount: 22 },
    handle: { bar: 4.5, knob: 2.5, none: 6 },
    hangingRodPerM: 5,
    rodMount: 1.2,
    shelfSupport: 0.1,
    slidingTrackPerM: 18,
    slidingRollerSet: 14,
    laborMode: 'percent',
    laborValue: 35,
    installationFee: 60,
    vatPercent: 0,
  };
}
