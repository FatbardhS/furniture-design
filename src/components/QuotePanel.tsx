import { UNIT_LABELS } from '../domain/catalog';
import { formatMoney } from '../domain/pricing';
import type { Configurator } from '../state/useConfigurator';
import { Section, Stat } from './ui';

export function QuotePanel({ c }: { c: Configurator }) {
  const { quote, bom, pricing } = c;
  const m = (v: number) => formatMoney(v, pricing.currency);

  return (
    <>
      <div className="px-4 pt-4">
        <div className="rounded-xl bg-stone-900 p-4 text-white shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wider text-stone-400">Totali përfundimtar</div>
          <div className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight">{m(quote.grandTotal)}</div>
          <div className="mt-1 text-xs text-stone-400">
            {pricing.vatPercent > 0 ? `me ${pricing.vatPercent}% TVSH (${m(quote.vat)})` : 'pa TVSH'}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-xs">
            {[
              ['Materiali', quote.materialSubtotal],
              ['Okovët', quote.hardwareSubtotal],
              ['Puna', quote.laborSubtotal],
            ].map(([label, v]) => (
              <div key={label as string}>
                <div className="text-stone-400">{label}</div>
                <div className="font-semibold tabular-nums">{m(v as number)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Section title="Sasitë kryesore">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Sipërfaqja e pllakave" value={`${bom.totalBoardArea.toFixed(2)} m²`} sub={`${bom.partCount} pjesë`} />
          <Stat label="Kanti" value={`${bom.edgeBandingM.toFixed(1)} m`} sub="shirit kanti" />
          <Stat
            label="Pllaka (2800×2070)"
            value={bom.boards.reduce((s, b) => s + b.sheets, 0)}
            sub={`me ${pricing.wastePercent}% humbje`}
          />
          <Stat label="Okovë" value={bom.hardware.filter((h) => h.unit !== 'm').reduce((s, h) => s + h.qty, 0)} sub="copë / palë / sete" />
        </div>
      </Section>

      <Section title="Ndarja e kostos">
        <table className="w-full text-xs">
          <tbody>
            <GroupRow label="Materiali" total={m(quote.materialSubtotal)} />
            {quote.materialLines.map((l) => (
              <Row key={l.label} label={l.label} detail={l.detail} amount={m(l.amount)} />
            ))}
            <GroupRow label="Okovët" total={m(quote.hardwareSubtotal)} />
            {bom.hardware.map((h) => (
              <Row key={h.id} label={h.name} detail={`${h.qty} ${UNIT_LABELS[h.unit]} × ${h.unitPrice.toFixed(2)}`} amount={m(h.total)} />
            ))}
            {!bom.hardware.length && <Row label="Pa okovë" detail="" amount="—" />}
            <GroupRow label="Puna & shërbimet" total={m(quote.laborSubtotal + quote.installation)} />
            <Row label="Puna e punëtorisë" detail={quote.laborDetail} amount={m(quote.laborSubtotal)} />
            {quote.installation > 0 && <Row label="Montimi & transporti" detail="Çmim fiks" amount={m(quote.installation)} />}
            <tr className="border-t border-stone-300">
              <td className="pt-2 font-semibold">Totali neto</td>
              <td className="pt-2 text-right font-semibold tabular-nums">{m(quote.net)}</td>
            </tr>
            {pricing.vatPercent > 0 && (
              <tr>
                <td className="text-stone-600">TVSH {pricing.vatPercent}%</td>
                <td className="text-right tabular-nums text-stone-600">{m(quote.vat)}</td>
              </tr>
            )}
            <tr>
              <td className="pt-1 text-sm font-bold">Totali përfundimtar</td>
              <td className="pt-1 text-right text-sm font-bold tabular-nums">{m(quote.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </>
  );
}

function GroupRow({ label, total }: { label: string; total: string }) {
  return (
    <tr>
      <td className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{label}</td>
      <td className="pb-1 pt-3 text-right font-semibold tabular-nums text-stone-700">{total}</td>
    </tr>
  );
}

function Row({ label, detail, amount }: { label: string; detail: string; amount: string }) {
  return (
    <tr className="align-top">
      <td className="py-1 pr-2">
        <div className="text-stone-700">{label}</div>
        {detail && <div className="text-[11px] text-stone-400">{detail}</div>}
      </td>
      <td className="py-1 text-right tabular-nums text-stone-700">{amount}</td>
    </tr>
  );
}
