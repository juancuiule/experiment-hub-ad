'use client';

import { TextInputComponent } from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '../Input';
import { Field, resolveOptionalText } from './Field';

type Props = {
  component: TextInputComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function TextInput({ component, form, context }: Props) {
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
        {...form.register(dataKey)}
        type="text"
        placeholder={resolveOptionalText(placeholder, context)}
      />
    </Field>
  );
}
