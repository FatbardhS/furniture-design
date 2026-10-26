import { itemPartIds } from './layout';
import type { CabinetConfig, InteriorItem, Layout, Part, WarningFocus } from './types';

/** What a click in the 3D view picked, resolved against the current configuration. */
export type Selection =
  | { kind: 'item'; column: number; item: InteriorItem; partIds: string[] }
  | { kind: 'door'; part: Part; column?: number; partIds: string[] }
  | { kind: 'carcass'; part: Part; partIds: string[] };

/**
 * Map a picked part / fixture id back to the thing the user edits. A drawer is one selection
 * even though it is six parts, so all of them light up together. Returns null if the part no
 * longer exists (e.g. it was just deleted).
 */
export function describePart(partId: string, cfg: CabinetConfig, layout: Layout): Selection | null {
  for (const [ci, col] of cfg.columns.entries()) {
    for (const item of col.items) {
      const ids = itemPartIds(item);
      if (ids.includes(partId)) return { kind: 'item', column: ci, item, partIds: ids };
    }
  }
  const part = layout.parts.find((p) => p.id === partId);
  if (!part) return null;
  if (part.category === 'door') return { kind: 'door', part, column: part.column, partIds: [part.id] };
  return { kind: 'carcass', part, partIds: [part.id] };
}

/** Where in the side panel the selected thing is edited. */
export function selectionFocus(sel: Selection, cfg: CabinetConfig): WarningFocus {
  if (sel.kind === 'item') return { tab: 'interior', column: sel.column, itemIds: [sel.item.id] };
  if (sel.kind === 'door') {
    return cfg.doorLayout === 'perColumn' && sel.column != null ? { tab: 'doors', column: sel.column } : { tab: 'doors', field: 'doorCount' };
  }
  const field = sel.part.category === 'plinth' ? 'plinth' : sel.part.category === 'divider' ? 'sections' : undefined;
  return { tab: 'size', field };
}
