import { useState } from 'react';
import { COLOR_PALETTE, FRONT_STYLE_LABELS, MATERIALS, materialById } from '../domain/catalog';
import type { Finish, FrontStyle } from '../domain/types';
import type { Configurator } from '../state/useConfigurator';
import { Field, Section, Slider } from './ui';

/** Tiny front elevation of each door design for the picker. */
function StylePreview({ style }: { style: FrontStyle }) {
  const fill = '#e7d3b8';
  return (
    <svg viewBox="0 0 40 56" className="h-12 w-9" aria-hidden>
      <rect x="1" y="1" width="38" height="54" rx="1.5" fill={style === 'glass' ? '#cfe2e8' : fill} stroke="#9c8366" strokeWidth="1.2" />
      {style === 'shaker' && <rect x="7" y="7" width="26" height="42" fill="none" stroke="#9c8366" strokeWidth="1.2" />}
      {style === 'fluted' && [8, 14, 20, 26, 32].map((x) => <line key={x} x1={x} x2={x} y1="4" y2="52" stroke="#b39673" strokeWidth="2" />)}
      {style === 'glass' && <rect x="1" y="1" width="38" height="54" rx="1.5" fill="none" stroke={fill} strokeWidth="9" />}
      {style === 'mirror' && <rect x="5" y="5" width="30" height="46" fill="url(#mirror)" />}
      <defs>
        <linearGradient id="mirror" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f8fa" />
          <stop offset="0.5" stopColor="#bfcbd1" />
          <stop offset="1" stopColor="#eef3f5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function FinishPanel({ c }: { c: Configurator }) {
  const { config, patch } = c;
  return (
    <>
      <Section title="Dizajni i dyerve">
        <div className="grid grid-cols-5 gap-1.5">
          {(Object.keys(FRONT_STYLE_LABELS) as FrontStyle[]).map((s) => (
            <button
              key={s}
              onClick={() => patch({ frontStyle: s })}
              className={`flex flex-col items-center gap-1 rounded-lg border p-1 text-[10px] leading-tight transition ${
                s === config.frontStyle ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'
              }`}
            >
              <StylePreview style={s} />
              {FRONT_STYLE_LABELS[s]}
            </button>
          ))}
        </div>
        {(config.frontStyle === 'glass' || config.frontStyle === 'mirror') && (
          <p className="text-[11px] text-stone-500">Xhami dhe pasqyra vendosen vetëm në dyer; ballet e sirtarëve mbeten të lëmuara.</p>
        )}
      </Section>
      <PerDoorStyles c={c} />
      <FinishEditor title="Frontet (dyert & ballet e sirtarëve)" finish={config.frontFinish} onChange={(frontFinish) => patch({ frontFinish })} />
      <FinishEditor title="Korpusi & brendësia" finish={config.carcassFinish} onChange={(carcassFinish) => patch({ carcassFinish })} />
    </>
  );
}

function FinishEditor({ title, finish, onChange }: { title: string; finish: Finish; onChange: (f: Finish) => void }) {
  const current = materialById(finish.materialId);
  return (
    <Section title={title}>
      <div className="grid grid-cols-3 gap-1.5">
        {MATERIALS.map((m) => (
          <button
            key={m.id}
            title={m.name}
            onClick={() => onChange({ materialId: m.id, color: m.defaultColor, gloss: m.defaultGloss })}
            className={`group flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] leading-tight transition ${
              m.id === finish.materialId ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'
            }`}
          >
            <span
              className="h-7 w-full rounded"
              style={{
                background:
                  m.kind === 'wood'
                    ? `repeating-linear-gradient(90deg, ${m.defaultColor} 0 5px, color-mix(in srgb, ${m.defaultColor} 82%, black) 5px 6px, ${m.defaultColor} 6px 11px)`
                    : m.defaultGloss > 0.6
                      ? `linear-gradient(135deg, #fff 0%, ${m.defaultColor} 45%, ${m.defaultColor} 100%)`
                      : m.defaultColor,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
              }}
            />
            <span className="line-clamp-2 text-center">{m.name}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[auto_1fr] items-end gap-3">
        <Field label="Ngjyra / bajca">
          <input
            type="color"
            value={finish.color}
            onChange={(e) => onChange({ ...finish, color: e.target.value })}
            className="h-8 w-14 cursor-pointer rounded-md border border-stone-300 bg-white p-0.5"
          />
        </Field>
        <Field label="Shkëlqimi" hint={finish.gloss < 0.25 ? 'Mat' : finish.gloss < 0.6 ? 'Satin' : 'Shkëlqim i lartë'}>
          <Slider value={finish.gloss} min={0} max={1} step={0.01} onChange={(gloss) => onChange({ ...finish, gloss })} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Ngjyra të shpejta">
        {COLOR_PALETTE.map((p) => (
          <button
            key={p.hex}
            title={p.name}
            onClick={() => onChange({ ...finish, color: p.hex })}
            className={`h-6 w-6 rounded-full transition hover:scale-110 ${finish.color.toLowerCase() === p.hex ? 'ring-2 ring-accent-500 ring-offset-1' : ''}`}
            style={{ background: p.hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' }}
          />
        ))}
      </div>
      {finish.color !== current.defaultColor && (
        <button className="text-[11px] text-accent-600 hover:underline" onClick={() => onChange({ ...finish, color: current.defaultColor, gloss: current.defaultGloss })}>
          Rikthe vlerat e {current.name}
        </button>
      )}
    </Section>
  );
}

/** Design picker for one door: "Si të tjerat" follows the wardrobe-wide design. */
export function DoorStylePicker({ c, doorId }: { c: Configurator; doorId: string }) {
  const { config, patch } = c;
  const own = config.doorStyles?.[doorId];
  const set = (s: FrontStyle | null) => {
    const next = { ...config.doorStyles };
    if (s == null || s === config.frontStyle) delete next[doorId];
    else next[doorId] = s;
    patch({ doorStyles: next });
  };
  return (
    <div className="grid grid-cols-6 gap-1">
      <button
        onClick={() => set(null)}
        className={`rounded-md border px-1 py-1 text-[10px] leading-tight ${!own ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}
        title="Si dyert e tjera"
      >
        Si të tjerat
      </button>
      {(Object.keys(FRONT_STYLE_LABELS) as FrontStyle[]).map((s) => (
        <button
          key={s}
          onClick={() => set(s)}
          title={FRONT_STYLE_LABELS[s]}
          className={`flex flex-col items-center rounded-md border p-0.5 text-[9px] leading-tight ${own === s ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}
        >
          <StylePreview style={s} />
          {FRONT_STYLE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

/** Give single doors their own design — e.g. one mirror or glass door among wooden ones. */
function PerDoorStyles({ c }: { c: Configurator }) {
  const { config, layout, patch } = c;
  const doors = layout.parts.filter((p) => p.category === 'door').sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.position[0] - b.position[0]);
  const [picked, setPicked] = useState<string | null>(null);
  if (!doors.length) return null;
  const current = doors.find((d) => d.id === picked) ? picked : null;
  const overrides = Object.keys(config.doorStyles ?? {}).filter((id) => doors.some((d) => d.id === id)).length;
  return (
    <Section
      title="Dizajn për derë të veçantë"
      action={
        overrides > 0 && (
          <button className="text-[11px] text-stone-500 hover:text-red-600" onClick={() => patch({ doorStyles: {} })}>
            Hiqi të gjitha ({overrides})
          </button>
        )
      }
    >
      <p className="text-xs text-stone-500">Zgjidhni një derë (ose klikojeni në 3D), pastaj dizajnin e saj — p.sh. vetëm një derë me pasqyrë ose xham.</p>
      <div className="flex flex-wrap gap-1.5">
        {doors.map((d, i) => {
          const own = config.doorStyles?.[d.id];
          return (
            <button
              key={d.id}
              onClick={() => setPicked(d.id === current ? null : d.id)}
              className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
                d.id === current ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'
              }`}
            >
              {d.group === 'wing' ? 'K' : ''}
              {i + 1}
              {own && <span className="ml-1 font-normal text-accent-600">· {FRONT_STYLE_LABELS[own]}</span>}
            </button>
          );
        })}
      </div>
      {current && <DoorStylePicker c={c} doorId={current} />}
    </Section>
  );
}
