import { describe, expect, it } from 'vitest';
import { buildBom } from './bom';
import { defaultConfig, defaultPricing } from './catalog';
import { applySectionFit, distributeShelves, placeNewItem, planSections } from './interior';
import { buildLayout, hingesForDoor } from './layout';
import { computeQuote } from './pricing';
import { separateRoomItems } from './room';
import { describePart, selectionFocus } from './selection';
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

  it('points every warning at parts that exist and the panel that fixes it', () => {
    const cfg = box({
      width: 2000,
      height: 2600,
      doorType: 'hinged',
      doorCount: 2,
      columns: [
        { id: 'c', items: [{ id: 'a', type: 'shelf', y: 500 }, { id: 'b', type: 'drawer', y: 510, height: 200 }, { id: 'r', type: 'rod', y: 5000 }] },
      ],
    });
    const layout = buildLayout(cfg);
    const ids = new Set([...layout.parts.map((p) => p.id), ...layout.fixtures.map((f) => f.id)]);
    expect(layout.warnings.length).toBeGreaterThanOrEqual(4); // overlap, out of range, sagging shelf, wide + tall doors
    for (const w of layout.warnings) {
      expect(w.focus, w.message).toBeDefined();
      for (const id of w.focus!.partIds ?? []) expect(ids.has(id), `${w.message} → ${id}`).toBe(true);
    }
    const overlap = layout.warnings.find((w) => w.message.includes('mbivendosen'))!;
    expect(overlap.focus).toMatchObject({ tab: 'interior', column: 0, itemIds: ['a', 'b'] });
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

  it('turns the leftover width into its own narrower section', () => {
    const cfg = applySectionFit(box({ width: 3000, construction: 'modules', sectionFit: { enabled: true, width: 1200, doors: 'auto' } }));
    expect(cfg.columns.map((c) => c.width)).toEqual([1200, 1200, 600]);
    // auto doors: pairs on the 120 cm sections, a single door on the 60 cm remainder
    expect(cfg.columns.map((c) => c.doors?.count)).toEqual([2, 2, 1]);
    const layout = buildLayout(cfg);
    expect(layout.interior.columnWidths).toEqual([1200 - 36, 1200 - 36, 600 - 36]);
    // the remainder section is a full module with its own sides, top and bottom
    expect(layout.parts.filter((p) => p.category === 'side')).toHaveLength(6);
    expect(planSections(3000, { enabled: true, width: 1200, doors: 'auto', remainderSide: 'left' }).widths).toEqual([600, 1200, 1200]);
    // leftovers under 30 cm are spread instead
    expect(planSections(2500, { enabled: true, width: 1200, doors: 'auto' })).toMatchObject({ widths: [1250, 1250], spread: 100 });
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
  it('charges the door design per m² of styled fronts', () => {
    const cfg = box({ doorType: 'hinged', doorCount: 2, frontStyle: 'shaker' });
    const pricing = defaultPricing();
    const bom = buildBom(cfg, buildLayout(cfg), pricing);
    expect(bom.styledFrontArea).toBeGreaterThan(0.9);
    const line = computeQuote(bom, pricing).materialLines.find((l) => l.label.startsWith('Dizajni'))!;
    expect(line.amount).toBeCloseTo(bom.styledFrontArea * pricing.frontStylePerM2.shaker, 1); // rounded to cents
  });


  it('adds labor, installation and VAT', () => {
    const cfg = box();
    const pricing = { ...defaultPricing(), laborMode: 'fixed' as const, laborValue: 100, installationFee: 50, vatPercent: 20 };
    const q = computeQuote(buildBom(cfg, buildLayout(cfg), pricing), pricing);
    expect(q.laborSubtotal).toBe(100);
    expect(q.net).toBeCloseTo(q.materialSubtotal + q.hardwareSubtotal + 150, 2);
    expect(q.grandTotal).toBeCloseTo(q.net * 1.2, 2);
  });
});

describe('3D selection', () => {
  it('maps clicked parts back to the item, door or panel they belong to', () => {
    const cfg = box({
      doorType: 'hinged',
      doorLayout: 'perColumn',
      columns: [
        { id: 'c0', items: [{ id: 's1', type: 'shelf', y: 400 }, { id: 'd1', type: 'drawer', y: 0, height: 200 }], doors: { count: 1, hinge: 'left', split: null } },
        { id: 'c1', items: [{ id: 'r1', type: 'rod', y: 800 }], doors: { count: 2, hinge: 'left', split: null } },
      ],
    });
    const layout = buildLayout(cfg);
    // Any of a drawer's parts (front, box, spacers) selects the whole drawer.
    const drawer = describePart('dside-d1-1', cfg, layout)!;
    expect(drawer).toMatchObject({ kind: 'item', column: 0, item: { id: 'd1' } });
    expect(drawer.partIds).toHaveLength(8);
    expect(selectionFocus(drawer, cfg)).toEqual({ tab: 'interior', column: 0, itemIds: ['d1'] });
    expect(describePart('rod-r1', cfg, layout)).toMatchObject({ kind: 'item', column: 1 });
    // Door 1 is the first of section 2's pair.
    const door = describePart('door-1', cfg, layout)!;
    expect(door).toMatchObject({ kind: 'door', column: 1 });
    expect(selectionFocus(door, cfg)).toEqual({ tab: 'doors', column: 1 });
    expect(describePart('plinth', cfg, layout)).toBeNull(); // no plinth on this box
    expect(selectionFocus(describePart('side-1', cfg, layout)!, cfg)).toEqual({ tab: 'size', field: undefined });
    expect(describePart('shelf-gone', cfg, layout)).toBeNull();
  });
});

describe('doors, drawers and the corner', () => {
  it('hinges doors on their front edge and keeps inner drawers clear of open doors', () => {
    const cfg = box({
      doorType: 'hinged',
      doorCount: 2,
      columns: [{ id: 'c', items: [{ id: 'd', type: 'drawer', y: 0, height: 200 }] }],
    });
    const layout = buildLayout(cfg);
    const doors = layout.parts.filter((p) => p.category === 'door');
    for (const d of doors) {
      const m = d.motion!;
      expect(m.type).toBe('hinge');
      if (m.type !== 'hinge') continue;
      expect(m.pivot[2]).toBeCloseTo(d.position[2] + d.size[2] / 2); // front face
      expect(m.angle).toBe(105); // hinged on an outer side
    }
    // An open door stands T in front of the side panel; the drawer front starts beyond it.
    const front = layout.parts.find((p) => p.category === 'drawerFront')!;
    const openDoorInner = -500 + 2 + 18;
    expect(front.position[0] - front.size[0] / 2).toBeGreaterThan(openDoorInner);
    expect(layout.parts.filter((p) => p.category === 'spacer')).toHaveLength(2);
  });

  it('stops doors meeting at a divider at 90° so they do not collide', () => {
    const cfg = box({
      width: 1200,
      doorType: 'hinged',
      doorLayout: 'perColumn',
      columns: [
        { id: 'a', items: [], doors: { count: 1, hinge: 'right', split: null } },
        { id: 'b', items: [], doors: { count: 1, hinge: 'left', split: null } },
      ],
    });
    const angles = buildLayout(cfg).parts.filter((p) => p.category === 'door').map((p) => (p.motion as { angle: number }).angle);
    expect(angles).toEqual([90, 90]);
  });

  it('builds an L-shaped wardrobe with a blind corner filler and a rotated wing', () => {
    const cfg = box({
      width: 2000,
      height: 2000,
      depth: 600,
      doorType: 'hinged',
      doorCount: 3,
      columns: [{ id: 'c', items: [{ id: 'd', type: 'drawer', y: 0, height: 200 }] }],
      corner: { side: 'left', length: 1200, columns: [{ id: 'w', items: [{ id: 's', type: 'shelf', y: 500 }] }] },
    });
    const layout = buildLayout(cfg);
    expect(layout.groups.wing.rotation).toBe(90);
    const wingParts = layout.parts.filter((p) => p.group === 'wing');
    expect(wingParts.length).toBeGreaterThan(5);
    expect(wingParts.every((p) => p.id.startsWith('w:'))).toBe(true);
    expect(layout.parts.find((p) => p.id === 'w:shelf-s')).toBeDefined();

    const filler = layout.parts.find((p) => p.category === 'filler' && !p.group)!;
    expect(filler.size[0]).toBeCloseTo(600 + 60 - 2 - 1.5);
    // Main doors start after the filler; the one next to the corner hinges away from it.
    const mainDoors = layout.parts.filter((p) => p.category === 'door' && !p.group).sort((a, b) => a.position[0] - b.position[0]);
    expect(mainDoors[0].position[0] - mainDoors[0].size[0] / 2).toBeGreaterThan(-1000 + 600);
    expect((mainDoors[0].motion as { dir: number }).dir).toBe(1); // hinged on its right
    // A drawer stuck behind the filler is flagged.
    expect(layout.warnings.some((w) => w.message.includes('mbulesës së këndit'))).toBe(true);

    const sel = describePart('w:shelf-s', cfg, layout)!;
    expect(sel).toMatchObject({ kind: 'item', wing: true, item: { id: 's' } });
    expect(selectionFocus(sel, cfg)).toMatchObject({ tab: 'interior', wing: true });
  });
});

describe('room items', () => {
  it('builds a dresser with a shaped mirror, prices the glass and counts its slides', () => {
    const cfg = box({
      extras: [
        { id: 'k', kind: 'dresser', x: 1500, z: 0, rotation: 0, width: 1200, height: 850, depth: 450, rows: 3, perRow: 2, mirror: 'round', mirrorWidth: 800, mirrorHeight: 800 },
        { id: 'b', kind: 'bed', x: -2000, z: 800, rotation: 90, mattressWidth: 1600, mattressLength: 2000, headboard: 'panel' },
      ],
    });
    const layout = buildLayout(cfg);
    expect(layout.groups['x:k'].position).toEqual([1500, 0, 0]);
    expect(layout.parts.filter((p) => p.category === 'drawerFront' && p.group === 'x:k')).toHaveLength(6);
    expect(layout.fixtures.find((f) => f.kind === 'mirror')).toMatchObject({ shape: 'round', width: 800 });
    expect(layout.mirrorArea).toBeCloseTo((Math.PI * 0.8 * 0.8) / 4, 3);
    expect(layout.fixtures.filter((f) => f.kind === 'pillow' && f.group === 'x:b')).toHaveLength(2);

    const pricing = defaultPricing();
    const bom = buildBom(cfg, layout, pricing);
    expect(bom.hardware.find((h) => h.id === 'slide')!.qty).toBe(6);
    const quote = computeQuote(bom, pricing);
    expect(quote.materialLines.find((l) => l.label.startsWith('Pasqyrat'))!.amount).toBeCloseTo(bom.mirrorArea * pricing.frontStylePerM2.mirror, 2);

    const sel = describePart('x:b:rail-1', cfg, layout)!;
    expect(sel).toMatchObject({ kind: 'extra', extra: { id: 'b' } });
    expect(sel).toMatchObject({ piece: 'frame' }); // a rail picks the frame, not the whole bed
    expect(sel.partIds).not.toContain('x:b:mattress');
    expect(selectionFocus(sel, cfg)).toEqual({ tab: 'room', extraId: 'b' });
  });

  it('keeps room items out of the wardrobe and out of each other', () => {
    const night = { kind: 'dresser', rotation: 0, width: 500, height: 550, depth: 400, rows: 2, perRow: 1, mirror: 'none', mirrorWidth: 500, mirrorHeight: 700 } as const;
    const cfg = box({
      extras: [
        // Half inside the wardrobe (x 500..), then a nightstand dropped right on top of the dresser.
        { ...night, id: 'a', x: 600, z: -50, width: 1200, depth: 450 },
        { ...night, id: 'b', x: 1300, z: -50 },
      ],
    });
    const [a, b] = separateRoomItems(cfg);
    expect(a.x).toBe(500 + 150 + 600); // slid just clear of the wardrobe's end, keeping its gap
    expect(b.x - 250).toBeGreaterThanOrEqual(a.x + 600 + 20); // pushed past the dresser
    expect(a.z).toBe(-50);

    // Items already apart are left alone, as the same array.
    const apart = box({ extras: [{ ...night, id: 'c', x: 2000, z: -50 }] });
    expect(separateRoomItems(apart)).toBe(apart.extras);
  });
});

describe('per-door design', () => {
  it('prices one mirror door among flat ones separately', () => {
    const cfg = box({ doorType: 'hinged', doorCount: 3, frontStyle: 'flat', doorStyles: { 'door-1': 'mirror' } });
    const layout = buildLayout(cfg);
    const pricing = defaultPricing();
    const bom = buildBom(cfg, layout, pricing);
    const door = layout.parts.find((p) => p.id === 'door-1')!;
    expect(bom.styledFronts.mirror).toBeCloseTo((door.length * door.width) / 1e6, 3);
    const lines = computeQuote(bom, pricing).materialLines.filter((l) => l.label.startsWith('Dizajni'));
    expect(lines).toHaveLength(1); // flat costs nothing extra
    expect(lines[0].label).toMatch(/pasqyrë/);
  });
});

describe('configurable bed and dresser', () => {
  it('builds a tall, wide, slatted headboard with channel cushions and prices the upholstery', () => {
    const cfg = box({
      extras: [
        {
          id: 'b', kind: 'bed', x: 0, z: 0, rotation: 0, mattressWidth: 1600, mattressLength: 2000, headboard: 'panel',
          headboardHeight: 1400, headboardExtra: 500, headboardDesign: 'slats', cushions: 'channels', fabric: '#4b4d50', base: 'legs',
        },
      ],
    });
    const layout = buildLayout(cfg);
    const slats = layout.parts.filter((p) => p.id.startsWith('x:b:slat-'));
    expect(slats.length).toBeGreaterThan(20); // headboard ≈ 1.65 m + 2 × 0.5 m wide
    expect(slats[0].size[1]).toBe(1400);
    const cushions = layout.fixtures.filter((f) => f.kind === 'cushion');
    expect(cushions.length).toBeGreaterThan(5);
    expect(cushions[0]).toMatchObject({ color: '#4b4d50' });
    expect(layout.parts.filter((p) => p.id.startsWith('x:b:leg-'))).toHaveLength(4);
    expect(layout.upholsteryArea).toBeGreaterThan(1);

    const pricing = defaultPricing();
    const quote = computeQuote(buildBom(cfg, layout, pricing), pricing);
    expect(quote.materialLines.find((l) => l.label.startsWith('Tapiceria'))!.amount).toBeCloseTo(layout.upholsteryArea * pricing.upholsteryPerM2, 0);

    // Clicking a slat edits the headboard only.
    const sel = describePart('x:b:slat-3', cfg, layout)!;
    expect(sel).toMatchObject({ kind: 'extra', piece: 'head' });
    expect(sel.partIds.every((id) => /slat|hb-|cushion/.test(id))).toBe(true);
  });

  it('keeps older beds working from the headboard preset alone', () => {
    const cfg = box({ extras: [{ id: 'o', kind: 'bed', x: 0, z: 0, rotation: 0, mattressWidth: 900, mattressLength: 2000, headboard: 'tall' }] });
    const head = buildLayout(cfg).parts.find((p) => p.id === 'x:o:head')!;
    expect(head.size[1]).toBe(1250);
  });

  it('gives dresser fronts their own design and puts the dresser on legs', () => {
    const cfg = box({
      extras: [{ id: 'k', kind: 'dresser', x: 0, z: 0, rotation: 0, width: 1000, height: 800, depth: 450, rows: 3, perRow: 1, mirror: 'none', mirrorWidth: 0, mirrorHeight: 0, frontStyle: 'fluted', base: 'legs' }],
    });
    const layout = buildLayout(cfg);
    expect(layout.parts.filter((p) => p.category === 'drawerFront').every((p) => p.style === 'fluted')).toBe(true);
    expect(layout.parts.filter((p) => p.id.startsWith('x:k:leg-'))).toHaveLength(4);
    expect(layout.parts.find((p) => p.id === 'x:k:plinth')).toBeUndefined();
  });
});
