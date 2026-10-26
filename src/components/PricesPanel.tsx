import type { ReactNode } from 'react';
import { MATERIALS } from '../domain/catalog';
import type { LaborMode, PricingConfig } from '../domain/types';
import type { Configurator } from '../state/useConfigurator';
import { Field, NumberInput, Section, Segmented } from './ui';

function PriceRow({ label, value, unit, onChange, highlight }: { label: ReactNode; value: number; unit: string; onChange: (v: number) => void; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_120px] items-center gap-2">
      <span className={`text-xs ${highlight ? 'font-semibold text-stone-800' : 'text-stone-600'}`}>{label}</span>
      <NumberInput value={value} min={0} step={0.1} suffix={unit} onChange={onChange} />
    </div>
  );
}

export function PricesPanel({ c }: { c: Configurator }) {
  const { pricing: p, patchPricing, config } = c;
  const cur = p.currency;
  const nested = <K extends 'hinge' | 'slidePair' | 'handle'>(key: K, sub: keyof PricingConfig[K], v: number) =>
    patchPricing({ [key]: { ...p[key], [sub]: v } } as Partial<PricingConfig>);
  const inUse = new Set([config.carcassFinish.materialId, config.frontFinish.materialId]);

  return (
    <>
      <Section title="Të përgjithshme">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Valuta">
            <input
              className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm"
              value={p.currency}
              maxLength={4}
              onChange={(e) => patchPricing({ currency: e.target.value })}
            />
          </Field>
          <Field label="Humbja">
            <NumberInput value={p.wastePercent} min={0} max={60} suffix="%" onChange={(wastePercent) => patchPricing({ wastePercent })} />
          </Field>
          <Field label="TVSH">
            <NumberInput value={p.vatPercent} min={0} max={40} suffix="%" onChange={(vatPercent) => patchPricing({ vatPercent })} />
          </Field>
        </div>
      </Section>

      <Section title={`Pllakat · ${cur}/m²`}>
        {MATERIALS.map((m) => (
          <PriceRow
            key={m.id}
            label={
              <>
                {m.name}
                {inUse.has(m.id) && <span className="ml-1.5 rounded bg-accent-100 px-1 py-px text-[10px] font-semibold text-accent-700">në përdorim</span>}
              </>
            }
            highlight={inUse.has(m.id)}
            value={p.boardPrices[m.id] ?? 0}
            unit={`${cur}`}
            onChange={(v) => patchPricing({ boardPrices: { ...p.boardPrices, [m.id]: v } })}
          />
        ))}
        <PriceRow label="Shpina HDF/MDF" value={p.backPanelPerM2} unit={cur} onChange={(backPanelPerM2) => patchPricing({ backPanelPerM2 })} />
        <PriceRow label="Kanti (për m)" value={p.edgeBandingPerM} unit={cur} onChange={(edgeBandingPerM) => patchPricing({ edgeBandingPerM })} />
      </Section>

      <Section title={`Okovët · ${cur} për copë`}>
        <PriceRow label="Pagllama — standarde" value={p.hinge.standard} unit={cur} onChange={(v) => nested('hinge', 'standard', v)} />
        <PriceRow label="Pagllama — mbyllje e butë" value={p.hinge.softClose} unit={cur} onChange={(v) => nested('hinge', 'softClose', v)} />
        <PriceRow label="Shina — me sfera (palë)" value={p.slidePair.ballBearing} unit={cur} onChange={(v) => nested('slidePair', 'ballBearing', v)} />
        <PriceRow label="Shina — nën sirtar (palë)" value={p.slidePair.softCloseUndermount} unit={cur} onChange={(v) => nested('slidePair', 'softCloseUndermount', v)} />
        <PriceRow label="Dorezë shufër" value={p.handle.bar} unit={cur} onChange={(v) => nested('handle', 'bar', v)} />
        <PriceRow label="Dorezë e rrumbullakët" value={p.handle.knob} unit={cur} onChange={(v) => nested('handle', 'knob', v)} />
        <PriceRow label="Mekanizëm push-to-open" value={p.handle.none} unit={cur} onChange={(v) => nested('handle', 'none', v)} />
        <PriceRow label="Shufër varëse (për m)" value={p.hangingRodPerM} unit={cur} onChange={(hangingRodPerM) => patchPricing({ hangingRodPerM })} />
        <PriceRow label="Mbajtëse shufre" value={p.rodMount} unit={cur} onChange={(rodMount) => patchPricing({ rodMount })} />
        <PriceRow label="Kunj mbajtës rafti" value={p.shelfSupport} unit={cur} onChange={(shelfSupport) => patchPricing({ shelfSupport })} />
        <PriceRow label="Shinë rrëshqitëse (për m)" value={p.slidingTrackPerM} unit={cur} onChange={(slidingTrackPerM) => patchPricing({ slidingTrackPerM })} />
        <PriceRow label="Set rrotash (për derë)" value={p.slidingRollerSet} unit={cur} onChange={(slidingRollerSet) => patchPricing({ slidingRollerSet })} />
      </Section>

      <Section title="Puna & shërbimet">
        <Segmented<LaborMode>
          value={p.laborMode}
          options={[
            { value: 'percent', label: '% e kostos' },
            { value: 'perM2', label: 'Për m²' },
            { value: 'fixed', label: 'Çmim fiks' },
          ]}
          onChange={(laborMode) => patchPricing({ laborMode })}
        />
        <PriceRow
          label={p.laborMode === 'percent' ? 'Puna (% e materialit + okovëve)' : p.laborMode === 'perM2' ? 'Puna për m² pllakë' : 'Puna (çmim për projekt)'}
          value={p.laborValue}
          unit={p.laborMode === 'percent' ? '%' : cur}
          onChange={(laborValue) => patchPricing({ laborValue })}
        />
        <PriceRow label="Montimi & transporti" value={p.installationFee} unit={cur} onChange={(installationFee) => patchPricing({ installationFee })} />
      </Section>
    </>
  );
}
