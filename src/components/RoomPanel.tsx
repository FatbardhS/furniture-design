import { HEADBOARD_LABELS, MIRROR_LABELS, ROOM_LABELS, type RoomPreset } from '../domain/room';
import { fmtLen } from '../domain/units';
import type { ActiveFocus, BedItem, DresserItem, Headboard, MirrorItem, MirrorShape, RoomItem } from '../domain/types';
import type { Configurator } from '../state/useConfigurator';
import { Icon } from './icons';
import { Button, Field, Flag, LengthInput, NumberInput, Section, Segmented } from './ui';

const PRESETS: { value: RoomPreset; label: string }[] = [
  { value: 'dresser', label: 'Komodë me pasqyrë' },
  { value: 'nightstand', label: 'Komodinë' },
  { value: 'mirror', label: 'Pasqyrë muri' },
  { value: 'bed', label: 'Shtrat' },
];
const MATTRESS_WIDTHS = [900, 1200, 1400, 1600, 1800, 2000];
const MATTRESS_LENGTHS = [1900, 2000, 2100];
const ROTATIONS = [0, 90, 180, 270] as const;
const SHAPES: Exclude<MirrorShape, 'none'>[] = ['rect', 'round', 'oval', 'arch', 'pill'];

/** Small outline of a mirror shape for the shape picker. */
export function ShapeIcon({ shape }: { shape: MirrorShape }) {
  const paths: Record<MirrorShape, string> = {
    none: 'M5 5l14 14M19 5 5 19',
    rect: 'M6 3h12v18H6z',
    round: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
    oval: 'M12 2c3.9 0 6 4.5 6 10s-2.1 10-6 10-6-4.5-6-10 2.1-10 6-10z',
    arch: 'M6 21V9a6 6 0 0 1 12 0v12z',
    pill: 'M6 8a6 6 0 0 1 12 0v8a6 6 0 0 1-12 0z',
  };
  return (
    <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d={paths[shape]} />
    </svg>
  );
}

const itemTitle = (it: RoomItem) => (it.kind === 'dresser' && it.width <= 600 ? 'Komodinë' : ROOM_LABELS[it.kind]);

export function RoomPanel({ c, focus }: { c: Configurator; focus: ActiveFocus | null }) {
  const { config, addExtra, updateExtra, removeExtra, unit } = c;

  return (
    <>
      <Section title="Shto mobilje">
        <p className="text-xs text-stone-500">Plotësoni dhomën e gjumit rreth dollapit. Mobiljet vendosen pranë murit; lëvizini me pozicionin më poshtë.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <Button key={p.value} className="justify-start" onClick={() => addExtra(p.value)}>
              <Icon name="plus" className="h-3.5 w-3.5" /> {p.label}
            </Button>
          ))}
        </div>
      </Section>

      {config.extras.length === 0 && (
        <Section title="Mobiljet">
          <p className="text-xs text-stone-500">Ende nuk keni shtuar asgjë.</p>
        </Section>
      )}

      {config.extras.map((it, i) => (
        <Section
          key={it.id}
          title={`${i + 1}. ${itemTitle(it)}`}
          action={
            <Button variant="danger" onClick={() => removeExtra(it.id)} title="Hiq">
              <Icon name="trash" className="h-3.5 w-3.5" /> Hiq
            </Button>
          }
        >
          <Flag on={focus?.extraId === it.id} nonce={focus?.nonce} tone={focus?.tone} className="space-y-3">
            {it.kind === 'dresser' && <DresserFields it={it} c={c} />}
            {it.kind === 'mirror' && <MirrorFields it={it} c={c} />}
            {it.kind === 'bed' && <BedFields it={it} c={c} />}

            <div className="grid grid-cols-2 gap-2">
              <Field label="Pozicioni majtas/djathtas">
                <LengthInput mm={it.x} unit={unit} min={-15000} max={15000} onChange={(x) => updateExtra(it.id, { x })} />
              </Field>
              <Field label="Pozicioni para/prapa">
                <LengthInput mm={it.z} unit={unit} min={-15000} max={15000} onChange={(z) => updateExtra(it.id, { z })} />
              </Field>
            </div>
            <Field label="Rrotullimi">
              <Segmented
                value={it.rotation}
                options={ROTATIONS.map((r) => ({ value: r, label: `${r}°` }))}
                onChange={(rotation) => updateExtra(it.id, { rotation })}
              />
            </Field>
          </Flag>
        </Section>
      ))}
    </>
  );
}

function DresserFields({ it, c }: { it: DresserItem; c: Configurator }) {
  const { updateExtra, unit } = c;
  const set = (p: Partial<DresserItem>) => updateExtra(it.id, p);
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Gjerësia">
          <LengthInput mm={it.width} unit={unit} min={300} max={2400} onChange={(width) => set({ width })} />
        </Field>
        <Field label="Lartësia">
          <LengthInput mm={it.height} unit={unit} min={300} max={1400} onChange={(height) => set({ height })} />
        </Field>
        <Field label="Thellësia">
          <LengthInput mm={it.depth} unit={unit} min={300} max={700} onChange={(depth) => set({ depth })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Rreshta sirtarësh">
          <NumberInput value={it.rows} min={1} max={8} onChange={(rows) => set({ rows: Math.round(rows) })} />
        </Field>
        <Field label="Sirtarë për rresht">
          <Segmented<1 | 2> value={it.perRow} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} onChange={(perRow) => set({ perRow })} />
        </Field>
      </div>
      <Field label="Pasqyra mbi komodë" hint={it.mirror === 'none' ? '' : MIRROR_LABELS[it.mirror]}>
        <Segmented<MirrorShape>
          value={it.mirror}
          options={(['none', ...SHAPES] as MirrorShape[]).map((s) => ({ value: s, label: <span title={MIRROR_LABELS[s]}><ShapeIcon shape={s} /></span> }))}
          onChange={(mirror) => set({ mirror })}
        />
      </Field>
      {it.mirror !== 'none' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Gjerësia e pasqyrës">
            <LengthInput mm={it.mirrorWidth} unit={unit} min={200} max={2400} onChange={(mirrorWidth) => set({ mirrorWidth })} />
          </Field>
          <Field label="Lartësia e pasqyrës">
            <LengthInput mm={it.mirrorHeight} unit={unit} min={200} max={1800} onChange={(mirrorHeight) => set({ mirrorHeight })} />
          </Field>
        </div>
      )}
    </>
  );
}

function MirrorFields({ it, c }: { it: MirrorItem; c: Configurator }) {
  const { updateExtra, unit } = c;
  const set = (p: Partial<MirrorItem>) => updateExtra(it.id, p);
  return (
    <>
      <Field label="Forma" hint={MIRROR_LABELS[it.shape]}>
        <Segmented<Exclude<MirrorShape, 'none'>>
          value={it.shape}
          options={SHAPES.map((s) => ({ value: s, label: <span title={MIRROR_LABELS[s]}><ShapeIcon shape={s} /></span> }))}
          onChange={(shape) => set({ shape })}
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Gjerësia">
          <LengthInput mm={it.width} unit={unit} min={200} max={2400} onChange={(width) => set({ width })} />
        </Field>
        <Field label="Lartësia">
          <LengthInput mm={it.height} unit={unit} min={200} max={2400} onChange={(height) => set({ height })} />
        </Field>
        <Field label="Nga dyshemeja">
          <LengthInput mm={it.bottom} unit={unit} min={0} max={2000} onChange={(bottom) => set({ bottom })} />
        </Field>
      </div>
    </>
  );
}

function BedFields({ it, c }: { it: BedItem; c: Configurator }) {
  const { updateExtra, unit } = c;
  const set = (p: Partial<BedItem>) => updateExtra(it.id, p);
  return (
    <>
      <Field label="Gjerësia e dyshekut" hint={fmtLen(it.mattressWidth, unit)}>
        <Segmented value={it.mattressWidth} options={MATTRESS_WIDTHS.map((v) => ({ value: v, label: `${v / 10}` }))} onChange={(mattressWidth) => set({ mattressWidth })} />
      </Field>
      <Field label="Gjatësia e dyshekut" hint={fmtLen(it.mattressLength, unit)}>
        <Segmented value={it.mattressLength} options={MATTRESS_LENGTHS.map((v) => ({ value: v, label: `${v / 10}` }))} onChange={(mattressLength) => set({ mattressLength })} />
      </Field>
      <Field label="Koka e shtratit">
        <Segmented<Headboard>
          value={it.headboard}
          options={(Object.keys(HEADBOARD_LABELS) as Headboard[]).map((h) => ({ value: h, label: HEADBOARD_LABELS[h] }))}
          onChange={(headboard) => set({ headboard })}
        />
      </Field>
      <p className="text-[11px] text-stone-500">Korniza e shtratit llogaritet në materiale; dysheku nuk përfshihet në ofertë.</p>
    </>
  );
}
