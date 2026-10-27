import { useEffect, useRef, useState } from 'react';
import { BomPanel, CutListPanel } from './components/BomPanel';
import { DimensionsPanel } from './components/DimensionsPanel';
import { DoorsPanel } from './components/DoorsPanel';
import { FinishPanel } from './components/FinishPanel';
import { Icon } from './components/icons';
import { InteriorPanel } from './components/InteriorPanel';
import { PricesPanel } from './components/PricesPanel';
import { QuotePanel } from './components/QuotePanel';
import { RoomPanel } from './components/RoomPanel';
import { SelectionEditor } from './components/SelectionEditor';
import { Button, Segmented, Tabs } from './components/ui';
import { Viewport } from './components/Viewport';
import { formatMoney } from './domain/pricing';
import { describePart, selectionFocus } from './domain/selection';
import { useConfigurator } from './state/useConfigurator';
import type { CabinetRenderer } from './three/CabinetRenderer';
import type { ActiveFocus, Warning } from './domain/types';

type LeftTab = 'size' | 'interior' | 'doors' | 'finish' | 'room';
type RightTab = 'quote' | 'bom' | 'cuts' | 'prices';

export default function App() {
  const c = useConfigurator();
  const rendererRef = useRef<CabinetRenderer | null>(null);
  const [left, setLeft] = useState<LeftTab>('size');
  const [right, setRight] = useState<RightTab>('quote');
  const [exporting, setExporting] = useState(false);

  // The warning the user clicked. Keyed by message so it clears itself once the problem is fixed.
  const [selected, setSelected] = useState<{ message: string; nonce: number } | null>(null);
  const activeWarning = selected ? c.layout.warnings.find((w) => w.message === selected.message) : undefined;

  // The part the user clicked in 3D. Resolved against the current config, so it vanishes if deleted.
  const [picked, setPicked] = useState<{ partId: string; nonce: number } | null>(null);
  const selection = picked ? describePart(picked.partId, c.config, c.layout) : null;

  const focus: ActiveFocus | null =
    activeWarning?.focus && selected
      ? { ...activeWarning.focus, nonce: selected.nonce, tone: 'warning' }
      : selection && picked
        ? { ...selectionFocus(selection, c.config), nonce: picked.nonce, tone: 'select' }
        : null;

  const selectWarning = (w: Warning) => {
    setPicked(null);
    if (selected?.message === w.message) {
      setSelected(null);
      return;
    }
    setSelected({ message: w.message, nonce: Date.now() });
    if (w.focus) setLeft(w.focus.tab);
  };

  const pickPart = (partId: string | null) => {
    setSelected(null);
    if (!partId || partId === picked?.partId) {
      setPicked(null);
      return;
    }
    setPicked({ partId, nonce: Date.now() });
    const sel = describePart(partId, c.config, c.layout);
    if (sel) setLeft(selectionFocus(sel, c.config).tab);
  };

  // Keyboard: arrows nudge the selected shelf / rod / drawer, Delete removes it, Esc deselects.
  const keyState = useRef({ selection, c });
  keyState.current = { selection, c };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, select, textarea')) return;
      const { selection: sel, c: cfg } = keyState.current;
      if (e.key === 'Escape') {
        setPicked(null);
        setSelected(null);
        return;
      }
      if (sel?.kind !== 'item') return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = (e.shiftKey ? 50 : 10) * (e.key === 'ArrowUp' ? 1 : -1);
        const y = Math.min(Math.round(cfg.layout.interior.height), Math.max(0, sel.item.y + step));
        cfg.updateItem(sel.column, sel.item.id, { y }, sel.wing);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        cfg.removeItem(sel.column, sel.item.id, sel.wing);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const exportPdf = async () => {
    setExporting(true);
    try {
      // Lazy-load jsPDF so it isn't part of the initial bundle.
      const { exportQuotePdf } = await import('./pdf/exportPdf');
      exportQuotePdf({ ...c, snapshot: rendererRef.current?.snapshot() });
    } finally {
      setExporting(false);
    }
  };

  const resetAll = () => {
    if (confirm('Të rikthehen dollapi dhe të gjitha çmimet në vlerat fillestare?')) c.reset();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-stone-900 text-white">
            <Icon name="door" className="h-4.5 w-4.5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Closet Studio</div>
            <div className="hidden text-[11px] text-stone-500 sm:block">Konfigurues 3D i dollapëve & llogaritës i kostos</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <div className="text-[10px] uppercase tracking-wider text-stone-500">Totali</div>
            <div className="text-sm font-semibold tabular-nums">{formatMoney(c.quote.grandTotal, c.pricing.currency)}</div>
          </div>
          <div className="w-24">
            <Segmented value={c.unit} options={[{ value: 'mm', label: 'mm' }, { value: 'cm', label: 'cm' }]} onChange={c.setUnit} />
          </div>
          <Button variant="ghost" onClick={resetAll} title="Rikthe vlerat fillestare">
            <Icon name="reset" />
            <span className="hidden md:inline">Rivendos</span>
          </Button>
          <Button variant="primary" onClick={exportPdf} disabled={exporting}>
            <Icon name="download" />
            {exporting ? 'Duke eksportuar…' : 'Oferta PDF'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto lg:flex-row lg:overflow-hidden">
        <aside className="order-2 flex flex-col border-stone-200 bg-white lg:order-1 lg:w-[340px] lg:shrink-0 lg:border-r">
          <Tabs<LeftTab>
            value={left}
            onChange={setLeft}
            tabs={[
              { value: 'size', label: 'Përmasat' },
              { value: 'interior', label: 'Brendësia' },
              { value: 'doors', label: 'Dyert' },
              { value: 'finish', label: 'Materiali' },
              { value: 'room', label: 'Dhoma' },
            ]}
          />
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {left === 'size' && <DimensionsPanel c={c} focus={focus} />}
            {left === 'room' && <RoomPanel c={c} focus={focus} />}
            {left === 'interior' && <InteriorPanel c={c} focus={focus} />}
            {left === 'doors' && <DoorsPanel c={c} focus={focus} />}
            {left === 'finish' && <FinishPanel c={c} />}
          </div>
        </aside>

        <main className="relative order-1 h-[55vh] shrink-0 lg:order-2 lg:h-auto lg:min-w-0 lg:flex-1">
          <Viewport layout={c.layout} config={c.config} unit={c.unit} rendererRef={rendererRef} activeMessage={activeWarning?.message} focus={focus} onSelectWarning={selectWarning}
            selectionIds={selection?.partIds ?? []} onPick={pickPart} />
          {selection && (
            <div className="pointer-events-none absolute right-3 top-14 z-10">
              <SelectionEditor c={c} selection={selection} onClose={() => setPicked(null)} />
            </div>
          )}
        </main>

        <aside className="order-3 flex flex-col border-t border-stone-200 bg-white lg:w-[380px] lg:shrink-0 lg:border-l lg:border-t-0">
          <Tabs<RightTab>
            value={right}
            onChange={setRight}
            tabs={[
              { value: 'quote', label: 'Oferta' },
              { value: 'bom', label: 'Materialet' },
              { value: 'cuts', label: 'Prerjet', badge: <span className="rounded bg-stone-100 px-1 text-[10px] text-stone-500">{c.bom.cutList.length}</span> },
              { value: 'prices', label: 'Çmimet' },
            ]}
          />
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {right === 'quote' && <QuotePanel c={c} />}
            {right === 'bom' && <BomPanel c={c} />}
            {right === 'cuts' && <CutListPanel c={c} />}
            {right === 'prices' && <PricesPanel c={c} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
