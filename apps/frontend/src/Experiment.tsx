'use client';
import { getScreenView, isEnded } from '@experiment-hub/engine/flow';
import { ExperimentFlow } from '@experiment-hub/engine/types';
import { Screen } from '@/src/Screen';
import Stepper from '@/src/components/Stepper';
import { useExperimentStore } from '@/src/data/store';
import { useEffect } from 'react';

type Props = {
  startingNode?: string;
  experiment: ExperimentFlow;
  locale?: string;
  experimentSlug: string;
};

export default function Experiment(props: Props) {
  const { startingNode, experiment, locale, experimentSlug } = props;
  const { step, isLoading, start, next } = useExperimentStore();
  const reset = useExperimentStore((s) => s.reset);

  useEffect(() => {
    if (!step || step.experiment !== experiment) {
      start(experiment, experimentSlug, startingNode, locale);
    }
  }, [experiment, experimentSlug, startingNode, locale]);

  useEffect(() => reset, [reset]);

  if (!step || step.experiment !== experiment) {
    return <div className="flex-1"></div>;
  }

  if (isEnded(step)) {
    return (
      <>
        <h1 className="mb-2 text-2xl font-semibold">All done!</h1>
        <p className="text-content-secondary mb-8">
          Thanks for completing the experiment.
        </p>
      </>
    );
  }

  const view = getScreenView(step);

  if (!view) {
    return (
      <>
        <p className="text-content-secondary">Loading…</p>
      </>
    );
  }

  const screen = step.experiment.screens?.find((s) => s.slug === view.slug);

  return (
    <>
      {view.stepper && <Stepper {...view.stepper} />}
      {screen ? (
        <Screen
          key={view.screenKey}
          screen={screen}
          isLoading={isLoading}
          onNext={next}
          context={step.context}
          sharedOptions={step.experiment.options}
        />
      ) : (
        <p className="text-error">Screen not found: {view.slug}</p>
      )}
    </>
  );
}
