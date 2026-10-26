import { useEffect, useMemo, useState } from 'react';
import { buildBom } from '../domain/bom';
import { defaultConfig, defaultPricing } from '../domain/catalog';
import { applySectionFit } from '../domain/interior';
import { buildLayout, columnDoors } from '../domain/layout';
import { computeQuote } from '../domain/pricing';
import type { CabinetConfig, Column, ColumnDoors, InteriorItem, PricingConfig, Unit } from '../domain/types';

const STORAGE_KEY = 'closet-configurator:v1';

interface Saved {
  config: CabinetConfig;
  pricing: PricingConfig;
  unit: Unit;
  /** Set once units became cm-by-default; older saves stored 'mm' only because it was the default. */
  unitV?: number;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    // Merge over defaults so older saves pick up newly added fields.
    return {
      config: { ...defaultConfig(), ...saved.config },
      pricing: { ...defaultPricing(), ...saved.pricing },
      unit: saved.unitV === 2 && saved.unit === 'mm' ? 'mm' : 'cm',
    };
  } catch {
    return null;
  }
}

export function useConfigurator() {
  const [initial] = useState(load);
  const [config, setConfig] = useState<CabinetConfig>(initial?.config ?? defaultConfig);
  const [pricing, setPricing] = useState<PricingConfig>(initial?.pricing ?? defaultPricing);
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? 'cm');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, pricing, unit, unitV: 2 }));
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
  const mapColumn = (ci: number, f: (col: Column, cfg: CabinetConfig) => Column) =>
    setConfig((cfg) => ({ ...cfg, columns: cfg.columns.map((col, i) => (i === ci ? f(col, cfg) : col)) }));
  const updateItem = (ci: number, id: string, p: Partial<InteriorItem>) =>
    mapColumn(ci, (col) => ({ ...col, items: col.items.map((it) => (it.id === id ? { ...it, ...p } : it)) }));
  const removeItem = (ci: number, id: string) => mapColumn(ci, (col) => ({ ...col, items: col.items.filter((it) => it.id !== id) }));
  const setColumnDoors = (ci: number, p: Partial<ColumnDoors>) =>
    mapColumn(ci, (col, cfg) => ({ ...col, doors: { ...columnDoors(col, ci, cfg.columns.length, layout.interior.columnWidth), ...p } }));

  const patchPricing = (p: Partial<PricingConfig>) => setPricing((c) => ({ ...c, ...p }));
  const reset = () => {
    setConfig(defaultConfig());
    setPricing(defaultPricing());
  };

  return { config, setConfig, patch, updateItem, removeItem, setColumnDoors, pricing, patchPricing, unit, setUnit, layout, bom, quote, reset };
}

export type Configurator = ReturnType<typeof useConfigurator>;
