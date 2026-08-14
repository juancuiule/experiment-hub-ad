'use client';

import { NumericInputComponent } from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '../Input';
import { Field, resolveOptionalText } from './Field';

type Props = {
  component: NumericInputComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function NumericInput({ component, form, context }: Props) {
  const { dataKey, placeholder } = component.props;

  return (
    <Field
      form={form}
      context={context}
      dataKey={dataKey}
      label={component.props.label}
      labelTooltip={component.props.labelTooltip}
      labelHtmlFor={dataKey}
    >
      <Input
        id={dataKey}
        {...form.register(dataKey, { valueAsNumber: true })}
        type="number"
        onWheel={(e) => e.currentTarget.blur()}
        placeholder={resolveOptionalText(placeholder, context)}
        min={component.props.min}
        max={component.props.max}
        step={component.props.step}
      />
    </Field>
  );
}
