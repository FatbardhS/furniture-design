import { HANDLE_LABELS } from '../domain/catalog';
import { columnDoors } from '../domain/layout';
import { fmtLen } from '../domain/units';
import type { ColumnDoors, DoorLayout, DoorType, HandleFinish, HandleType } from '../domain/types';
import type { Configurator } from '../state/useConfigurator';
import { Icon } from './icons';
import { Button, Field, LengthInput, Section, Segmented, Select, Stat } from './ui';

const DOOR_LIMITS: Record<DoorType, [number, number]> = { none: [0, 0], hinged: [1, 8], sliding: [2, 4] };

export function DoorsPanel({ c }: { c: Configurator }) {
  const { config, patch, layout, unit } = c;
  const [min, max] = DOOR_LIMITS[config.doorType];
  const doors = layout.doors;
  const perColumn = config.doorType === 'hinged' && config.doorLayout === 'perColumn';

  const setType = (doorType: DoorType) => {
    const [lo, hi] = DOOR_LIMITS[doorType];
    patch({ doorType, doorCount: Math.min(hi, Math.max(lo, config.doorCount)) });
  };

  return (
    <>
      <Section title="Doors">
        <Segmented
          value={config.doorType}
          options={[
            { value: 'none', label: 'Open shelving' },
            { value: 'hinged', label: 'Hinged' },
            { value: 'sliding', label: 'Sliding' },
          ]}
          onChange={setType}
        />
        {config.doorType === 'hinged' && (
          <Field label="Door layout">
            <Segmented<DoorLayout>
              value={config.doorLayout}
              options={[
                { value: 'even', label: 'Across full width' },
                { value: 'perColumn', label: 'Per section' },
              ]}
              onChange={(doorLayout) => patch({ doorLayout })}
            />
          </Field>
        )}
        {config.doorType !== 'none' && !perColumn && (
          <Field label="Number of doors">
            <div className="flex items-center gap-2">
              <Button onClick={() => patch({ doorCount: config.doorCount - 1 })} disabled={config.doorCount <= min}>
                <Icon name="minus" />
              </Button>
              <div className="flex-1 text-center text-sm font-semibold tabular-nums">{config.doorCount}</div>
              <Button onClick={() => patch({ doorCount: config.doorCount + 1 })} disabled={config.doorCount >= max}>
                <Icon name="plus" />
              </Button>
            </div>
          </Field>
        )}
        {config.doorType !== 'none' && doors.count > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label={perColumn ? 'Largest door' : 'Door size'}
              value={`${fmtLen(doors.width, unit)} × ${fmtLen(doors.height, unit)}`}
              sub={`${doors.count} ${doors.count === 1 ? 'door' : 'doors'} · ${doors.weightKg.toFixed(1)} kg`}
            />
            <Stat
              label={config.doorType === 'hinged' ? 'Hinges' : 'Track'}
              value={config.doorType === 'hinged' ? `${doors.hingeTotal} total` : '2 tracks'}
              sub={config.doorType === 'hinged' ? 'by door height & weight' : 'top + bottom'}
            />
          </div>
        )}
      </Section>

      {perColumn && <SectionDoors c={c} />}

      <Section title="Hardware">
        <Field label="Handles">
          <Select<HandleType>
            value={config.handleType}
            options={(Object.keys(HANDLE_LABELS) as HandleType[]).map((k) => ({ value: k, label: HANDLE_LABELS[k] }))}
            onChange={(handleType) => patch({ handleType })}
          />
        </Field>
        {config.handleType !== 'none' && (
          <Field label="Handle finish">
            <Segmented<HandleFinish>
              value={config.handleFinish}
              options={[
                { value: 'chrome', label: 'Chrome' },
                { value: 'black', label: 'Black' },
                { value: 'brass', label: 'Brass' },
              ]}
              onChange={(handleFinish) => patch({ handleFinish })}
            />
          </Field>
        )}
        {config.doorType === 'hinged' && (
          <Field label="Hinges (pagllama)">
            <Segmented
              value={config.hingeType}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'softClose', label: 'Soft-close' },
              ]}
              onChange={(hingeType) => patch({ hingeType })}
            />
          </Field>
        )}
        <Field label="Drawer slides">
          <Segmented
            value={config.slideType}
            options={[
              { value: 'ballBearing', label: 'Ball-bearing' },
              { value: 'softCloseUndermount', label: 'Soft-close undermount' },
            ]}
            onChange={(slideType) => patch({ slideType })}
          />
        </Field>
      </Section>
    </>
  );
}

/** Per-column door editor: none / single / pair, hinge side, optional upper/lower split. */
function SectionDoors({ c }: { c: Configurator }) {
  const { config, patch, layout, unit } = c;
  const { columnWidth, height: Hi } = layout.interior;
  const n = config.columns.length;

  const setDoors = (ci: number, p: Partial<ColumnDoors>) =>
    patch({
      columns: config.columns.map((col, i) => (i === ci ? { ...col, doors: { ...columnDoors(col, i, n, columnWidth), ...p } } : col)),
    });

  /** Default split: line up with the shelf nearest 3/4 of the height, so the seam sits on a shelf. */
  const defaultSplit = (ci: number) => {
    const shelves = config.columns[ci].items.filter((it) => it.type === 'shelf');
    const target = Hi * 0.75;
    const best = shelves.reduce<number | null>(
      (b, s) => (b == null || Math.abs(s.y - target) < Math.abs(b - target) ? s.y : b),
      null,
    );
    return Math.round(best != null ? best + config.thickness / 2 : target);
  };

  return (
    <Section title="Doors per section">
      {config.columns.map((col, ci) => {
        const d = columnDoors(col, ci, n, columnWidth);
        return (
          <div key={col.id} className="rounded-lg border border-stone-200 bg-white p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-700">Section {ci + 1}</span>
              <span className="text-[11px] text-stone-400">{fmtLen(columnWidth, unit)} wide</span>
            </div>
            <Segmented<'0' | '1' | '2'>
              value={String(d.count) as '0' | '1' | '2'}
              options={[
                { value: '0', label: 'Open' },
                { value: '1', label: '1 door' },
                { value: '2', label: '2 doors' },
              ]}
              onChange={(v) => setDoors(ci, { count: +v as 0 | 1 | 2 })}
            />
            {d.count === 1 && (
              <div className="mt-2">
                <Segmented
                  value={d.hinge}
                  options={[
                    { value: 'left', label: 'Hinge left' },
                    { value: 'right', label: 'Hinge right' },
                  ]}
                  onChange={(hinge) => setDoors(ci, { hinge })}
                />
              </div>
            )}
            {d.count > 0 && (
              <div className="mt-2 flex items-end gap-2">
                <label className="flex items-center gap-1.5 pb-1.5 text-xs text-stone-600">
                  <input
                    type="checkbox"
                    className="accent-accent-500"
                    checked={d.split != null}
                    onChange={(e) => setDoors(ci, { split: e.target.checked ? defaultSplit(ci) : null })}
                  />
                  Split upper / lower
                </label>
                {d.split != null && (
                  <div className="flex-1">
                    <Field label="Split at">
                      <LengthInput mm={d.split} unit={unit} min={100} max={Hi - 100} onChange={(split) => setDoors(ci, { split })} />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Section>
  );
}
