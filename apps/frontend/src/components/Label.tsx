'use client';

import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Context } from '@experiment-hub/engine/types';
import Markdown from 'react-markdown';
import { twMerge } from 'tailwind-merge';
import { InfoTooltip } from './primitives';

interface Props extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: string;
  context?: Context;
  tooltip?: string;
}

const allowedElements = [
  'b',
  'i',
  'em',
  'strong',
  'u',
  's',
  'del',
  'code',
  'a',
  'p',
];

function RenderText({
  children,
  context,
}: {
  children: string;
  context?: Context;
}) {
  return (
    <Markdown
      allowedElements={allowedElements}
      components={{
        p: ({ children }) => <>{children}</>,
        code: ({ node: _node, className, children, ...props }) => {
          return (
            <code
              className={twMerge(
                'bg-content-primary/10 rounded px-1 text-sm',
                className,
              )}
              {...props}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {context ? resolveValuesInString(children, context) : children}
    </Markdown>
  );
}

export function Label({ children, context, tooltip, ...props }: Props) {
  const label = (
    <label {...props}>
      <RenderText context={context}>{children}</RenderText>
    </label>
  );

  if (tooltip) {
    return (
      <div className="flex items-center gap-2">
        {label}
        <InfoTooltip className="w-fit" bubbleClassName="block">
          <RenderText context={context}>{tooltip}</RenderText>
        </InfoTooltip>
      </div>
    );
  }

  return label;
}
