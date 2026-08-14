'use client';

import { TextAreaComponent } from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Field, resolveOptionalText } from './Field';

type Props = {
  component: TextAreaComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function TextArea({ component, form, context }: Props) {
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
      <textarea
        id={dataKey}
        {...form.register(dataKey)}
        rows={component.props.lines ?? 4}
        placeholder={resolveOptionalText(placeholder, context)}
        className={twMerge(
          'border-border-default placeholder:text-content-secondary focus:border-content-active w-full border-b bg-transparent py-1 text-sm transition-[border-color,color] duration-150 ease-out outline-none',
          'resize-none',
        )}
      />
    </Field>
  );
}
