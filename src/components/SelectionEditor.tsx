import type { ReactNode } from 'react';
import { DEFAULT_DRAWER_HEIGHT } from '../domain/interior';
import { columnDoors } from '../domain/layout';
import { ROOM_LABELS } from '../domain/room';
import type { Selection } from '../domain/selection';
import type { InteriorItem, RoomItem } from '../domain/types';
import type { Configurator } from '../state/useConfigurator';
import { DoorStylePicker } from './FinishPanel';
import { BedFrameFields, BedHeadFields, BedMattressFields, DresserBodyFields, DresserMirrorFields, MirrorFields } from './RoomPanel';
import { Icon, type IconName } from './icons';
import { Button, Field, LengthInput, Segmented, Slider } from './ui';

const PIECE_TITLES = { head: 'Koka', frame: 'Korniza', mattress: 'Dysheku', mirror: 'Pasqyra', body: 'Trupi' } as const;

const ITEM_TITLES: Record<string, { label: string; icon: IconName }> = {
  shelf: { label: 'Raft', icon: 'shelf' },
  rod: { label: 'Shufër varëse', icon: 'rod' },
  drawer: { label: 'Sirtar', icon: 'drawer' },
};

/** Small card over the 3D view for adjusting whatever the user clicked. */
export function SelectionEditor({ c, selection, onClose }: { c: Configurator; selection: Selection; onClose: () => void }) {
  const { config, unit, layout, patch, setColumnDoors } = c;
  const Hi = Math.round(layout.interior.height);
  const wing = selection.kind !== 'extra' && !!selection.wing;
  const updateItem = (ci: number, id: string, p: Partial<InteriorItem>) => c.updateItem(ci, id, p, wing);
  const removeItem = (ci: number, id: string) => c.removeItem(ci, id, wing);

  let icon: IconName = 'door';
  let title: string;
  let body: ReactNode;

  if (selection.kind === 'extra') {
    const { extra, piece } = selection;
    const name = extra.kind === 'dresser' && extra.width <= 600 ? 'Komodinë' : ROOM_LABELS[extra.kind];
    title = piece in PIECE_TITLES && extra.kind !== 'mirror' ? `${name} · ${PIECE_TITLES[piece as keyof typeof PIECE_TITLES]}` : name;
    const pieceFields =
      extra.kind === 'bed' ? (
        piece === 'head' ? <BedHeadFields it={extra} c={c} /> : piece === 'mattress' ? <BedMattressFields it={extra} c={c} /> : <BedFrameFields it={extra} c={c} />
      ) : extra.kind === 'dresser' ? (
        piece === 'mirror' ? <DresserMirrorFields it={extra} c={c} /> : <DresserBodyFields it={extra} c={c} />
      ) : (
        <MirrorFields it={extra} c={c} />
      );
    body = (
      <>
        <div className="max-h-[50vh] space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">{pieceFields}</div>
        <div className="border-t border-stone-100" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Majtas/djathtas">
            <LengthInput mm={extra.x} unit={unit} min={-15000} max={15000} onChange={(x) => c.updateExtra(extra.id, { x })} />
          </Field>
          <Field label="Para/prapa">
            <LengthInput mm={extra.z} unit={unit} min={-15000} max={15000} onChange={(z) => c.updateExtra(extra.id, { z })} />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button onClick={() => c.updateExtra(extra.id, { rotation: (((extra.rotation + 90) % 360) as RoomItem['rotation']) })}>
            <Icon name="reset" className="h-3.5 w-3.5" /> Rrotullo 90°
          </Button>
          <Button variant="danger" onClick={() => c.removeExtra(extra.id)}>
            <Icon name="trash" className="h-3.5 w-3.5" /> Fshi
          </Button>
        </div>
        <p className="text-[10px] text-stone-400">Më shumë opsione te skeda “Dhoma”.</p>
      </>
    );
  } else if (selection.kind === 'item') {
    const { item, column } = selection;
    icon = ITEM_TITLES[item.type].icon;
    title = `${ITEM_TITLES[item.type].label} · ${wing ? 'Krahu, s' : 'S'}eksioni ${column + 1}`;
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
    title = wing ? 'Derë · Krahu i këndit' : ci != null ? `Derë · Seksioni ${ci + 1}` : 'Derë';
    if (wing) {
      body = <p className="text-xs text-stone-500">Dyert e krahut ndahen automatikisht sipas gjatësisë; lloji, doreza dhe materiali janë si te dollapi kryesor.</p>;
    } else if (config.doorLayout === 'perColumn' && ci != null) {
      const d = columnDoors(config.columns[ci], ci, config.columns.length, layout.interior.columnWidths[ci]);
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
  } else if (wing || selection.part.category === 'filler') {
    title = wing ? 'Krahu i këndit' : selection.part.name;
    body = (
      <Field label="Gjatësia e krahut">
        <LengthInput mm={config.corner.length} unit={unit} min={500} max={4000} onChange={(length) => c.patchCorner({ length })} />
      </Field>
    );
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
    <div className="pointer-events-auto w-80 max-w-[calc(100vw-24px)] space-y-2.5 rounded-xl border border-blue-200 bg-white/95 p-3 shadow-lg backdrop-blur">
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
      {selection.kind === 'door' && (
        <div className="space-y-1 border-t border-stone-100 pt-2">
          <div className="text-[11px] font-medium text-stone-600">Dizajni i kësaj dere</div>
          <DoorStylePicker c={c} doorId={selection.part.id} />
        </div>
      )}
    </div>
  );
}
