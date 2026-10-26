import { MAX_SINGLE_DOOR, STANDARD_SECTION_WIDTHS } from '../domain/catalog';
import { newColumn, sectionCountFor } from '../domain/interior';
import { fmtLen, toUnit } from '../domain/units';
import type { Construction, SectionFit } from '../domain/types';
import type { Configurator } from '../state/useConfigurator';
import { Icon } from './icons';
import { Button, Field, LengthInput, NumberInput, Section, Segmented, Stat } from './ui';

export function DimensionsPanel({ c }: { c: Configurator }) {
  const { config, patch, unit, layout } = c;
  const { interior } = layout;
  const fit = config.sectionFit;

  const setColumns = (n: number) => {
    const cols = [...config.columns];
    while (cols.length < n) cols.push(newColumn(interior.height, config.thickness));
    patch({ columns: cols.slice(0, n) });
  };
  const setFit = (p: Partial<SectionFit>) => patch({ sectionFit: { ...fit, ...p } });

  const fitCount = sectionCountFor(config.width, fit.width);
  const fitSectionW = config.width / fitCount;
  const fitDoors = fit.doors === 'auto' ? (fitSectionW > MAX_SINGLE_DOOR ? 2 : 1) : fit.doors;

  return (
    <>
      <Section title="Përmasat e jashtme">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Gjerësia">
            <LengthInput mm={config.width} unit={unit} min={300} max={6000} onChange={(width) => patch({ width })} />
          </Field>
          <Field label="Lartësia">
            <LengthInput mm={config.height} unit={unit} min={300} max={2800} onChange={(height) => patch({ height })} />
          </Field>
          <Field label="Thellësia">
            <LengthInput mm={config.depth} unit={unit} min={250} max={900} onChange={(depth) => patch({ depth })} />
          </Field>
        </div>
        <Field label="Lartësia e bazamentit (soklës)" hint="0 = pa bazament">
          <LengthInput mm={config.plinthHeight} unit={unit} min={0} max={250} onChange={(plinthHeight) => patch({ plinthHeight })} />
        </Field>
      </Section>

      <Section title="Seksionet">
        <Field label="Ndërtimi">
          <Segmented<Construction>
            value={config.construction}
            options={[
              { value: 'dividers', label: 'Një korpus + ndarëse' },
              { value: 'modules', label: 'Module të veçanta' },
            ]}
            onChange={(construction) => patch({ construction })}
          />
        </Field>

        <label className="flex items-center gap-2 text-xs font-medium text-stone-700">
          <input type="checkbox" className="accent-accent-500" checked={fit.enabled} onChange={(e) => setFit({ enabled: e.target.checked })} />
          Ndaji seksionet sipas gjerësisë standarde
        </label>

        {fit.enabled ? (
          <>
            <Field label="Gjerësia standarde e seksionit" hint="zakonisht 600 – 1200 mm">
              <div className="space-y-2">
                <Segmented
                  value={STANDARD_SECTION_WIDTHS.includes(fit.width) ? fit.width : -1}
                  options={STANDARD_SECTION_WIDTHS.map((v) => ({ value: v, label: `${+toUnit(v, unit).toFixed(1)}` }))}
                  onChange={(width) => setFit({ width })}
                />
                <LengthInput mm={fit.width} unit={unit} min={300} max={2400} onChange={(width) => setFit({ width })} />
              </div>
            </Field>
            <Field label="Dyer për seksion">
              <Segmented<'auto' | '0' | '1' | '2'>
                value={String(fit.doors) as 'auto' | '0' | '1' | '2'}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: '0', label: 'Pa derë' },
                  { value: '1', label: '1 derë' },
                  { value: '2', label: '2 dyer' },
                ]}
                onChange={(v) => setFit({ doors: v === 'auto' ? 'auto' : (+v as 0 | 1 | 2) })}
              />
            </Field>
            <p className="rounded-md bg-accent-50 px-2.5 py-2 text-xs leading-relaxed text-accent-700">
              <strong>{fitCount}</strong> {fitCount === 1 ? 'seksion' : 'seksione'} × {fmtLen(fitSectionW, unit)}
              {' · '}
              {fitDoors === 0 ? 'pa dyer' : `nga ${fitDoors} ${fitDoors === 1 ? 'derë' : 'dyer'} (~${fmtLen(fitSectionW / fitDoors, unit)} për derë)`}
              {fit.doors === 'auto' && <span className="block text-accent-600">Auto: 1 derë deri në {fmtLen(MAX_SINGLE_DOOR, unit)}, 2 dyer mbi këtë.</span>}
            </p>
          </>
        ) : (
          <Field label="Numri i seksioneve" hint={`secili ${fmtLen(interior.columnWidth, unit)} brenda`}>
            <div className="flex items-center gap-2">
              <Button onClick={() => setColumns(config.columns.length - 1)} disabled={config.columns.length <= 1}>
                <Icon name="minus" />
              </Button>
              <div className="flex-1 text-center text-sm font-semibold tabular-nums">{config.columns.length}</div>
              <Button onClick={() => setColumns(config.columns.length + 1)} disabled={config.columns.length >= 12}>
                <Icon name="plus" />
              </Button>
            </div>
          </Field>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Gjer. brenda" value={fmtLen(interior.columnWidth, unit)} sub="për seksion" />
          <Stat label="Lart. brenda" value={fmtLen(interior.height, unit)} />
          <Stat label="Thell. brenda" value={fmtLen(interior.depth, unit)} />
        </div>
      </Section>

      <Section title="Trashësia e pllakës">
        <Field label="Korpusi & frontet">
          <div className="flex gap-2">
            <Segmented
              value={config.thickness}
              options={[16, 18, 19, 25].map((v) => ({ value: v, label: `${v}` }))}
              onChange={(thickness) => patch({ thickness })}
            />
            <NumberInput className="w-24 shrink-0" value={config.thickness} min={10} max={40} suffix="mm" onChange={(thickness) => patch({ thickness })} />
          </div>
        </Field>
        <Field label="Shpina (HDF)">
          <Segmented
            value={config.backThickness}
            options={[3, 4, 6, 8].map((v) => ({ value: v, label: `${v} mm` }))}
            onChange={(backThickness) => patch({ backThickness })}
          />
        </Field>
      </Section>
    </>
  );
}
