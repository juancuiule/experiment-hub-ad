'use client';

import {
  defaultPerTemplate,
  RangeSliderComponent,
} from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Controller, UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Field } from './Field';
import {
  SliderEndLabels,
  SliderTrack,
  SliderValueTooltip,
  thumbFillClass,
} from './slider-parts';

type Props = {
  component: RangeSliderComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

// Explicit strings so Tailwind's scanner picks up both variants at build time.
// Quoted attribute values ("0"/"1") are required by the CSS spec.
const THUMB_TOOLTIP_ACTIVE_CLASS = [
  '[[data-active-thumb="0"]_&]:opacity-100 [[data-active-thumb="0"]_&]:scale-100',
  '[[data-active-thumb="1"]_&]:opacity-100 [[data-active-thumb="1"]_&]:scale-100',
] as const;

export function RangeSlider({ component, form, context }: Props) {
  const { dataKey } = component.props;
  const min = component.props.min ?? 0;
  const max = component.props.max ?? 100;
  const hasExplicitDefault = component.props.defaultValue !== undefined;
  const defaultValue = component.props.defaultValue ?? [min, max];

  return (
    <Controller
      control={form.control}
      name={dataKey}
      defaultValue={defaultPerTemplate(component)}
      render={({ field }) => {
        const hasInteracted = field.value !== null && field.value !== undefined;
        const [loVal, hiVal] = hasInteracted
          ? (field.value as [number, number])
          : defaultValue;

        const showThumbs = hasInteracted || hasExplicitDefault;
        const tooltipConfig = component.props.tooltip;
        const loPercent = ((loVal - min) / (max - min)) * 100;
        const hiPercent = ((hiVal - min) / (max - min)) * 100;

        return (
          <Field
            form={form}
            context={context}
            dataKey={dataKey}
            label={component.props.label}
            labelTooltip={component.props.labelTooltip}
            labelLayout="row"
            labelAside={
              component.props.showValue && hasInteracted ? (
                <span className="text-content-primary text-sm font-medium tabular-nums">
                  {loVal} – {hiVal}
                </span>
              ) : null
            }
          >
            <div data-slider className="relative">
              {tooltipConfig &&
                hasInteracted &&
                [
                  { val: loVal, percent: loPercent, idx: 0 },
                  { val: hiVal, percent: hiPercent, idx: 1 },
                ].map(({ val, percent, idx }) => (
                  <SliderValueTooltip
                    key={idx}
                    value={val}
                    percent={percent}
                    tooltip={tooltipConfig}
                    className={THUMB_TOOLTIP_ACTIVE_CLASS[idx]}
                  />
                ))}
              <SliderPrimitive.Root
                value={[loVal, hiVal]}
                min={min}
                max={max}
                step={component.props.step ?? 1}
                onValueChange={([lo, hi]) => field.onChange([lo, hi])}
                className="relative flex h-5 w-full touch-none items-center select-none"
              >
                <SliderTrack hasInteracted={hasInteracted} />
                {[0, 1].map((i) => (
                  <SliderPrimitive.Thumb
                    key={i}
                    onFocus={(e) => {
                      e.currentTarget
                        .closest('[data-slider]')
                        ?.setAttribute('data-active-thumb', String(i));
                    }}
                    onBlur={(e) => {
                      e.currentTarget
                        .closest('[data-slider]')
                        ?.removeAttribute('data-active-thumb');
                    }}
                    className={twMerge(
                      'block h-4 w-4 rounded-full transition-transform duration-100 ease-out outline-none',
                      showThumbs
                        ? 'focus-visible:ring-ring/50 cursor-grab focus-visible:ring-4 active:scale-125 active:cursor-grabbing'
                        : '',
                      thumbFillClass(hasInteracted, showThumbs),
                    )}
                  />
                ))}
              </SliderPrimitive.Root>
            </div>
            <SliderEndLabels
              minLabel={component.props.minLabel}
              maxLabel={component.props.maxLabel}
              context={context}
            />
          </Field>
        );
      }}
    />
  );
}
