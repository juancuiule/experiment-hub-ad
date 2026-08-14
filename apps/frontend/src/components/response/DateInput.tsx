'use client';

import { DateInputComponent } from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { UseFormReturn } from 'react-hook-form';
import { InputField } from './InputField';

type Props = {
  component: DateInputComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function DateInput(props: Props) {
  return <InputField {...props} type="date" />;
}
