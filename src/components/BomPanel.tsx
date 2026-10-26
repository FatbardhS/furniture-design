import { UNIT_LABELS } from '../domain/catalog';
import { toUnit } from '../domain/units';
import type { Configurator } from '../state/useConfigurator';
import { Section } from './ui';

const th = 'px-1.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-500';
const td = 'px-1.5 py-1.5 tabular-nums';

export function BomPanel({ c }: { c: Configurator }) {
  const { bom } = c;
  return (
    <>
      <Section title="Pllakat">
        <table className="w-full text-xs">
          <thead className="border-b border-stone-200">
            <tr>
              <th className={th}>Materiali</th>
              <th className={`${th} text-right`}>Neto m²</th>
              <th className={`${th} text-right`}>+Humbje</th>
              <th className={`${th} text-right`}>Pllaka</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {bom.boards.map((b) => (
              <tr key={b.material}>
                <td className={td}>
                  {b.label}
                  <div className="text-[11px] text-stone-400">{b.parts} pjesë</div>
                </td>
                <td className={`${td} text-right`}>{b.netArea.toFixed(3)}</td>
                <td className={`${td} text-right`}>{b.grossArea.toFixed(3)}</td>
                <td className={`${td} text-right`}>{b.sheets}</td>
              </tr>
            ))}
            <tr>
              <td className={td}>Kanti (shirit)</td>
              <td className={`${td} text-right`} colSpan={3}>
                {bom.edgeBandingM.toFixed(2)} m
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Okovët">
        {bom.hardware.length === 0 ? (
          <p className="text-xs text-stone-500">Nuk nevojiten okovë për këtë konfigurim.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-stone-200">
              <tr>
                <th className={th}>Artikulli</th>
                <th className={`${th} text-right`}>Sasia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {bom.hardware.map((h) => (
                <tr key={h.id}>
                  <td className={td}>{h.name}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {h.qty} {UNIT_LABELS[h.unit]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

export function CutListPanel({ c }: { c: Configurator }) {
  const { bom, unit } = c;
  const len = (mm: number) => +toUnit(mm, unit).toFixed(1);
  return (
    <Section title={`Lista e prerjeve · ${unit}`}>
      <p className="text-[11px] text-stone-500">
        Gjatësia shkon sipas drejtimit të fladrës. Kanti: anët e gjata / të shkurtra me kant (p.sh. 1/0 = një anë e gjatë).
      </p>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-stone-200">
            <tr>
              <th className={th}>Pjesa</th>
              <th className={`${th} text-right`}>Gjat.</th>
              <th className={`${th} text-right`}>Gjer.</th>
              <th className={`${th} text-right`}>Trash.</th>
              <th className={`${th} text-right`}>Sasia</th>
              <th className={`${th} text-right`}>Kanti</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {bom.cutList.map((r, i) => (
              <tr key={i}>
                <td className={td}>
                  {r.name}
                  <div className="text-[10px] text-stone-400">{r.material}</div>
                </td>
                <td className={`${td} text-right`}>{len(r.length)}</td>
                <td className={`${td} text-right`}>{len(r.width)}</td>
                <td className={`${td} text-right`}>{r.thickness}</td>
                <td className={`${td} text-right font-semibold`}>{r.qty}</td>
                <td className={`${td} text-right text-stone-500`}>
                  {r.bandLong}/{r.bandShort}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
