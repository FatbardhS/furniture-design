import type { Unit } from './types';

export const toUnit = (mm: number, unit: Unit) => (unit === 'cm' ? mm / 10 : mm);
export const fromUnit = (v: number, unit: Unit) => (unit === 'cm' ? v * 10 : v);

/** "1800 mm" / "180 cm" — at most one decimal, no trailing zeros. */
export const fmtLen = (mm: number, unit: Unit) => `${+toUnit(mm, unit).toFixed(1)} ${unit}`;
