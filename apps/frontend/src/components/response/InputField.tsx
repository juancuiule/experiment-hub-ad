'use client';

import {
  DateInputComponent,
  TimeInputComponent,
} from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '../Input';
import { Field } from './Field';

type Props = {
  component: DateInputComponent | TimeInputComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  type: 'date' | 'time';
};

/** Labelled native input for the response templates that take no extra props. */
export function InputField({ component, form, context, type }: Props) {
  const { dataKey } = component.props;

  return (
    <Field
      form={form}
      context={context}
      dataKey={dataKey}
      label={component.props.label}
      labelTooltip={component.props.labelTooltip}
      labelHtmlFor={dataKey}
    >
      <Input id={dataKey} {...form.register(dataKey)} type={type} />
    </Field>
  );
}
