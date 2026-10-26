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
      detail: `${b.grossArea.toFixed(2)} m² × ${unit.toFixed(2)} (incl. ${pricing.wastePercent}% waste)`,
      amount: money(b.grossArea * unit),
    };
  });
  materialLines.push({
    label: 'Edge banding',
    detail: `${bom.edgeBandingM.toFixed(2)} m × ${pricing.edgeBandingPerM.toFixed(2)}`,
    amount: money(bom.edgeBandingM * pricing.edgeBandingPerM),
  });

  const materialSubtotal = money(materialLines.reduce((s, l) => s + l.amount, 0));
  const hardwareSubtotal = money(bom.hardware.reduce((s, h) => s + h.total, 0));

  let laborSubtotal: number;
  let laborDetail: string;
  switch (pricing.laborMode) {
    case 'percent':
      laborSubtotal = ((materialSubtotal + hardwareSubtotal) * pricing.laborValue) / 100;
      laborDetail = `${pricing.laborValue}% of materials + hardware`;
      break;
    case 'perM2':
      laborSubtotal = bom.totalBoardArea * pricing.laborValue;
      laborDetail = `${bom.totalBoardArea.toFixed(2)} m² × ${pricing.laborValue.toFixed(2)}`;
      break;
    case 'fixed':
      laborSubtotal = pricing.laborValue;
      laborDetail = 'Fixed project fee';
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

export const formatMoney = (v: number, currency: string) =>
  `${currency}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
