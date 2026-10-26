import { describe, expect, it } from 'vitest';
import { buildBom } from './bom';
import { defaultConfig, defaultPricing } from './catalog';
import { distributeShelves, placeNewItem } from './interior';
import { buildLayout, hingesForDoor } from './layout';
import { computeQuote } from './pricing';
import type { CabinetConfig } from './types';

const box = (over: Partial<CabinetConfig> = {}): CabinetConfig => ({
  ...defaultConfig(),
  width: 1000,
  height: 1000,
  depth: 500,
  plinthHeight: 0,
  columns: [{ id: 'c', items: [] }],
  doorType: 'none',
  ...over,
});

describe('layout + BOM', () => {
  it('computes carcass, back and banding for a plain box', () => {
    const cfg = box();
    const bom = buildBom(cfg, buildLayout(cfg), defaultPricing());
    const carcass = bom.boards.find((b) => b.material === 'carcass')!;
    const back = bom.boards.find((b) => b.material === 'back')!;
    // sides 2 × 1000×497, top/bottom 2 × 964×497
    expect(carcass.netArea).toBeCloseTo(1.952, 3);
    expect(back.netArea).toBeCloseTo(0.992, 3);
    // front edges: 2×(1000+30) + 2×(964+30) mm
    expect(bom.edgeBandingM).toBeCloseTo(4.05, 2);
    expect(bom.hardware).toHaveLength(0);
  });

  it('counts hinges and handles for hinged doors', () => {
    const cfg = box({ doorType: 'hinged', doorCount: 2, hingeType: 'standard', handleType: 'knob' });
    const layout = buildLayout(cfg);
    expect(layout.doors.hingesEach).toBe(3);
    const bom = buildBom(cfg, layout, defaultPricing());
    expect(bom.hardware.find((h) => h.id === 'hinge')!.qty).toBe(6);
    expect(bom.hardware.find((h) => h.id === 'handle')!.qty).toBe(2);
    // doors reduce the carcass depth so overall depth stays 500
    expect(layout.interior.depth).toBe(500 - 3 - 20);
  });

  it('builds a drawer box with slides and fits slide length to depth', () => {
    const cfg = box({ columns: [{ id: 'c', items: [{ id: 'd', type: 'drawer', y: 0, height: 200 }] }] });
    const layout = buildLayout(cfg);
    const side = layout.parts.find((p) => p.category === 'drawerSide')!;
    expect(side.length).toBe(450); // 497 − 18 − 10 = 469 → 450 slide
    const bom = buildBom(cfg, layout, defaultPricing());
    expect(bom.hardware.find((h) => h.id === 'slide')!.qty).toBe(1);
    expect(layout.parts.filter((p) => p.motion?.key === 'drawer-d')).toHaveLength(6);
  });

  it('flags overlapping and out-of-range items', () => {
    const cfg = box({
      columns: [{ id: 'c', items: [{ id: 'a', type: 'shelf', y: 500 }, { id: 'b', type: 'shelf', y: 510 }, { id: 'x', type: 'shelf', y: 5000 }] }],
    });
    const msgs = buildLayout(cfg).warnings.map((w) => w.message).join('\n');
    expect(msgs).toMatch(/overlap/);
    expect(msgs).toMatch(/outside the interior/);
  });

  it('hinge rule scales with height and weight', () => {
    expect(hingesForDoor(700, 3)).toBe(2);
    expect(hingesForDoor(2100, 10)).toBe(5);
    expect(hingesForDoor(700, 14)).toBe(3);
  });
});

describe('interior helpers', () => {
  it('places drawers bottom-up and shelves into the largest gap', () => {
    const col = { id: 'c', items: [] };
    expect(placeNewItem(col, 'drawer', 1000, 18)!.y).toBe(0);
    expect(placeNewItem(col, 'shelf', 1000, 18)!.y).toBe(490);
  });

  it('distributes shelves evenly above drawers', () => {
    const col = distributeShelves(
      { id: 'c', items: [{ id: 'd', type: 'drawer', y: 0, height: 200 }, { id: 's1', type: 'shelf', y: 900 }, { id: 's2', type: 'shelf', y: 950 }] },
      1018,
      18,
    );
    const ys = col.items.filter((i) => i.type === 'shelf').map((i) => i.y).sort((a, b) => a - b);
    expect(ys).toEqual([460, 740]);
  });
});

describe('pricing', () => {
  it('adds labor, installation and VAT', () => {
    const cfg = box();
    const pricing = { ...defaultPricing(), laborMode: 'fixed' as const, laborValue: 100, installationFee: 50, vatPercent: 20 };
    const q = computeQuote(buildBom(cfg, buildLayout(cfg), pricing), pricing);
    expect(q.laborSubtotal).toBe(100);
    expect(q.net).toBeCloseTo(q.materialSubtotal + q.hardwareSubtotal + 150, 2);
    expect(q.grandTotal).toBeCloseTo(q.net * 1.2, 2);
  });
});
