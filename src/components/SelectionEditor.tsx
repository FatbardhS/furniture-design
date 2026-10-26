import type { ReactNode } from 'react';
import { DEFAULT_DRAWER_HEIGHT } from '../domain/interior';
import { columnDoors } from '../domain/layout';
import type { Selection } from '../domain/selection';
import type { Configurator } from '../state/useConfigurator';
import { Icon, type IconName } from './icons';
import { Button, Field, LengthInput, Segmented, Slider } from './ui';

const ITEM_TITLES: Record<string, { label: string; icon: IconName }> = {
  shelf: { label: 'Raft', icon: 'shelf' },
  rod: { label: 'Shufër varëse', icon: 'rod' },
  drawer: { label: 'Sirtar', icon: 'drawer' },
};

/** Small card over the 3D view for adjusting whatever the user clicked. */
export function SelectionEditor({ c, selection, onClose }: { c: Configurator; selection: Selection; onClose: () => void }) {
  const { config, unit, layout, patch, updateItem, removeItem, setColumnDoors } = c;
  const Hi = Math.round(layout.interior.height);

  let icon: IconName = 'door';
  let title: string;
  let body: ReactNode;

  if (selection.kind === 'item') {
    const { item, column } = selection;
    icon = ITEM_TITLES[item.type].icon;
    title = `${ITEM_TITLES[item.type].label} · Seksioni ${column + 1}`;
    body = (
      <>
        <Slider value={item.y} min={0} max={Hi} step={5} onChange={(y) => updateItem(column, item.id, { y })} />
        <div className={`grid gap-2 ${item.type === 'drawer' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Field label={item.type === 'rod' ? 'Lartësia e shufrës' : 'Fillon në'}>
            <LengthInput mm={item.y} unit={unit} min={0} max={Hi} onChange={(y) => updateItem(column, item.id, { y })} />
          </Field>
          {item.type === 'drawer' && (
            <Field label="Lartësia e ballit">
              <LengthInput mm={item.height ?? DEFAULT_DRAWER_HEIGHT} unit={unit} min={80} max={600} onChange={(height) => updateItem(column, item.id, { height })} />
            </Field>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-stone-400">↑ ↓ lëviz 1 cm · Shift +5 cm · Del fshin</span>
          <Button variant="danger" onClick={() => removeItem(column, item.id)}>
            <Icon name="trash" className="h-3.5 w-3.5" /> Fshi
          </Button>
        </div>
      </>
    );
  } else if (selection.kind === 'door') {
    const ci = selection.column;
    title = ci != null ? `Derë · Seksioni ${ci + 1}` : 'Derë';
    if (config.doorLayout === 'perColumn' && ci != null) {
      const d = columnDoors(config.columns[ci], ci, config.columns.length, layout.interior.columnWidth);
      body = (
        <>
          <Segmented<'0' | '1' | '2'>
            value={String(d.count) as '0' | '1' | '2'}
            options={[
              { value: '0', label: 'Pa derë' },
              { value: '1', label: '1 derë' },
              { value: '2', label: '2 dyer' },
            ]}
            onChange={(v) => setColumnDoors(ci, { count: +v as 0 | 1 | 2 })}
          />
          {d.count === 1 && (
            <Segmented
              value={d.hinge}
              options={[
                { value: 'left', label: 'Pagllama majtas' },
                { value: 'right', label: 'Pagllama djathtas' },
              ]}
              onChange={(hinge) => setColumnDoors(ci, { hinge })}
            />
          )}
          <label className="flex items-center gap-1.5 text-xs text-stone-600">
            <input
              type="checkbox"
              className="accent-accent-500"
              checked={d.split != null}
              onChange={(e) => setColumnDoors(ci, { split: e.target.checked ? Math.round(Hi * 0.75) : null })}
            />
            Ndaj lart / poshtë
          </label>
          {d.split != null && (
            <Field label="Ndarja në">
              <LengthInput mm={d.split} unit={unit} min={100} max={Hi - 100} onChange={(split) => setColumnDoors(ci, { split })} />
            </Field>
          )}
        </>
      );
    } else {
      const max = config.doorType === 'sliding' ? 4 : 8;
      const min = config.doorType === 'sliding' ? 2 : 1;
      body = (
        <Field label="Numri i dyerve">
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
      );
    }
  } else {
    const { part } = selection;
    title = part.name;
    body = (
      <>
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
        {part.category === 'plinth' && (
          <Field label="Lartësia e bazamentit (soklës)">
            <LengthInput mm={config.plinthHeight} unit={unit} min={0} max={250} onChange={(plinthHeight) => patch({ plinthHeight })} />
          </Field>
        )}
      </>
    );
  }

  return (
    <div className="pointer-events-auto w-72 max-w-[calc(100vw-24px)] space-y-2.5 rounded-xl border border-blue-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-blue-100 text-blue-700">
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 text-xs font-semibold text-stone-800">{title}</span>
        <button onClick={onClose} className="rounded px-1.5 text-sm text-stone-400 hover:bg-stone-100 hover:text-stone-700" title="Mbyll (Esc)">
          ×
        </button>
      </div>
      {body}
    </div>
  );
}
