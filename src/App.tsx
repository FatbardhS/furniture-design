import { useRef, useState } from 'react';
import { BomPanel, CutListPanel } from './components/BomPanel';
import { DimensionsPanel } from './components/DimensionsPanel';
import { DoorsPanel } from './components/DoorsPanel';
import { FinishPanel } from './components/FinishPanel';
import { Icon } from './components/icons';
import { InteriorPanel } from './components/InteriorPanel';
import { PricesPanel } from './components/PricesPanel';
import { QuotePanel } from './components/QuotePanel';
import { Button, Segmented, Tabs } from './components/ui';
import { Viewport } from './components/Viewport';
import { formatMoney } from './domain/pricing';
import { useConfigurator } from './state/useConfigurator';
import type { CabinetRenderer } from './three/CabinetRenderer';

type LeftTab = 'size' | 'interior' | 'doors' | 'finish';
type RightTab = 'quote' | 'bom' | 'cuts' | 'prices';

export default function App() {
  const c = useConfigurator();
  const rendererRef = useRef<CabinetRenderer | null>(null);
  const [left, setLeft] = useState<LeftTab>('size');
  const [right, setRight] = useState<RightTab>('quote');
  const [exporting, setExporting] = useState(false);

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
    if (confirm('Reset the cabinet and all prices to defaults?')) c.reset();
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
            <div className="hidden text-[11px] text-stone-500 sm:block">3D cabinet configurator & cost estimator</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <div className="text-[10px] uppercase tracking-wider text-stone-500">Total</div>
            <div className="text-sm font-semibold tabular-nums">{formatMoney(c.quote.grandTotal, c.pricing.currency)}</div>
          </div>
          <div className="w-24">
            <Segmented value={c.unit} options={[{ value: 'mm', label: 'mm' }, { value: 'cm', label: 'cm' }]} onChange={c.setUnit} />
          </div>
          <Button variant="ghost" onClick={resetAll} title="Reset to defaults">
            <Icon name="reset" />
            <span className="hidden md:inline">Reset</span>
          </Button>
          <Button variant="primary" onClick={exportPdf} disabled={exporting}>
            <Icon name="download" />
            {exporting ? 'Exporting…' : 'PDF quote'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto lg:flex-row lg:overflow-hidden">
        <aside className="order-2 flex flex-col border-stone-200 bg-white lg:order-1 lg:w-[340px] lg:shrink-0 lg:border-r">
          <Tabs<LeftTab>
            value={left}
            onChange={setLeft}
            tabs={[
              { value: 'size', label: 'Size' },
              { value: 'interior', label: 'Interior' },
              { value: 'doors', label: 'Doors & hardware' },
              { value: 'finish', label: 'Finish' },
            ]}
          />
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {left === 'size' && <DimensionsPanel c={c} />}
            {left === 'interior' && <InteriorPanel c={c} />}
            {left === 'doors' && <DoorsPanel c={c} />}
            {left === 'finish' && <FinishPanel c={c} />}
          </div>
        </aside>

        <main className="order-1 h-[55vh] shrink-0 lg:order-2 lg:h-auto lg:min-w-0 lg:flex-1">
          <Viewport layout={c.layout} config={c.config} unit={c.unit} rendererRef={rendererRef} />
        </main>

        <aside className="order-3 flex flex-col border-t border-stone-200 bg-white lg:w-[380px] lg:shrink-0 lg:border-l lg:border-t-0">
          <Tabs<RightTab>
            value={right}
            onChange={setRight}
            tabs={[
              { value: 'quote', label: 'Quote' },
              { value: 'bom', label: 'BOM' },
              { value: 'cuts', label: 'Cut list', badge: <span className="rounded bg-stone-100 px-1 text-[10px] text-stone-500">{c.bom.cutList.length}</span> },
              { value: 'prices', label: 'Prices' },
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
