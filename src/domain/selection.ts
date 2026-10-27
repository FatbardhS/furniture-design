import { itemPartIds, WING_PREFIX } from './layout';
import { roomGroup, roomPiece, roomPrefix, type RoomPiece } from './room';
import type { CabinetConfig, InteriorItem, Layout, Part, RoomItem, WarningFocus } from './types';

/** What a click in the 3D view picked, resolved against the current configuration. */
export type Selection =
  | { kind: 'item'; column: number; item: InteriorItem; partIds: string[]; wing?: boolean }
  | { kind: 'door'; part: Part; column?: number; partIds: string[]; wing?: boolean }
  | { kind: 'carcass'; part: Part; partIds: string[]; wing?: boolean }
  | { kind: 'extra'; extra: RoomItem; piece: RoomPiece; partIds: string[] };

/**
 * Map a picked part / fixture id back to the thing the user edits. A drawer is one selection
 * even though it is six parts, so all of them light up together. Returns null if the part no
 * longer exists (e.g. it was just deleted).
 */
export function describePart(partId: string, cfg: CabinetConfig, layout: Layout): Selection | null {
  // Room items select as a whole.
  const extra = cfg.extras?.find((x) => partId.startsWith(roomGroup(x.id) + ':'));
  if (extra) {
    // A bed or dresser is edited piece by piece: the headboard, the frame, the mirror…
    const g = roomGroup(extra.id);
    const pre = roomPrefix(extra.id);
    const raw = roomPiece(partId.slice(pre.length));
    // A dresser is one piece apart from its mirror.
    const piece = extra.kind === 'dresser' && raw !== 'mirror' ? 'body' : raw;
    const all = [...layout.parts.filter((p) => p.group === g).map((p) => p.id), ...layout.fixtures.filter((f) => f.group === g).map((f) => f.id)];
    const ids = piece === 'body' ? all : all.filter((id) => roomPiece(id.slice(pre.length)) === piece);
    return { kind: 'extra', extra, piece, partIds: ids };
  }

  const wing = partId.startsWith(WING_PREFIX);
  const local = wing ? partId.slice(WING_PREFIX.length) : partId;
  const pre = (ids: string[]) => (wing ? ids.map((id) => WING_PREFIX + id) : ids);
  const columns = wing ? cfg.corner.columns : cfg.columns;
  for (const [ci, col] of columns.entries()) {
    for (const item of col.items) {
      const ids = itemPartIds(item);
      if (ids.includes(local)) return { kind: 'item', column: ci, item, partIds: pre(ids), wing };
    }
  }
  const part = layout.parts.find((p) => p.id === partId);
  if (!part) return null;
  if (part.category === 'door') return { kind: 'door', part, column: part.column, partIds: [part.id], wing };
  return { kind: 'carcass', part, partIds: [part.id], wing };
}

/** Where in the side panel the selected thing is edited. */
export function selectionFocus(sel: Selection, cfg: CabinetConfig): WarningFocus {
  if (sel.kind === 'extra') return { tab: 'room', extraId: sel.extra.id };
  if (sel.kind === 'item') return { tab: 'interior', column: sel.column, itemIds: [sel.item.id], ...(sel.wing ? { wing: true } : {}) };
  if (sel.kind === 'door') {
    if (sel.wing) return { tab: 'doors', field: 'doorCount' };
    return cfg.doorLayout === 'perColumn' && sel.column != null ? { tab: 'doors', column: sel.column } : { tab: 'doors', field: 'doorCount' };
  }
  if (sel.wing || sel.part.category === 'filler') return { tab: 'size', field: 'corner' };
  const field = sel.part.category === 'plinth' ? 'plinth' : sel.part.category === 'divider' ? 'sections' : undefined;
  return { tab: 'size', field };
}
