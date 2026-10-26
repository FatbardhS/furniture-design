import { useState } from 'react';
import { uid } from '../domain/catalog';
import { DEFAULT_DRAWER_HEIGHT, distributeShelves, placeNewItem, sortItems } from '../domain/interior';
import { fmtLen } from '../domain/units';
import type { Column, InteriorItem, ItemType } from '../domain/types';
import type { Configurator } from '../state/useConfigurator';
import { Icon, type IconName } from './icons';
import { Button, Field, LengthInput, Section, Slider } from './ui';

const ITEM_META: Record<ItemType, { label: string; icon: IconName }> = {
  shelf: { label: 'Raft', icon: 'shelf' },
  rod: { label: 'Shufër varëse', icon: 'rod' },
  drawer: { label: 'Sirtar', icon: 'drawer' },
};

export function InteriorPanel({ c }: { c: Configurator }) {
  const { config, patch, unit, layout } = c;
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState('');
  const ci = Math.min(active, config.columns.length - 1);
  const column = config.columns[ci];
  const Hi = layout.interior.height;
  const T = config.thickness;

  const setColumnAt = (index: number, col: Column) => patch({ columns: config.columns.map((c, i) => (i === index ? col : c)) });
  const setColumn = (col: Column) => setColumnAt(ci, col);

  const addShelf = (index: number) => {
    const col = config.columns[index];
    const shelf = placeNewItem(col, 'shelf', Hi, T);
    setNotice(shelf ? '' : `Nuk ka hapësirë për raft tjetër në seksionin ${index + 1}.`);
    if (shelf) setColumnAt(index, { ...col, items: [...col.items, shelf] });
  };
  /** Removes the most recently added shelf, so + then − is a clean undo. */
  const removeShelf = (index: number) => {
    const col = config.columns[index];
    const last = col.items.findLastIndex((it) => it.type === 'shelf');
    if (last >= 0) setColumnAt(index, { ...col, items: col.items.filter((_, i) => i !== last) });
  };
  const updateItem = (id: string, p: Partial<InteriorItem>) =>
    setColumn({ ...column, items: column.items.map((it) => (it.id === id ? { ...it, ...p } : it)) });

  const add = (type: ItemType) => {
    const item = placeNewItem(column, type, Hi, T);
    if (!item) {
      setNotice(`Nuk ka hapësirë të lirë për ${ITEM_META[type].label.toLowerCase()} në këtë seksion.`);
      return;
    }
    setNotice('');
    setColumn({ ...column, items: [...column.items, item] });
  };

  const copyToAll = () =>
    patch({
      columns: config.columns.map((c, i) =>
        i === ci ? c : { ...c, items: column.items.map((it) => ({ ...it, id: uid('it') })) },
      ),
    });

  return (
    <>
      <Section title="Raftet për seksion">
        {config.columns.map((col, i) => {
          const count = col.items.filter((it) => it.type === 'shelf').length;
          return (
            <div key={col.id} className="flex items-center gap-2">
              <button
                onClick={() => setActive(i)}
                className={`flex-1 text-left text-xs ${i === ci ? 'font-semibold text-accent-700' : 'text-stone-600 hover:text-stone-900'}`}
              >
                Seksioni {i + 1}
              </button>
              <Button onClick={() => removeShelf(i)} disabled={count === 0} title="Hiq një raft">
                <Icon name="minus" className="h-3.5 w-3.5" />
              </Button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{count}</span>
              <Button onClick={() => addShelf(i)} title="Shto një raft">
                <Icon name="plus" className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {notice && <p className="text-xs text-amber-700">{notice}</p>}
      </Section>

      <Section title="Seksioni">
        <div className="flex flex-wrap gap-1.5">
          {config.columns.map((col, i) => (
            <button
              key={col.id}
              onClick={() => setActive(i)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                i === ci ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'
              }`}
            >
              {i + 1}
              <span className="ml-1 font-normal text-stone-400">· {col.items.length}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <ColumnElevation column={column} interiorHeight={Hi} thickness={T} />
          <div className="flex flex-1 flex-col gap-1.5">
            {(['shelf', 'rod', 'drawer'] as const).map((t) => (
              <Button key={t} onClick={() => add(t)} className="justify-start">
                <Icon name="plus" className="h-3.5 w-3.5" />
                {ITEM_META[t].label}
              </Button>
            ))}
            <Button variant="ghost" className="justify-start" onClick={() => setColumn(distributeShelves(column, Hi, T))}>
              <Icon name="spread" className="h-3.5 w-3.5" /> Shpërndaj raftet njëtrajtësisht
            </Button>
            {config.columns.length > 1 && (
              <Button variant="ghost" className="justify-start" onClick={copyToAll}>
                <Icon name="copy" className="h-3.5 w-3.5" /> Kopjo në të gjitha seksionet
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section
        title={`Elementet · seksioni ${ci + 1}`}
        action={
          column.items.length > 0 && (
            <Button variant="danger" onClick={() => setColumn({ ...column, items: [] })}>
              Pastro
            </Button>
          )
        }
      >
        {column.items.length === 0 && <p className="text-xs text-stone-500">Seksion bosh. Shtoni rafte, shufra ose sirtarë më lart.</p>}
        {sortItems(column.items)
          .reverse()
          .map((it) => (
            <div key={it.id} className="rounded-lg border border-stone-200 bg-white p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <Icon name={ITEM_META[it.type].icon} className="h-4 w-4 text-stone-500" />
                <span className="text-xs font-semibold text-stone-700">{ITEM_META[it.type].label}</span>
                <span className="ml-auto text-[11px] tabular-nums text-stone-400">{fmtLen(it.y, unit)} nga fundi</span>
                <Button variant="danger" className="px-1.5" onClick={() => setColumn({ ...column, items: column.items.filter((x) => x.id !== it.id) })} title="Hiq">
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Slider value={it.y} min={0} max={Math.max(0, Math.round(Hi))} step={5} onChange={(y) => updateItem(it.id, { y })} />
              <div className={`mt-1.5 grid gap-2 ${it.type === 'drawer' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Field label={it.type === 'rod' ? 'Lartësia e shufrës' : 'Fillon në'}>
                  <LengthInput mm={it.y} unit={unit} min={0} max={Hi} onChange={(y) => updateItem(it.id, { y })} />
                </Field>
                {it.type === 'drawer' && (
                  <Field label="Lartësia e ballit">
                    <LengthInput mm={it.height ?? DEFAULT_DRAWER_HEIGHT} unit={unit} min={80} max={600} onChange={(height) => updateItem(it.id, { height })} />
                  </Field>
                )}
              </div>
            </div>
          ))}
      </Section>
    </>
  );
}

/** Small front elevation of one column so positions are easy to read at a glance. */
function ColumnElevation({ column, interiorHeight, thickness }: { column: Column; interiorHeight: number; thickness: number }) {
  const w = 64;
  const h = 150;
  const s = h / Math.max(interiorHeight, 1);
  const y = (mm: number) => h - mm * s;
  return (
    <svg width={w + 8} height={h + 8} viewBox={`-4 -4 ${w + 8} ${h + 8}`} className="shrink-0" aria-label="Pamja e seksionit">
      <rect x={0} y={0} width={w} height={h} fill="#fafaf9" stroke="#a8a29e" strokeWidth={1.5} />
      {column.items.map((it) => {
        if (it.type === 'shelf') return <rect key={it.id} x={0} y={y(it.y + thickness)} width={w} height={Math.max(2, thickness * s)} fill="#78716c" />;
        if (it.type === 'rod')
          return (
            <g key={it.id}>
              <line x1={4} x2={w - 4} y1={y(it.y)} y2={y(it.y)} stroke="#57534e" strokeWidth={2} strokeLinecap="round" />
              <path d={`M${w / 2 - 6} ${y(it.y) + 2} l6 9 l6 -9`} fill="none" stroke="#a8a29e" strokeWidth={1} />
            </g>
          );
        const dh = (it.height ?? DEFAULT_DRAWER_HEIGHT) * s;
        return (
          <g key={it.id}>
            <rect x={2} y={y(it.y) - dh + 1} width={w - 4} height={Math.max(2, dh - 2)} fill="#e7d8c6" stroke="#b07a48" strokeWidth={1} />
            <line x1={w / 2 - 8} x2={w / 2 + 8} y1={y(it.y) - dh / 2} y2={y(it.y) - dh / 2} stroke="#78716c" strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}
