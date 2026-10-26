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
      <Section title="General">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Currency">
            <input
              className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm"
              value={p.currency}
              maxLength={4}
              onChange={(e) => patchPricing({ currency: e.target.value })}
            />
          </Field>
          <Field label="Waste">
            <NumberInput value={p.wastePercent} min={0} max={60} suffix="%" onChange={(wastePercent) => patchPricing({ wastePercent })} />
          </Field>
          <Field label="VAT">
            <NumberInput value={p.vatPercent} min={0} max={40} suffix="%" onChange={(vatPercent) => patchPricing({ vatPercent })} />
          </Field>
        </div>
      </Section>

      <Section title={`Boards · ${cur}/m²`}>
        {MATERIALS.map((m) => (
          <PriceRow
            key={m.id}
            label={
              <>
                {m.name}
                {inUse.has(m.id) && <span className="ml-1.5 rounded bg-accent-100 px-1 py-px text-[10px] font-semibold text-accent-700">in use</span>}
              </>
            }
            highlight={inUse.has(m.id)}
            value={p.boardPrices[m.id] ?? 0}
            unit={`${cur}`}
            onChange={(v) => patchPricing({ boardPrices: { ...p.boardPrices, [m.id]: v } })}
          />
        ))}
        <PriceRow label="Back panel HDF/MDF" value={p.backPanelPerM2} unit={cur} onChange={(backPanelPerM2) => patchPricing({ backPanelPerM2 })} />
        <PriceRow label="Edge banding (per m)" value={p.edgeBandingPerM} unit={cur} onChange={(edgeBandingPerM) => patchPricing({ edgeBandingPerM })} />
      </Section>

      <Section title={`Hardware · ${cur} per unit`}>
        <PriceRow label="Hinge — standard" value={p.hinge.standard} unit={cur} onChange={(v) => nested('hinge', 'standard', v)} />
        <PriceRow label="Hinge — soft-close" value={p.hinge.softClose} unit={cur} onChange={(v) => nested('hinge', 'softClose', v)} />
        <PriceRow label="Slides — ball-bearing (pair)" value={p.slidePair.ballBearing} unit={cur} onChange={(v) => nested('slidePair', 'ballBearing', v)} />
        <PriceRow label="Slides — undermount (pair)" value={p.slidePair.softCloseUndermount} unit={cur} onChange={(v) => nested('slidePair', 'softCloseUndermount', v)} />
        <PriceRow label="Bar handle" value={p.handle.bar} unit={cur} onChange={(v) => nested('handle', 'bar', v)} />
        <PriceRow label="Knob" value={p.handle.knob} unit={cur} onChange={(v) => nested('handle', 'knob', v)} />
        <PriceRow label="Push-to-open latch" value={p.handle.none} unit={cur} onChange={(v) => nested('handle', 'none', v)} />
        <PriceRow label="Hanging rod (per m)" value={p.hangingRodPerM} unit={cur} onChange={(hangingRodPerM) => patchPricing({ hangingRodPerM })} />
        <PriceRow label="Rod end mount" value={p.rodMount} unit={cur} onChange={(rodMount) => patchPricing({ rodMount })} />
        <PriceRow label="Shelf support pin" value={p.shelfSupport} unit={cur} onChange={(shelfSupport) => patchPricing({ shelfSupport })} />
        <PriceRow label="Sliding track (per m)" value={p.slidingTrackPerM} unit={cur} onChange={(slidingTrackPerM) => patchPricing({ slidingTrackPerM })} />
        <PriceRow label="Sliding roller set (per door)" value={p.slidingRollerSet} unit={cur} onChange={(slidingRollerSet) => patchPricing({ slidingRollerSet })} />
      </Section>

      <Section title="Labor & services">
        <Segmented<LaborMode>
          value={p.laborMode}
          options={[
            { value: 'percent', label: '% of cost' },
            { value: 'perM2', label: 'Per m²' },
            { value: 'fixed', label: 'Fixed fee' },
          ]}
          onChange={(laborMode) => patchPricing({ laborMode })}
        />
        <PriceRow
          label={p.laborMode === 'percent' ? 'Workmanship (% of materials + hardware)' : p.laborMode === 'perM2' ? 'Workmanship per m² of board' : 'Workmanship (project fee)'}
          value={p.laborValue}
          unit={p.laborMode === 'percent' ? '%' : cur}
          onChange={(laborValue) => patchPricing({ laborValue })}
        />
        <PriceRow label="Installation & delivery" value={p.installationFee} unit={cur} onChange={(installationFee) => patchPricing({ installationFee })} />
      </Section>
    </>
  );
}
