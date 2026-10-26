import { MATERIALS, materialById } from '../domain/catalog';
import type { Finish } from '../domain/types';
import type { Configurator } from '../state/useConfigurator';
import { Field, Section, Slider } from './ui';

export function FinishPanel({ c }: { c: Configurator }) {
  const { config, patch } = c;
  return (
    <>
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
      {finish.color !== current.defaultColor && (
        <button className="text-[11px] text-accent-600 hover:underline" onClick={() => onChange({ ...finish, color: current.defaultColor, gloss: current.defaultGloss })}>
          Rikthe vlerat e {current.name}
        </button>
      )}
    </Section>
  );
}
