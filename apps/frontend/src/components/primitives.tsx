'use client';

import { ScreenComponent } from '@experiment-hub/engine/components';
import { Option } from '@experiment-hub/engine/components/response';
import { Context, ContextData } from '@experiment-hub/engine/types';
import { Info } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

export type RenderProps = {
  component: ScreenComponent;
  form: UseFormReturn<ContextData>;
  context: Context;
  isLoading: boolean;
  sharedOptions?: Record<string, Option[]>;
};

/** Downward-pointing arrow shared by every tooltip bubble. */
export function TooltipArrow() {
  return (
    <div
      className="bg-content-active -mt-px h-1.5 w-3"
      style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
    />
  );
}

/** Info icon revealing `children` in a bubble on hover. */
export function InfoTooltip({
  children,
  className,
  bubbleClassName,
}: {
  children: React.ReactNode;
  className?: string;
  bubbleClassName?: string;
}) {
  return (
    <div
      className={twMerge('group/tooltip relative flex items-center', className)}
    >
      <Info className="text-content-secondary size-3.5 cursor-help" />
      <div
        className={twMerge(
          'absolute bottom-full left-1/2 origin-bottom -translate-x-1/2',
          'group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100',
          'scale-95 opacity-0 transition-[opacity,transform] duration-150 ease-out',
          'pointer-events-none z-50 mb-1 flex w-max max-w-64 flex-col items-center',
        )}
      >
        <div
          className={twMerge(
            'bg-content-active text-content-inverted rounded-md px-2 py-1 text-left text-xs whitespace-normal shadow-md',
            bubbleClassName,
          )}
        >
          {children}
        </div>
        <TooltipArrow />
      </div>
    </div>
  );
}

export function OptionTooltip({ text }: { text: string }) {
  return <InfoTooltip bubbleClassName="max-w-48">{text}</InfoTooltip>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" aria-live="polite" className="text-error mt-1 text-xs">
      {message}
    </p>
  );
}
