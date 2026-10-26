import { useEffect, useRef, useState, type RefObject } from 'react';
import type { CabinetConfig, Layout, Unit } from '../domain/types';
import { CabinetRenderer, type ViewState } from '../three/CabinetRenderer';
import { Icon } from './icons';
import { Button, Toggle } from './ui';

export function Viewport({
  layout,
  config,
  unit,
  rendererRef,
}: {
  layout: Layout;
  config: CabinetConfig;
  unit: Unit;
  rendererRef: RefObject<CabinetRenderer | null>;
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
          label={hasDoors ? (view.doorsOpen ? 'Close doors' : 'Open doors') : 'No doors'}
          icon={<Icon name="door" />}
          checked={view.doorsOpen}
          onChange={(v) => hasDoors && set({ doorsOpen: v })}
        />
        <Toggle
          label={view.drawersOpen ? 'Close drawers' : 'Open drawers'}
          icon={<Icon name="drawer" />}
          checked={view.drawersOpen}
          onChange={(v) => hasDrawers && set({ drawersOpen: v })}
        />
        <Toggle label="Hide doors" icon={<Icon name="eye" />} checked={!view.showFronts} onChange={(v) => set({ showFronts: !v })} />
        <Toggle label="Dimensions" icon={<Icon name="ruler" />} checked={view.showDimensions} onChange={(v) => set({ showDimensions: v })} />
        <Button variant="secondary" className="ml-auto bg-white/90" onClick={() => rendererRef.current?.resetCamera()} title="Reset camera">
          <Icon name="reset" /> Reset view
        </Button>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 hidden text-[11px] text-stone-500 sm:block">
        Drag to rotate · Right-drag to pan · Scroll to zoom
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
            {problems.length} {problems.length === 1 ? 'issue' : 'issues'} to review
          </button>
          {showWarnings && (
            <ul className="max-h-40 space-y-1 overflow-auto rounded-b-lg rounded-tr-lg border border-stone-200 bg-white/95 p-2.5 text-xs shadow-sm scrollbar-thin">
              {problems.map((w, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${w.level === 'error' ? 'bg-red-500' : w.level === 'warn' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                  {w.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
