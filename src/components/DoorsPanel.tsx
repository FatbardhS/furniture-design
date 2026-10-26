import { HANDLE_LABELS } from '../domain/catalog';
import { fmtLen } from '../domain/units';
import type { DoorType, HandleFinish, HandleType } from '../domain/types';
import type { Configurator } from '../state/useConfigurator';
import { Icon } from './icons';
import { Button, Field, Section, Segmented, Select, Stat } from './ui';

const DOOR_LIMITS: Record<DoorType, [number, number]> = { none: [0, 0], hinged: [1, 8], sliding: [2, 4] };

export function DoorsPanel({ c }: { c: Configurator }) {
  const { config, patch, layout, unit } = c;
  const [min, max] = DOOR_LIMITS[config.doorType];
  const doors = layout.doors;

  const setType = (doorType: DoorType) => {
    const [lo, hi] = DOOR_LIMITS[doorType];
    patch({ doorType, doorCount: Math.min(hi, Math.max(lo, config.doorCount)) });
  };

  return (
    <>
      <Section title="Doors">
        <Segmented
          value={config.doorType}
          options={[
            { value: 'none', label: 'Open shelving' },
            { value: 'hinged', label: 'Hinged' },
            { value: 'sliding', label: 'Sliding' },
          ]}
          onChange={setType}
        />
        {config.doorType !== 'none' && (
          <>
            <Field label="Number of doors">
              <div className="flex items-center gap-2">
                <Button onClick={() => patch({ doorCount: config.doorCount - 1 })} disabled={config.doorCount <= min}>
                  <Icon name="minus" />
                </Button>
                <div className="flex-1 text-center text-sm font-semibold tabular-nums">{config.doorCount}</div>
                <Button onClick={() => patch({ doorCount: config.doorCount + 1 })} disabled={config.doorCount >= max}>
                  <Icon name="plus" />
                </Button>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Door size" value={`${fmtLen(doors.width, unit)} × ${fmtLen(doors.height, unit)}`} />
              <Stat
                label="Weight each"
                value={`${doors.weightKg.toFixed(1)} kg`}
                sub={config.doorType === 'hinged' ? `${doors.hingesEach} hinges per door` : 'on 2 tracks'}
              />
            </div>
          </>
        )}
      </Section>

      <Section title="Hardware">
        <Field label="Handles">
          <Select<HandleType>
            value={config.handleType}
            options={(Object.keys(HANDLE_LABELS) as HandleType[]).map((k) => ({ value: k, label: HANDLE_LABELS[k] }))}
            onChange={(handleType) => patch({ handleType })}
          />
        </Field>
        {config.handleType !== 'none' && (
          <Field label="Handle finish">
            <Segmented<HandleFinish>
              value={config.handleFinish}
              options={[
                { value: 'chrome', label: 'Chrome' },
                { value: 'black', label: 'Black' },
                { value: 'brass', label: 'Brass' },
              ]}
              onChange={(handleFinish) => patch({ handleFinish })}
            />
          </Field>
        )}
        {config.doorType === 'hinged' && (
          <Field label="Hinges (pagllama)">
            <Segmented
              value={config.hingeType}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'softClose', label: 'Soft-close' },
              ]}
              onChange={(hingeType) => patch({ hingeType })}
            />
          </Field>
        )}
        <Field label="Drawer slides">
          <Segmented
            value={config.slideType}
            options={[
              { value: 'ballBearing', label: 'Ball-bearing' },
              { value: 'softCloseUndermount', label: 'Soft-close undermount' },
            ]}
            onChange={(slideType) => patch({ slideType })}
          />
        </Field>
      </Section>
    </>
  );
}
