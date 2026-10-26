import { toUnit } from '../domain/units';
import type { Configurator } from '../state/useConfigurator';
import { Section } from './ui';

const th = 'px-1.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-500';
const td = 'px-1.5 py-1.5 tabular-nums';

export function BomPanel({ c }: { c: Configurator }) {
  const { bom } = c;
  return (
    <>
      <Section title="Board material">
        <table className="w-full text-xs">
          <thead className="border-b border-stone-200">
            <tr>
              <th className={th}>Material</th>
              <th className={`${th} text-right`}>Net m²</th>
              <th className={`${th} text-right`}>+Waste</th>
              <th className={`${th} text-right`}>Sheets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {bom.boards.map((b) => (
              <tr key={b.material}>
                <td className={td}>
                  {b.label}
                  <div className="text-[11px] text-stone-400">{b.parts} parts</div>
                </td>
                <td className={`${td} text-right`}>{b.netArea.toFixed(3)}</td>
                <td className={`${td} text-right`}>{b.grossArea.toFixed(3)}</td>
                <td className={`${td} text-right`}>{b.sheets}</td>
              </tr>
            ))}
            <tr>
              <td className={td}>Edge banding (kant)</td>
              <td className={`${td} text-right`} colSpan={3}>
                {bom.edgeBandingM.toFixed(2)} m
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Hardware">
        {bom.hardware.length === 0 ? (
          <p className="text-xs text-stone-500">No hardware needed for this configuration.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-stone-200">
              <tr>
                <th className={th}>Item</th>
                <th className={`${th} text-right`}>Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {bom.hardware.map((h) => (
                <tr key={h.id}>
                  <td className={td}>{h.name}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {h.qty} {h.unit}
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
    <Section title={`Cut list · ${unit}`}>
      <p className="text-[11px] text-stone-500">
        Length runs along the grain. Edge columns: banded long / short edges (e.g. 1/0 = one long edge).
      </p>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-stone-200">
            <tr>
              <th className={th}>Part</th>
              <th className={`${th} text-right`}>L</th>
              <th className={`${th} text-right`}>W</th>
              <th className={`${th} text-right`}>T</th>
              <th className={`${th} text-right`}>Qty</th>
              <th className={`${th} text-right`}>Edge</th>
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
