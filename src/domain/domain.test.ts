import { describe, expect, it } from 'vitest';
import { buildBom } from './bom';
import { defaultConfig, defaultPricing } from './catalog';
import { applySectionFit, distributeShelves, placeNewItem } from './interior';
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
    expect(layout.doors.hingeTotal).toBe(6);
    const bom = buildBom(cfg, layout, defaultPricing());
    expect(bom.hardware.find((h) => h.id === 'hinge')!.qty).toBe(6);
    expect(bom.hardware.find((h) => h.id === 'handle')!.qty).toBe(2);
    // doors reduce the carcass depth so overall depth stays 500
    expect(layout.interior.depth).toBe(500 - 3 - 20);
  });

  it('lays out doors per section with pairs and upper/lower splits', () => {
    const cfg = box({
      width: 1500,
      height: 2000,
      doorType: 'hinged',
      doorLayout: 'perColumn',
      columns: [
        { id: 'a', items: [], doors: { count: 1, hinge: 'right', split: null } },
        { id: 'b', items: [], doors: { count: 2, hinge: 'left', split: 1500 } },
        { id: 'c', items: [], doors: { count: 0, hinge: 'left', split: null } },
      ],
    });
    const layout = buildLayout(cfg);
    const doors = layout.parts.filter((p) => p.category === 'door');
    // 1 single + 2 pairs (lower and upper) + open section
    expect(doors).toHaveLength(5);
    expect(layout.doors.count).toBe(5);
    const single = doors[0];
    expect(single.motion).toMatchObject({ type: 'hinge', dir: 1 });
    // Split doors meet at the split line with a door gap between them.
    const lower = doors[1];
    const upper = doors[3];
    const floorY = cfg.thickness;
    expect(lower.position[1] + lower.size[1] / 2).toBeCloseTo(floorY + 1500 - 1.5, 5);
    expect(upper.position[1] - upper.size[1] / 2).toBeCloseTo(floorY + 1500 + 1.5, 5);
    const bom = buildBom(cfg, layout, defaultPricing());
    expect(bom.hardware.find((h) => h.id === 'hinge')!.qty).toBe(layout.doors.hingeTotal);
  });

  it('builds separate modules with their own sides, tops and backs', () => {
    const cols = [0, 1, 2].map((i) => ({ id: `c${i}`, items: [] }));
    const modules = buildLayout(box({ width: 3000, construction: 'modules', columns: cols }));
    const count = (cat: string) => modules.parts.filter((p) => p.category === cat).length;
    expect(count('side')).toBe(6);
    expect(count('topBottom')).toBe(6);
    expect(count('divider')).toBe(0);
    // 1000 mm modules → 964 mm inside each
    expect(modules.interior.columnWidth).toBe(1000 - 36);
    // Doors per section meet exactly at the module joints.
    const perCol = buildLayout(box({ width: 3000, construction: 'modules', columns: cols, doorType: 'hinged', doorLayout: 'perColumn' }));
    const doors = perCol.parts.filter((p) => p.category === 'door');
    expect(doors[1].position[0] + doors[1].size[0] / 2).toBeCloseTo(-500 - 1.5, 5);
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
    expect(msgs).toMatch(/mbivendosen/);
    expect(msgs).toMatch(/jashtë hapësirës/);
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

  it('fits as many standard sections as possible with the right doors', () => {
    const fit3 = applySectionFit(box({ width: 3000, sectionFit: { enabled: true, width: 1000, doors: 'auto' } }));
    expect(fit3.columns).toHaveLength(3);
    expect(fit3.columns.every((c) => c.doors?.count === 2)).toBe(true);
    expect(fit3.doorLayout).toBe('perColumn');
    // 3000 / 600 → 5 sections of 600, one door each in auto mode
    const fit5 = applySectionFit(box({ width: 3000, sectionFit: { enabled: true, width: 600, doors: 'auto' } }));
    expect(fit5.columns).toHaveLength(5);
    expect(fit5.columns.every((c) => c.doors?.count === 1)).toBe(true);
    // 3100 / 600 still 5 sections — leftover is spread, never a sixth narrow one
    expect(applySectionFit(box({ width: 3100, sectionFit: { enabled: true, width: 600, doors: 2 } })).columns).toHaveLength(5);
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
