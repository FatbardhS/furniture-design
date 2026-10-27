import { MAX_SINGLE_DOOR, STANDARD_SECTION_WIDTHS } from '../domain/catalog';
import { fitDoorsFor, MIN_REMAINDER_SECTION, newColumn, planSections } from '../domain/interior';
import { CORNER_CLEARANCE } from '../domain/layout';
import { fmtLen, toUnit } from '../domain/units';
import type { ActiveFocus, Construction, CornerWing, SectionFit } from '../domain/types';
import type { Configurator } from '../state/useConfigurator';
import { Icon } from './icons';
import { Button, Field, Flag, LengthInput, NumberInput, Section, Segmented, Stat } from './ui';

export function DimensionsPanel({ c, focus }: { c: Configurator; focus: ActiveFocus | null }) {
  const { config, patch, unit, layout } = c;
  const { interior } = layout;
  const fit = config.sectionFit;

  const setColumns = (n: number) => {
    const cols = [...config.columns];
    while (cols.length < n) cols.push(newColumn(interior.height, config.thickness));
    // Changing the count by hand goes back to equal sections.
    patch({ columns: cols.slice(0, n).map(({ width: _w, ...col }) => col) });
  };
  const setFit = (p: Partial<SectionFit>) => patch({ sectionFit: { ...fit, ...p } });
  const { corner } = config;
  const { patchCorner } = c;
  const setWingColumns = (n: number) => {
    const cols = [...corner.columns];
    while (cols.length < n) cols.push(newColumn(interior.height, config.thickness));
    patchCorner({ columns: cols.slice(0, n) });
  };

  const plan = planSections(config.width, fit);
  const widths = interior.columnWidths;
  const equal = widths.every((w) => Math.abs(w - widths[0]) < 1);
  const innerW = equal ? fmtLen(widths[0], unit) : `${fmtLen(Math.min(...widths), unit)} – ${fmtLen(Math.max(...widths), unit)}`;

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
          <Flag on={focus?.field === 'depth'} nonce={focus?.nonce} tone={focus?.tone}>
            <Field label="Thellësia">
              <LengthInput mm={config.depth} unit={unit} min={250} max={900} onChange={(depth) => patch({ depth })} />
            </Field>
          </Flag>
        </div>
        <Flag on={focus?.field === 'plinth'} nonce={focus?.nonce} tone={focus?.tone}>
          <Field label="Lartësia e bazamentit (soklës)" hint="0 = pa bazament">
            <LengthInput mm={config.plinthHeight} unit={unit} min={0} max={250} onChange={(plinthHeight) => patch({ plinthHeight })} />
          </Field>
        </Flag>
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

        <Flag on={focus?.field === 'sections'} nonce={focus?.nonce} tone={focus?.tone} className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-medium text-stone-700">
          <input type="checkbox" className="accent-accent-500" checked={fit.enabled} onChange={(e) => setFit({ enabled: e.target.checked })} />
          Ndaji seksionet sipas gjerësisë standarde
        </label>

        {fit.enabled ? (
          <>
            <Field label="Gjerësia standarde e seksionit" hint={`zakonisht ${fmtLen(600, unit)} – ${fmtLen(1200, unit)}`}>
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
            {plan.remainder > 0 && (
              <Field label="Seksioni i mbetur">
                <Segmented<'left' | 'right'>
                  value={fit.remainderSide ?? 'right'}
                  options={[
                    { value: 'left', label: 'Majtas' },
                    { value: 'right', label: 'Djathtas' },
                  ]}
                  onChange={(remainderSide) => setFit({ remainderSide })}
                />
              </Field>
            )}
            <div className="space-y-1 rounded-md bg-accent-50 px-2.5 py-2 text-xs leading-relaxed text-accent-700">
              <div>
                <strong>{plan.widths.length}</strong> {plan.widths.length === 1 ? 'seksion' : 'seksione'}:{' '}
                {plan.widths.map((w) => fmtLen(w, unit)).join(' + ')}
              </div>
              {plan.remainder > 0 && (
                <div>Mbetja {fmtLen(plan.remainder, unit)} u bë seksion më vete (me {fitDoorsFor(plan.remainder, fit.doors) || 'pa'} {fitDoorsFor(plan.remainder, fit.doors) === 1 ? 'derë' : 'dyer'}).</div>
              )}
              {plan.spread > 0 && (
                <div>
                  Mbetja {fmtLen(plan.spread, unit)} është nën {fmtLen(MIN_REMAINDER_SECTION, unit)}, prandaj u shpërnda në seksionet e tjera.
                </div>
              )}
              {fit.doors === 'auto' && <div className="text-accent-600">Auto: 1 derë deri në {fmtLen(MAX_SINGLE_DOOR, unit)}, 2 dyer mbi këtë.</div>}
            </div>
          </>
        ) : (
          <Field label="Numri i seksioneve" hint={`secili ${innerW} brenda`}>
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

        </Flag>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Gjer. brenda" value={innerW} sub="për seksion" />
          <Stat label="Lart. brenda" value={fmtLen(interior.height, unit)} />
          <Stat label="Thell. brenda" value={fmtLen(interior.depth, unit)} />
        </div>
      </Section>

      <Section title="Dollap këndor (L)">
        <Flag on={focus?.field === 'corner'} nonce={focus?.nonce} tone={focus?.tone} className="space-y-3">
          <Field label="Krahu i këndit">
            <Segmented<CornerWing['side']>
              value={corner.side}
              options={[
                { value: 'none', label: 'Pa kënd' },
                { value: 'left', label: 'Majtas' },
                { value: 'right', label: 'Djathtas' },
              ]}
              onChange={(side) => patchCorner({ side })}
            />
          </Field>
          {corner.side !== 'none' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Gjatësia e krahut">
                  <LengthInput mm={corner.length} unit={unit} min={500} max={4000} onChange={(length) => patchCorner({ length })} />
                </Field>
                <Field label="Seksione në krah">
                  <div className="flex items-center gap-1.5">
                    <Button onClick={() => setWingColumns(corner.columns.length - 1)} disabled={corner.columns.length <= 1}>
                      <Icon name="minus" />
                    </Button>
                    <div className="flex-1 text-center text-sm font-semibold tabular-nums">{corner.columns.length}</div>
                    <Button onClick={() => setWingColumns(corner.columns.length + 1)} disabled={corner.columns.length >= 8}>
                      <Icon name="plus" />
                    </Button>
                  </div>
                </Field>
              </div>
              <p className="rounded-md bg-accent-50 px-2.5 py-2 text-xs leading-relaxed text-accent-700">
                Krahu qëndron përgjatë murit anësor. Pjesa e dollapit kryesor pas krahut ({fmtLen(config.depth + CORNER_CLEARANCE, unit)}) mbulohet me
                një panel fiks; dyert pranë këndit hapen në drejtim të kundërt që të mos përplasen. Brendësinë e krahut e rregulloni te “Brendësia”.
              </p>
            </>
          )}
        </Flag>
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
