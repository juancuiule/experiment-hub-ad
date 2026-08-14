'use client';

import {
  defaultPerTemplate,
  SliderComponent,
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
  component: SliderComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function Slider({ component, form, context }: Props) {
  const { dataKey } = component.props;
  const min = component.props.min ?? 0;
  const max = component.props.max ?? 100;

  return (
    <Controller
      control={form.control}
      name={dataKey}
      defaultValue={defaultPerTemplate(component)}
      render={({ field }) => {
        const hasInteracted = field.value !== null && field.value !== undefined;
        const defaultValue = component.props.defaultValue;
        const showThumb = hasInteracted || defaultValue !== undefined;
        const thumbPosition = hasInteracted
          ? (field.value as number)
          : (defaultValue ?? min);

        const tooltipConfig = component.props.tooltip;
        const shouldShowTooltip = !!tooltipConfig && hasInteracted;
        const percent = ((thumbPosition - min) / (max - min)) * 100;

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
                  {field.value}
                </span>
              ) : null
            }
          >
            <div className="group relative">
              {shouldShowTooltip && (
                <SliderValueTooltip
                  value={thumbPosition}
                  percent={percent}
                  tooltip={tooltipConfig}
                  className="group-focus-within:scale-100 group-focus-within:opacity-100 group-active:scale-100 group-active:opacity-100"
                />
              )}
              <SliderPrimitive.Root
                value={[thumbPosition]}
                min={min}
                max={max}
                step={component.props.step ?? 1}
                onValueChange={([val]) => field.onChange(val)}
                className="group relative flex h-5 w-full touch-none items-center select-none"
              >
                <SliderTrack hasInteracted={hasInteracted} />
                <SliderPrimitive.Thumb
                  className={twMerge(
                    'block h-4 w-4 rounded-full transition-transform duration-100 ease-out outline-none',
                    hasInteracted || showThumb
                      ? 'focus-visible:ring-ring/50 cursor-grab group-active:scale-125 group-active:cursor-grabbing focus-visible:ring-4'
                      : '',
                    thumbFillClass(hasInteracted, showThumb),
                  )}
                />
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
