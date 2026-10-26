import { newColumn } from '../domain/interior';
import { fmtLen } from '../domain/units';
import type { Configurator } from '../state/useConfigurator';
import { Icon } from './icons';
import { Button, Field, LengthInput, NumberInput, Section, Segmented, Stat } from './ui';

export function DimensionsPanel({ c }: { c: Configurator }) {
  const { config, patch, unit, layout } = c;
  const { interior } = layout;

  const setColumns = (n: number) => {
    const cols = [...config.columns];
    while (cols.length < n) cols.push(newColumn(interior.height, config.thickness));
    patch({ columns: cols.slice(0, n) });
  };

  return (
    <>
      <Section title="Overall size">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Width">
            <LengthInput mm={config.width} unit={unit} min={300} max={4000} onChange={(width) => patch({ width })} />
          </Field>
          <Field label="Height">
            <LengthInput mm={config.height} unit={unit} min={300} max={2800} onChange={(height) => patch({ height })} />
          </Field>
          <Field label="Depth">
            <LengthInput mm={config.depth} unit={unit} min={250} max={900} onChange={(depth) => patch({ depth })} />
          </Field>
        </div>
        <Field label="Plinth / toe-kick height" hint="0 = none">
          <LengthInput mm={config.plinthHeight} unit={unit} min={0} max={250} onChange={(plinthHeight) => patch({ plinthHeight })} />
        </Field>
      </Section>

      <Section title="Board thickness">
        <Field label="Carcass & fronts">
          <div className="flex gap-2">
            <Segmented
              value={config.thickness}
              options={[16, 18, 19, 25].map((v) => ({ value: v, label: `${v}` }))}
              onChange={(thickness) => patch({ thickness })}
            />
            <NumberInput className="w-24 shrink-0" value={config.thickness} min={10} max={40} suffix="mm" onChange={(thickness) => patch({ thickness })} />
          </div>
        </Field>
        <Field label="Back panel (HDF)">
          <Segmented
            value={config.backThickness}
            options={[3, 4, 6, 8].map((v) => ({ value: v, label: `${v} mm` }))}
            onChange={(backThickness) => patch({ backThickness })}
          />
        </Field>
      </Section>

      <Section title="Sections">
        <Field label="Vertical columns" hint={`each ${fmtLen(interior.columnWidth, unit)} wide`}>
          <div className="flex items-center gap-2">
            <Button onClick={() => setColumns(config.columns.length - 1)} disabled={config.columns.length <= 1}>
              <Icon name="minus" />
            </Button>
            <div className="flex-1 text-center text-sm font-semibold tabular-nums">{config.columns.length}</div>
            <Button onClick={() => setColumns(config.columns.length + 1)} disabled={config.columns.length >= 8}>
              <Icon name="plus" />
            </Button>
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Inner W" value={fmtLen(interior.width, unit)} />
          <Stat label="Inner H" value={fmtLen(interior.height, unit)} />
          <Stat label="Inner D" value={fmtLen(interior.depth, unit)} />
        </div>
      </Section>
    </>
  );
}
