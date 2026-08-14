'use client';

import { Context } from '@experiment-hub/engine/types';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { twMerge } from 'tailwind-merge';
import { TooltipArrow } from '../primitives';
import { resolveOptionalText } from './Field';

export type SliderTooltipConfig = true | { prefix?: string; suffix?: string };

export function formatTooltipValue(
  value: number,
  tooltip: SliderTooltipConfig,
): string {
  if (tooltip === true) return String(value);
  return `${tooltip.prefix ?? ''}${value}${tooltip.suffix ?? ''}`;
}

/** Fill color of a thumb: active once touched, muted while showing a default. */
export function thumbFillClass(
  hasInteracted: boolean,
  showThumb: boolean,
): string {
  if (hasInteracted) return 'bg-content-active';
  return showThumb ? 'bg-content-secondary/60' : 'cursor-pointer opacity-0';
}

/** Value bubble floating above a thumb. `className` carries the reveal rules. */
export function SliderValueTooltip({
  value,
  percent,
  tooltip,
  className,
}: {
  value: number;
  percent: number;
  tooltip: SliderTooltipConfig;
  className?: string;
}) {
  return (
    <div
      style={{ left: `calc(${percent}% + ${8 * (1 - (2 * percent) / 100)}px)` }}
      className={twMerge(
        'pointer-events-none absolute bottom-7 z-50 flex origin-bottom -translate-x-1/2 scale-95 flex-col items-center opacity-0 transition-[opacity,transform] duration-150 ease-out',
        className,
      )}
    >
      <div className="bg-content-active text-content-inverted rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap tabular-nums shadow-md">
        {formatTooltipValue(value, tooltip)}
      </div>
      <TooltipArrow />
    </div>
  );
}

export function SliderTrack({ hasInteracted }: { hasInteracted: boolean }) {
  return (
    <SliderPrimitive.Track className="bg-content-secondary/60 relative h-0.5 flex-1 rounded-full">
      <SliderPrimitive.Range
        className={`absolute h-full rounded-full ${hasInteracted ? 'bg-content-active' : 'bg-transparent'}`}
      />
    </SliderPrimitive.Track>
  );
}

/** Scale anchors printed under a slider track. */
export function SliderEndLabels({
  minLabel,
  maxLabel,
  context,
}: {
  minLabel?: string;
  maxLabel?: string;
  context: Context;
}) {
  if (!minLabel && !maxLabel) return null;
  return (
    <div className="mt-0 flex justify-between">
      <span className="text-content-secondary w-full max-w-2/5 text-left text-xs tracking-wide uppercase">
        {resolveOptionalText(minLabel, context)}
      </span>
      <span className="text-content-secondary w-full max-w-2/5 text-right text-xs tracking-wide uppercase">
        {resolveOptionalText(maxLabel, context)}
      </span>
    </div>
  );
}
