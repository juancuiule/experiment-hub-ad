'use client';

import {
  defaultPerTemplate,
  DropdownComponent,
  Option,
} from '@experiment-hub/engine/components/response';
import {
  resolveOptions,
  resolveValuesInString,
} from '@experiment-hub/engine/resolve';
import { Context, ContextData } from '@experiment-hub/engine/types';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Field } from './Field';

type Props = {
  component: DropdownComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  sharedOptions?: Record<string, Option[]>;
};

export function Dropdown({ component, form, context, sharedOptions }: Props) {
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
          labelHtmlFor={dataKey}
        >
          <SelectPrimitive.Root
            value={field.value}
            onValueChange={field.onChange}
          >
            <SelectPrimitive.Trigger
              id={dataKey}
              className="border-border-default focus:border-content-active data-placeholder:text-content-secondary flex w-full items-center justify-between border-b pt-1 pb-1 text-sm transition-[border-color] duration-150 ease-out outline-none"
            >
              <SelectPrimitive.Value placeholder="Select one" />
              <SelectPrimitive.Icon>
                <ChevronDown className="text-content-secondary size-4" />
              </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
              <SelectPrimitive.Content
                position="popper"
                sideOffset={4}
                className="bg-background-surface border-border-default z-50 overflow-hidden rounded-sm border shadow-md"
                style={{ minWidth: 'var(--radix-select-trigger-width)' }}
              >
                <SelectPrimitive.Viewport className="p-1">
                  {resolveOptions(
                    component.props.options,
                    context,
                    component.props.dataKey,
                    sharedOptions,
                  ).map((opt) => (
                    <SelectPrimitive.Item
                      key={opt.value}
                      value={opt.value}
                      className="data-highlighted:bg-content-active data-highlighted:text-content-inverted flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none"
                    >
                      <SelectPrimitive.ItemText>
                        {resolveValuesInString(opt.label, context)}
                      </SelectPrimitive.ItemText>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Viewport>
              </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
          </SelectPrimitive.Root>
        </Field>
      )}
    />
  );
}
