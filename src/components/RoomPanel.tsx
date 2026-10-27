import { bedSpec, CUSHION_LABELS, FABRICS, HEADBOARD_DESIGN_LABELS, MIRROR_LABELS, PIECE_STYLE_LABELS, ROOM_LABELS, type RoomPreset } from '../domain/room';
import { fmtLen } from '../domain/units';
import type { ActiveFocus, BedItem, CushionStyle, DresserItem, HeadboardDesign, MirrorItem, MirrorShape, PieceStyle, RoomItem } from '../domain/types';
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

/** Dresser body: size, drawers, front design and base. */
export function DresserBodyFields({ it, c }: { it: DresserItem; c: Configurator }) {
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
      <Field label="Dizajni i balleve">
        <Segmented<PieceStyle>
          value={it.frontStyle ?? 'flat'}
          options={(Object.keys(PIECE_STYLE_LABELS) as PieceStyle[]).map((s) => ({ value: s, label: PIECE_STYLE_LABELS[s] }))}
          onChange={(frontStyle) => set({ frontStyle })}
        />
      </Field>
      <Field label="Baza">
        <Segmented<'plinth' | 'legs'>
          value={it.base ?? 'plinth'}
          options={[
            { value: 'plinth', label: 'Sokël' },
            { value: 'legs', label: 'Këmbë' },
          ]}
          onChange={(base) => set({ base })}
        />
      </Field>
    </>
  );
}

/** The mirror hung above a dresser. */
export function DresserMirrorFields({ it, c }: { it: DresserItem; c: Configurator }) {
  const { updateExtra, unit } = c;
  const set = (p: Partial<DresserItem>) => updateExtra(it.id, p);
  return (
    <>
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

function DresserFields({ it, c }: { it: DresserItem; c: Configurator }) {
  return (
    <>
      <DresserBodyFields it={it} c={c} />
      <DresserMirrorFields it={it} c={c} />
    </>
  );
}

export function MirrorFields({ it, c }: { it: MirrorItem; c: Configurator }) {
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

const SubTitle = ({ children }: { children: string }) => <div className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{children}</div>;

/** Headboard: height, width past the frame, design and upholstered cushions. */
export function BedHeadFields({ it, c }: { it: BedItem; c: Configurator }) {
  const { updateExtra, unit } = c;
  const b = bedSpec(it);
  const set = (p: Partial<BedItem>) => updateExtra(it.id, p);
  return (
    <>
      <Field label="Lartësia e kokës" hint="nga dyshemeja">
        <div className="space-y-1.5">
          <Segmented
            value={[700, 1000, 1300, 1600].includes(b.headboardHeight) ? b.headboardHeight : -1}
            options={[
              { value: 700, label: 'E ulët' },
              { value: 1000, label: 'Mesatare' },
              { value: 1300, label: 'E lartë' },
              { value: 1600, label: 'Deri lart' },
            ]}
            onChange={(headboardHeight) => set({ headboardHeight })}
          />
          <LengthInput mm={b.headboardHeight} unit={unit} min={b.frameHeight} max={2400} onChange={(headboardHeight) => set({ headboardHeight })} />
        </div>
      </Field>
      <Field label="Zgjatja anash (për çdo anë)" hint="p.sh. pas komodinave">
        <LengthInput mm={b.headboardExtra} unit={unit} min={0} max={1200} onChange={(headboardExtra) => set({ headboardExtra })} />
      </Field>
      <Field label="Dizajni i kokës">
        <Segmented<HeadboardDesign>
          value={b.headboardDesign}
          options={(Object.keys(HEADBOARD_DESIGN_LABELS) as HeadboardDesign[]).map((d) => ({ value: d, label: HEADBOARD_DESIGN_LABELS[d] }))}
          onChange={(headboardDesign) => set({ headboardDesign })}
        />
      </Field>
      <Field label="Jastëkë të tapicuar">
        <Segmented<CushionStyle>
          value={b.cushions}
          options={(Object.keys(CUSHION_LABELS) as CushionStyle[]).map((s) => ({ value: s, label: CUSHION_LABELS[s] }))}
          onChange={(cushions) => set({ cushions })}
        />
      </Field>
      {b.cushions !== 'none' && (
        <Field label="Pëlhura">
          <div className="flex flex-wrap items-center gap-1.5">
            {FABRICS.map((f) => (
              <button
                key={f.hex}
                type="button"
                title={f.name}
                onClick={() => set({ fabric: f.hex })}
                className={`h-6 w-6 rounded-full border ${b.fabric === f.hex ? 'ring-2 ring-accent-500 ring-offset-1' : 'border-stone-300'}`}
                style={{ background: f.hex }}
              />
            ))}
            <input type="color" className="h-6 w-8 cursor-pointer rounded border border-stone-300" value={b.fabric} onChange={(e) => set({ fabric: e.target.value })} title="Ngjyrë tjetër" />
          </div>
        </Field>
      )}
    </>
  );
}

/** Frame: rail height, box or legs, and which finish the frame and headboard take. */
export function BedFrameFields({ it, c }: { it: BedItem; c: Configurator }) {
  const { updateExtra, unit } = c;
  const b = bedSpec(it);
  const set = (p: Partial<BedItem>) => updateExtra(it.id, p);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Lartësia e kornizës">
          <LengthInput mm={b.frameHeight} unit={unit} min={200} max={500} onChange={(frameHeight) => set({ frameHeight })} />
        </Field>
        <Field label="Baza">
          <Segmented<'box' | 'legs'>
            value={b.base}
            options={[
              { value: 'box', label: 'Deri në tokë' },
              { value: 'legs', label: 'Me këmbë' },
            ]}
            onChange={(base) => set({ base })}
          />
        </Field>
      </div>
      <Field label="Materiali i kornizës & kokës">
        <Segmented<'front' | 'carcass'>
          value={b.finish}
          options={[
            { value: 'front', label: 'Si frontet' },
            { value: 'carcass', label: 'Si korpusi' },
          ]}
          onChange={(finish) => set({ finish })}
        />
      </Field>
    </>
  );
}

export function BedMattressFields({ it, c }: { it: BedItem; c: Configurator }) {
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
    </>
  );
}

function BedFields({ it, c }: { it: BedItem; c: Configurator }) {
  return (
    <>
      <SubTitle>Koka e shtratit</SubTitle>
      <BedHeadFields it={it} c={c} />
      <SubTitle>Korniza</SubTitle>
      <BedFrameFields it={it} c={c} />
      <SubTitle>Dysheku</SubTitle>
      <BedMattressFields it={it} c={c} />
      <p className="text-[11px] text-stone-500">Korniza, koka dhe tapiceria llogariten në ofertë; dysheku nuk përfshihet. Klikoni një pjesë në 3D për ta ndryshuar veçmas.</p>
    </>
  );
}
