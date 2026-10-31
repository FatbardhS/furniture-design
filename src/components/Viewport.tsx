import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ActiveFocus, CabinetConfig, Layout, Unit, Warning } from '../domain/types';
import { CabinetRenderer, type ViewState } from '../three/CabinetRenderer';
import { Icon } from './icons';
import { Button, Toggle } from './ui';

export function Viewport({
  layout,
  config,
  unit,
  rendererRef,
  activeMessage,
  focus,
  onSelectWarning,
  selectionIds,
  onPick,
  onMoveExtra,
  onMoveWardrobe,
}: {
  layout: Layout;
  config: CabinetConfig;
  unit: Unit;
  rendererRef: RefObject<CabinetRenderer | null>;
  activeMessage?: string;
  focus: ActiveFocus | null;
  onSelectWarning: (w: Warning) => void;
  /** Parts of the thing the user clicked, shown in blue. */
  selectionIds: string[];
  onPick: (partId: string | null) => void;
  /** A room item was dragged to a new spot on the floor (mm). */
  onMoveExtra: (id: string, x: number, z: number) => void;
  /** The selected wardrobe was dragged along the back wall: its new distance from the left wall (mm). */
  onMoveWardrobe: (wardrobeX: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>({ doorsOpen: false, drawersOpen: false, showFronts: true, showDimensions: true });
  const [showWarnings, setShowWarnings] = useState(true);

  useEffect(() => {
    const r = new CabinetRenderer(host.current!);
    rendererRef.current = r;
    return () => {
      r.dispose();
      rendererRef.current = null;
    };
  }, [rendererRef]);

  useEffect(() => {
    rendererRef.current?.update(layout, config, unit);
  }, [layout, config, unit, rendererRef]);

  useEffect(() => {
    rendererRef.current?.setView(view);
  }, [view, rendererRef]);

  const highlightKey = focus?.partIds?.join('|') ?? '';
  useEffect(() => {
    rendererRef.current?.setHighlight(highlightKey ? highlightKey.split('|') : []);
  }, [highlightKey, layout, rendererRef]);

  useEffect(() => {
    const r = rendererRef.current;
    if (r) {
      r.onPick = onPick;
      r.onMoveExtra = onMoveExtra;
      r.onMoveWardrobe = onMoveWardrobe;
    }
  }, [onPick, onMoveExtra, onMoveWardrobe, rendererRef]);

  const selectionKey = selectionIds.join('|');
  useEffect(() => {
    rendererRef.current?.setSelection(selectionKey ? selectionKey.split('|') : []);
  }, [selectionKey, layout, rendererRef]);

  // On each new warning click, make the highlighted parts visible: hide doors for interior
  // problems, show (closed) doors for door problems. A 3D pick is already visible, so leave it.
  useEffect(() => {
    if (!focus || focus.tone !== 'warning') return;
    if (focus.tab === 'interior') setView((v) => ({ ...v, showFronts: false }));
    if (focus.tab === 'doors') setView((v) => ({ ...v, showFronts: true, doorsOpen: false }));
  }, [focus?.nonce]);

  const set = (p: Partial<ViewState>) => setView((v) => ({ ...v, ...p }));
  const hasDoors = config.doorType !== 'none';
  const hasDrawers = layout.parts.some((p) => p.category === 'drawerFront');
  const problems = layout.warnings;
  const errors = problems.filter((w) => w.level === 'error').length;

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#ffffff_0%,#efedea_55%,#e2dfdb_100%)]">
      <div ref={host} className="absolute inset-0" />

      <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-1.5">
        <Toggle
          label={hasDoors ? (view.doorsOpen ? 'Mbyll dyert' : 'Hap dyert') : 'Pa dyer'}
          icon={<Icon name="door" />}
          checked={view.doorsOpen}
          // Closing the doors puts the drawers back first; the doors follow once they're in.
          onChange={(v) => hasDoors && set(v ? { doorsOpen: true } : { doorsOpen: false, drawersOpen: false })}
        />
        <Toggle
          label={view.drawersOpen ? 'Mbyll sirtarët' : 'Hap sirtarët'}
          icon={<Icon name="drawer" />}
          checked={view.drawersOpen}
          onChange={(v) => hasDrawers && set({ drawersOpen: v })}
        />
        <Toggle label="Fshih dyert" icon={<Icon name="eye" />} checked={!view.showFronts} onChange={(v) => set({ showFronts: !v })} />
        <Toggle label="Përmasat" icon={<Icon name="ruler" />} checked={view.showDimensions} onChange={(v) => set({ showDimensions: v })} />
        <Button variant="secondary" className="ml-auto bg-white/90" onClick={() => rendererRef.current?.resetCamera()} title="Rikthe kamerën">
          <Icon name="reset" /> Rikthe pamjen
        </Button>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 hidden text-[11px] text-stone-500 sm:block">
        Tërhiq një mobilje për ta lëvizur · Zgjidh dollapin dhe tërhiqe përgjatë murit · Kliko për ta vënë në qendër · Klik i dyfishtë për t’u afruar · Tërhiq për ta rrotulluar · Klik i djathtë për ta zhvendosur · Rrota për zmadhim
      </div>

      {problems.length > 0 && (
        <div className="absolute bottom-3 left-3 max-w-[min(420px,calc(100%-24px))]">
          <button
            onClick={() => setShowWarnings((s) => !s)}
            className={`flex items-center gap-1.5 rounded-t-lg px-2.5 py-1.5 text-xs font-semibold ${
              errors ? 'bg-red-600 text-white' : 'bg-amber-400 text-amber-950'
            } ${showWarnings ? '' : 'rounded-b-lg'}`}
          >
            <Icon name="alert" className="h-3.5 w-3.5" />
            {problems.length} vërejtje për kontroll
          </button>
          {showWarnings && (
            <div className="max-h-48 overflow-auto rounded-b-lg rounded-tr-lg border border-stone-200 bg-white/95 p-1.5 text-xs shadow-sm scrollbar-thin">
              <p className="px-1.5 pb-1 pt-0.5 text-[11px] text-stone-500">Kliko një vërejtje për të parë ku duhet rregulluar.</p>
              <ul className="space-y-0.5">
                {problems.map((w, i) => {
                  const active = w.message === activeMessage;
                  return (
                    <li key={i}>
                      <button
                        onClick={() => onSelectWarning(w)}
                        className={`flex w-full gap-1.5 rounded-md px-1.5 py-1 text-left transition ${
                          active ? 'bg-red-50 font-medium text-red-800 ring-1 ring-red-300' : 'hover:bg-stone-100'
                        }`}
                      >
                        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${w.level === 'error' ? 'bg-red-500' : w.level === 'warn' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                        <span className="flex-1">{w.message}</span>
                        <span className="shrink-0 self-center text-[10px] text-stone-400">{active ? 'Fshih' : 'Shiko →'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
