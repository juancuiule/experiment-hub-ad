'use client';

import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { ReactNode } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Label } from '../Label';
import { FieldError } from '../primitives';

export function fieldErrorMessage(
  form: UseFormReturn<ContextData>,
  dataKey: string,
): string | undefined {
  return form.formState.errors[dataKey]?.message as string | undefined;
}

export function resolveOptionalText(
  text: string | undefined,
  context: Context,
): string | undefined {
  return text ? resolveValuesInString(text, context) : undefined;
}

type FieldProps = {
  form: UseFormReturn<ContextData>;
  context: Context;
  dataKey: string;
  /** Omitted when the component renders its own label (e.g. single checkbox). */
  label?: string;
  labelTooltip?: string;
  labelId?: string;
  labelHtmlFor?: string;
  labelClassName?: string;
  /** Rendered opposite the label on a justified row (e.g. slider readout). */
  labelAside?: ReactNode;
  /** 'row' puts the label and `labelAside` on one justified row. */
  labelLayout?: 'stacked' | 'row';
  children: ReactNode;
};

/**
 * Wrapper shared by every response component: label, the input itself, and the
 * validation message for `dataKey`.
 */
export function Field({
  form,
  context,
  dataKey,
  label,
  labelTooltip,
  labelId,
  labelHtmlFor,
  labelClassName,
  labelAside,
  labelLayout = 'stacked',
  children,
}: FieldProps) {
  const labelNode =
    label === undefined ? null : (
      <Label
        id={labelId}
        htmlFor={labelHtmlFor}
        className={labelClassName}
        context={context}
        tooltip={labelTooltip}
      >
        {label}
      </Label>
    );

  return (
    <div className="flex flex-col gap-1">
      {labelLayout === 'row' ? (
        <div className="mb-2 flex items-center justify-between">
          {labelNode}
          {labelAside}
        </div>
      ) : (
        labelNode
      )}
      {children}
      <FieldError message={fieldErrorMessage(form, dataKey)} />
    </div>
  );
}
