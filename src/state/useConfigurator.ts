import { useEffect, useMemo, useState } from 'react';
import { buildBom } from '../domain/bom';
import { defaultConfig, defaultPricing, uid } from '../domain/catalog';
import { applySectionFit } from '../domain/interior';
import { buildLayout, columnDoors } from '../domain/layout';
import { computeQuote } from '../domain/pricing';
import { newRoomItem, separateRoomItems, type RoomPreset } from '../domain/room';
import type { CabinetConfig, Column, ColumnDoors, CornerWing, InteriorItem, PricingConfig, RoomItem, Unit } from '../domain/types';

const STORAGE_KEY = 'closet-configurator:v1';

interface Saved {
  config: CabinetConfig;
  pricing: PricingConfig;
  unit: Unit;
  /** Set once units became cm-by-default; older saves stored 'mm' only because it was the default. */
  unitV?: number;
  pricingV?: number;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    // Merge over defaults so older saves pick up newly added fields.
    return {
      config: { ...defaultConfig(), ...saved.config, extras: saved.config.extras ?? [] },
      // Prices saved before the Kosovo defaults (v2) are replaced by them.
      pricing: saved.pricingV === 2 ? { ...defaultPricing(), ...saved.pricing } : defaultPricing(),
      unit: saved.unitV === 2 && saved.unit === 'mm' ? 'mm' : 'cm',
    };
  } catch {
    return null;
  }
}

function withRoomSpace(cfg: CabinetConfig): CabinetConfig {
  const extras = separateRoomItems(cfg);
  return extras === cfg.extras ? cfg : { ...cfg, extras };
}

export function useConfigurator() {
  const [initial] = useState(load);
  const [config, setRawConfig] = useState<CabinetConfig>(() => withRoomSpace(initial?.config ?? defaultConfig()));
  // Every change keeps room items clear of the wardrobe and of each other.
  const setConfig = (u: CabinetConfig | ((c: CabinetConfig) => CabinetConfig)) =>
    setRawConfig((c) => withRoomSpace(typeof u === 'function' ? u(c) : u));
  const [pricing, setPricing] = useState<PricingConfig>(initial?.pricing ?? defaultPricing);
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? 'cm');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, pricing, unit, unitV: 2, pricingV: 2 }));
    } catch {
      /* storage unavailable — the configurator still works, it just won't remember */
    }
  }, [config, pricing, unit]);

  const layout = useMemo(() => buildLayout(config), [config]);
  const bom = useMemo(() => buildBom(config, layout, pricing), [config, layout, pricing]);
  const quote = useMemo(() => computeQuote(bom, pricing), [bom, pricing]);

  // Re-fit sections only when an input to the fit changes, so per-section door edits made
  // afterwards aren't overwritten by unrelated changes.
  const patch = (p: Partial<CabinetConfig>) =>
    setConfig((c) => {
      const next = { ...c, ...p };
      const refit = 'width' in p || 'sectionFit' in p || 'construction' in p;
      return refit ? applySectionFit(next) : next;
    });
  /** Edit one column of the main run, or of the corner wing when `wing` is set. */
  const mapColumn = (ci: number, f: (col: Column, cfg: CabinetConfig) => Column, wing = false) =>
    setConfig((cfg) =>
      wing
        ? { ...cfg, corner: { ...cfg.corner, columns: cfg.corner.columns.map((col, i) => (i === ci ? f(col, cfg) : col)) } }
        : { ...cfg, columns: cfg.columns.map((col, i) => (i === ci ? f(col, cfg) : col)) },
    );
  const updateItem = (ci: number, id: string, p: Partial<InteriorItem>, wing = false) =>
    mapColumn(ci, (col) => ({ ...col, items: col.items.map((it) => (it.id === id ? { ...it, ...p } : it)) }), wing);
  const removeItem = (ci: number, id: string, wing = false) =>
    mapColumn(ci, (col) => ({ ...col, items: col.items.filter((it) => it.id !== id) }), wing);
  const patchCorner = (p: Partial<CornerWing>) => setConfig((cfg) => ({ ...cfg, corner: { ...cfg.corner, ...p } }));

  /** Adds a room item and returns its id. */
  const addExtra = (preset: RoomPreset) => {
    const id = uid('room');
    setConfig((cfg) => ({ ...cfg, extras: [...cfg.extras, newRoomItem(cfg, preset, id)] }));
    return id;
  };
  const updateExtra = (id: string, p: Partial<RoomItem>) =>
    setConfig((cfg) => ({ ...cfg, extras: cfg.extras.map((it) => (it.id === id ? ({ ...it, ...p } as RoomItem) : it)) }));
  const removeExtra = (id: string) => setConfig((cfg) => ({ ...cfg, extras: cfg.extras.filter((it) => it.id !== id) }));
  const setColumnDoors = (ci: number, p: Partial<ColumnDoors>) =>
    mapColumn(ci, (col, cfg) => ({ ...col, doors: { ...columnDoors(col, ci, cfg.columns.length, layout.interior.columnWidths[ci]), ...p } }));

  const patchPricing = (p: Partial<PricingConfig>) => setPricing((c) => ({ ...c, ...p }));
  const reset = () => {
    setConfig(defaultConfig());
    setPricing(defaultPricing());
  };

  return { config, setConfig, patch, updateItem, removeItem, setColumnDoors, patchCorner, addExtra, updateExtra, removeExtra, pricing, patchPricing, unit, setUnit, layout, bom, quote, reset };
}

export type Configurator = ReturnType<typeof useConfigurator>;
