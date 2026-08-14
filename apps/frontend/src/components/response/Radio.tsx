'use client';

import {
  Option,
  RadioComponent,
} from '@experiment-hub/engine/components/response';
import { resolveOptions } from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Controller, UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Label } from '../Label';
import { OptionTooltip } from '../primitives';
import { Field } from './Field';
import { RADIO_INDICATOR_CLASS, RADIO_ITEM_CLASS } from './styles';

type Props = {
  component: RadioComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  sharedOptions?: Record<string, Option[]>;
};

function RadioButton({ id, value }: { id: string; value: string }) {
  return (
    <RadioGroupPrimitive.Item
      id={id}
      value={value}
      className={RADIO_ITEM_CLASS}
    >
      <RadioGroupPrimitive.Indicator className={RADIO_INDICATOR_CLASS} />
    </RadioGroupPrimitive.Item>
  );
}

export function Radio({ component, form, context, sharedOptions }: Props) {
  const { dataKey, direction = 'vertical' } = component.props;

  return (
    <Controller
      control={form.control}
      name={dataKey}
      defaultValue=""
      render={({ field }) => (
        <Field
          form={form}
          context={context}
          dataKey={dataKey}
          label={component.props.label}
          labelTooltip={component.props.labelTooltip}
        >
          <RadioGroupPrimitive.Root
            value={field.value}
            onValueChange={field.onChange}
            className={
              direction === 'horizontal'
                ? 'mt-2 grid grid-cols-4 gap-2'
                : 'mt-2 flex flex-col gap-2'
            }
          >
            {resolveOptions(
              component.props.options,
              context,
              component.props.dataKey,
              sharedOptions,
            ).map((opt) =>
              direction === 'horizontal' ? (
                <label
                  key={opt.value}
                  htmlFor={`${dataKey}-${opt.value}`}
                  className={twMerge(
                    'group flex w-full flex-col items-start gap-2 transition duration-150 ease-out',
                    'border-content-secondary bg-background-surface',
                    'has-data-[state=checked]:border-content-active has-data-[state=checked]:bg-content-active/10',
                    'rounded-md border p-2',
                    'focus-within:ring-ring/50 focus-within:ring-2 active:scale-95',
                    'cursor-pointer',
                  )}
                >
                  <RadioButton
                    id={`${dataKey}-${opt.value}`}
                    value={opt.value}
                  />
                  <Label
                    context={context}
                    className="group-has-data-[state=checked]:text-content-active cursor-pointer text-sm"
                  >
                    {opt.label}
                  </Label>
                  {opt.tooltip && <OptionTooltip text={opt.tooltip} />}
                </label>
              ) : (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioButton
                    id={`${dataKey}-${opt.value}`}
                    value={opt.value}
                  />
                  <div className="flex items-center gap-1">
                    <Label
                      context={context}
                      className="cursor-pointer text-sm"
                      htmlFor={`${dataKey}-${opt.value}`}
                    >
                      {opt.label}
                    </Label>
                    {opt.tooltip && <OptionTooltip text={opt.tooltip} />}
                  </div>
                </div>
              ),
            )}
          </RadioGroupPrimitive.Root>
        </Field>
      )}
    />
  );
}
