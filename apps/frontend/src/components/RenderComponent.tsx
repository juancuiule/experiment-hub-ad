'use client';

import { memo } from 'react';
import { resolveCondition } from '@experiment-hub/engine/conditions';
import { deepMerge } from '@experiment-hub/engine/flow';
import { resolveValuesInString } from '@experiment-hub/engine/resolve';
import { Audio } from './content/Audio';
import { Image as ImageRenderer } from './content/Image';
import { RichText } from './content/RichText';
import { Video } from './content/Video';
import { Conditional } from './control/Conditional';
import { ForEach } from './control/ForEach';
import { Button } from './layout/Button';
import { Group } from './layout/Group';
import { RenderProps } from './primitives';
import { Checkboxes } from './response/Checkboxes';
import { DateInput } from './response/DateInput';
import { Dropdown } from './response/Dropdown';
import { LikertScale } from './response/LikertScale';
import { NumericInput } from './response/NumericInput';
import { Radio } from './response/Radio';
import { SingleCheckbox } from './response/SingleCheckbox';
import { RangeSlider } from './response/RangeSlider';
import { Slider } from './response/Slider';
import { TextArea } from './response/TextArea';
import { TextInput } from './response/TextInput';
import { TimeInput } from './response/TimeInput';

// An unknown template renders nothing, which is indistinguishable from a
// deliberately empty screen for whoever authored the experiment. Warn in
// development so the misconfiguration is visible; production stays silent so
// participants never see console noise.
function warnUnknownTemplate(component: RenderProps['component']): null {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `RenderComponent: unknown template "${component.template}" for componentFamily "${component.componentFamily}" — nothing was rendered.`,
    );
  }
  return null;
}

export const RenderComponent = memo(function RenderComponent({
  component,
  form,
  context,
  isLoading,
  sharedOptions,
}: RenderProps) {
  const renderChild = (props: RenderProps) => (
    <RenderComponent {...props} sharedOptions={sharedOptions} />
  );

  switch (component.componentFamily) {
    case 'content': {
      switch (component.template) {
        case 'rich-text':
          return <RichText component={component} context={context} />;
        case 'image':
          return <ImageRenderer component={component} context={context} />;
        case 'video':
          return <Video component={component} />;
        case 'audio':
          return <Audio component={component} />;
      }
      return warnUnknownTemplate(component);
    }

    case 'response': {
      const mergedResponseComponent: any = deepMerge(component, {
        props: {
          dataKey: resolveValuesInString(component.props.dataKey, context),
        },
      });
      const props = {
        form,
        context,
        sharedOptions,
        component: mergedResponseComponent,
      };
      switch (component.template) {
        case 'text-input':
          return <TextInput {...props} />;
        case 'text-area':
          return <TextArea {...props} />;
        case 'date-input':
          return <DateInput {...props} />;
        case 'time-input':
          return <TimeInput {...props} />;
        case 'numeric-input':
          return <NumericInput {...props} />;
        case 'single-checkbox':
          return <SingleCheckbox {...props} />;
        case 'checkboxes':
          return <Checkboxes {...props} />;
        case 'radio':
          return <Radio {...props} />;
        case 'dropdown':
          return <Dropdown {...props} />;
        case 'slider':
          return <Slider {...props} />;
        case 'range-slider':
          return <RangeSlider {...props} />;
        case 'likert-scale':
          return <LikertScale {...props} />;
      }
      return warnUnknownTemplate(component);
    }

    case 'layout': {
      switch (component.template) {
        case 'button': {
          const mergedButtonComponent = deepMerge(component, {
            props: {
              payload: component.props.payload
                ? {
                    dataKey: resolveValuesInString(
                      component.props.payload.dataKey,
                      context,
                    ),
                    value:
                      typeof component.props.payload.value === 'string'
                        ? resolveValuesInString(
                            component.props.payload.value,
                            context,
                          )
                        : component.props.payload.value,
                  }
                : undefined,
            },
          });
          return (
            <Button
              component={mergedButtonComponent}
              isLoading={isLoading}
              context={context}
              form={form}
            />
          );
        }
        case 'group':
          return (
            <Group
              component={component}
              form={form}
              context={context}
              isLoading={isLoading}
              renderChild={renderChild}
            />
          );
      }
      return warnUnknownTemplate(component);
    }

    case 'control': {
      switch (component.template) {
        case 'conditional': {
          const mergedConditionalComponent: any = deepMerge(component, {
            props: {
              if: resolveCondition(component.props.if, context),
            },
          });
          const props = {
            form,
            context,
            component: mergedConditionalComponent,
          };
          return (
            <Conditional
              {...props}
              isLoading={isLoading}
              renderChild={renderChild}
            />
          );
        }
        case 'for-each':
          return (
            <ForEach
              component={component}
              form={form}
              context={context}
              isLoading={isLoading}
              renderChild={renderChild}
            />
          );
      }
      return warnUnknownTemplate(component);
    }
  }

  return (
    <pre className="bg-background-surface text-content-primary my-2 rounded p-2 text-xs">
      <code>{JSON.stringify(component, null, 2)}</code>
    </pre>
  );
});
