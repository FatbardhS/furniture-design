import { FRONT_STYLE_LABELS } from './catalog';
import type { Bom } from './bom';
import type { PricingConfig } from './types';

export interface CostLine {
  label: string;
  detail: string;
  amount: number;
}

export interface Quote {
  materialLines: CostLine[];
  materialSubtotal: number;
  hardwareSubtotal: number;
  laborSubtotal: number;
  laborDetail: string;
  installation: number;
  net: number;
  vat: number;
  grandTotal: number;
}

const money = (v: number) => Math.round(v * 100) / 100;

export function boardPrice(pricing: PricingConfig, priceKey: string): number {
  return priceKey === 'back' ? pricing.backPanelPerM2 : (pricing.boardPrices[priceKey] ?? 0);
}

export function computeQuote(bom: Bom, pricing: PricingConfig): Quote {
  const materialLines: CostLine[] = bom.boards.map((b) => {
    const unit = boardPrice(pricing, b.priceKey);
    return {
      label: b.label,
      detail: `${b.grossArea.toFixed(2)} m² × ${unit.toFixed(2)} (me ${pricing.wastePercent}% humbje)`,
      amount: money(b.grossArea * unit),
    };
  });
  materialLines.push({
    label: 'Kanti',
    detail: `${bom.edgeBandingM.toFixed(2)} m × ${pricing.edgeBandingPerM.toFixed(2)}`,
    amount: money(bom.edgeBandingM * pricing.edgeBandingPerM),
  });

  // One line per design in use, since single doors can differ (e.g. one mirror door).
  for (const [style, area] of Object.entries(bom.styledFronts ?? {}) as [keyof typeof FRONT_STYLE_LABELS, number][]) {
    const styleRate = pricing.frontStylePerM2?.[style] ?? 0;
    if (styleRate <= 0 || area <= 0) continue;
    materialLines.push({
      label: `Dizajni i fronteve — ${FRONT_STYLE_LABELS[style]}`,
      detail: `${area.toFixed(2)} m² × ${styleRate.toFixed(2)}`,
      amount: money(area * styleRate),
    });
  }

  // Room mirrors are priced like mirror door fronts.
  const mirrorRate = pricing.frontStylePerM2?.mirror ?? 0;
  if (bom.mirrorArea > 0) {
    materialLines.push({
      label: 'Pasqyrat (komodë / mur)',
      detail: `${bom.mirrorArea.toFixed(2)} m² × ${mirrorRate.toFixed(2)}`,
      amount: money(bom.mirrorArea * mirrorRate),
    });
  }

  if (bom.upholsteryArea > 0) {
    const rate = pricing.upholsteryPerM2 ?? 0;
    materialLines.push({
      label: 'Tapiceria e kokës së shtratit',
      detail: `${bom.upholsteryArea.toFixed(2)} m² × ${rate.toFixed(2)}`,
      amount: money(bom.upholsteryArea * rate),
    });
  }

  const materialSubtotal = money(materialLines.reduce((s, l) => s + l.amount, 0));
  const hardwareSubtotal = money(bom.hardware.reduce((s, h) => s + h.total, 0));

  let laborSubtotal: number;
  let laborDetail: string;
  switch (pricing.laborMode) {
    case 'percent':
      laborSubtotal = ((materialSubtotal + hardwareSubtotal) * pricing.laborValue) / 100;
      laborDetail = `${pricing.laborValue}% e materialit + okovëve`;
      break;
    case 'perM2':
      laborSubtotal = bom.totalBoardArea * pricing.laborValue;
      laborDetail = `${bom.totalBoardArea.toFixed(2)} m² × ${pricing.laborValue.toFixed(2)}`;
      break;
    case 'fixed':
      laborSubtotal = pricing.laborValue;
      laborDetail = 'Çmim fiks për projektin';
      break;
  }
  laborSubtotal = money(laborSubtotal);

  const installation = money(pricing.installationFee);
  const net = money(materialSubtotal + hardwareSubtotal + laborSubtotal + installation);
  const vat = money((net * pricing.vatPercent) / 100);
  return {
    materialLines,
    materialSubtotal,
    hardwareSubtotal,
    laborSubtotal,
    laborDetail,
    installation,
    net,
    vat,
    grandTotal: money(net + vat),
  };
}

/** Kosovo / EU style: 1.234,56 € */
export const formatMoney = (v: number, currency: string) =>
  `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
