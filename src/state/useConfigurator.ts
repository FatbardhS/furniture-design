import { useEffect, useMemo, useState } from 'react';
import { buildBom } from '../domain/bom';
import { defaultConfig, defaultPricing } from '../domain/catalog';
import { buildLayout } from '../domain/layout';
import { computeQuote } from '../domain/pricing';
import type { CabinetConfig, PricingConfig, Unit } from '../domain/types';

const STORAGE_KEY = 'closet-configurator:v1';

interface Saved {
  config: CabinetConfig;
  pricing: PricingConfig;
  unit: Unit;
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
      unit: saved.unit === 'cm' ? 'cm' : 'mm',
    };
  } catch {
    return null;
  }
}

export function useConfigurator() {
  const [initial] = useState(load);
  const [config, setConfig] = useState<CabinetConfig>(initial?.config ?? defaultConfig);
  const [pricing, setPricing] = useState<PricingConfig>(initial?.pricing ?? defaultPricing);
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? 'mm');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, pricing, unit }));
    } catch {
      /* storage unavailable — the configurator still works, it just won't remember */
    }
  }, [config, pricing, unit]);

  const layout = useMemo(() => buildLayout(config), [config]);
  const bom = useMemo(() => buildBom(config, layout, pricing), [config, layout, pricing]);
  const quote = useMemo(() => computeQuote(bom, pricing), [bom, pricing]);

  const patch = (p: Partial<CabinetConfig>) => setConfig((c) => ({ ...c, ...p }));
  const patchPricing = (p: Partial<PricingConfig>) => setPricing((c) => ({ ...c, ...p }));
  const reset = () => {
    setConfig(defaultConfig());
    setPricing(defaultPricing());
  };

  return { config, setConfig, patch, pricing, patchPricing, unit, setUnit, layout, bom, quote, reset };
}

export type Configurator = ReturnType<typeof useConfigurator>;
