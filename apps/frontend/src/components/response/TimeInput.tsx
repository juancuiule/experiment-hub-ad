'use client';

import { TimeInputComponent } from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { UseFormReturn } from 'react-hook-form';
import { InputField } from './InputField';

type Props = {
  component: TimeInputComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
};

export function TimeInput(props: Props) {
  return <InputField {...props} type="time" />;
}
