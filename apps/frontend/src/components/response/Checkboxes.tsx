'use client';

import {
  CheckboxesComponent,
  defaultPerTemplate,
  Option,
} from '@experiment-hub/engine/components/response';
import { resolveOptions } from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Label } from '../Label';
import { OptionTooltip } from '../primitives';
import { Field } from './Field';
import { CHECKBOX_ROOT_CLASS } from './styles';

type Props = {
  component: CheckboxesComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  sharedOptions?: Record<string, Option[]>;
};

export function Checkboxes({ component, form, context, sharedOptions }: Props) {
  const { dataKey } = component.props;

  return (
    <Controller
      control={form.control}
      name={dataKey}
      defaultValue={defaultPerTemplate(component)}
      render={({ field }) => (
        <Field
          form={form}
          context={context}
          dataKey={dataKey}
          label={component.props.label}
          labelTooltip={component.props.labelTooltip}
        >
          <div className="flex flex-col gap-2">
            {resolveOptions(
              component.props.options,
              context,
              component.props.dataKey,
              sharedOptions,
            ).map((opt) => {
              const checked =
                Array.isArray(field.value) && field.value.includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center gap-2">
                  <CheckboxPrimitive.Root
                    id={`${dataKey}-${opt.value}`}
                    checked={checked}
                    onCheckedChange={(isChecked) => {
                      const current = Array.isArray(field.value)
                        ? field.value
                        : [];
                      field.onChange(
                        isChecked
                          ? [...current, opt.value]
                          : current.filter((v: string) => v !== opt.value),
                      );
                    }}
                    className={CHECKBOX_ROOT_CLASS}
                  >
                    <CheckboxPrimitive.Indicator>
                      <Check className="text-content-inverted size-4" />
                    </CheckboxPrimitive.Indicator>
                  </CheckboxPrimitive.Root>
                  <Label
                    className="text-sm"
                    htmlFor={`${dataKey}-${opt.value}`}
                    context={context}
                  >
                    {opt.label}
                  </Label>
                  {opt.tooltip && <OptionTooltip text={opt.tooltip} />}
                </div>
              );
            })}
          </div>
        </Field>
      )}
    />
  );
}
