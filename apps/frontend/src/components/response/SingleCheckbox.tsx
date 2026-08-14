'use client';

import {
  defaultPerTemplate,
  SingleCheckboxComponent,
} from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Label } from '../Label';
import { Field } from './Field';
import { CHECKBOX_ROOT_CLASS } from './styles';

type Props = {
  component: SingleCheckboxComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function SingleCheckbox({ component, form, context }: Props) {
  const { dataKey } = component.props;

  return (
    <Controller
      control={form.control}
      name={dataKey}
      defaultValue={defaultPerTemplate(component)}
      render={({ field }) => (
        <Field form={form} context={context} dataKey={dataKey}>
          <div className="flex items-start gap-2">
            <CheckboxPrimitive.Root
              id={`${dataKey}`}
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              className={twMerge(CHECKBOX_ROOT_CLASS, 'translate-y-0.5')}
            >
              <CheckboxPrimitive.Indicator>
                <Check className="text-content-inverted size-4" />
              </CheckboxPrimitive.Indicator>
            </CheckboxPrimitive.Root>
            <Label
              context={context}
              className="text-sm leading-tight"
              htmlFor={`${dataKey}`}
              tooltip={component.props.labelTooltip}
            >
              {component.props.label}
            </Label>
          </div>
        </Field>
      )}
    />
  );
}
