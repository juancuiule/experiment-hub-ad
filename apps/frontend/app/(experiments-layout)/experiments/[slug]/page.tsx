import { validateExperiment } from '@experiment-hub/engine/experiment-validation';
import { selectStartNode } from '@experiment-hub/engine/flow';
import { selectLocale } from '@experiment-hub/engine/i18n';
import { EXPERIMENTS } from '@/src/data/experiments';
import { DataDebug, StateDebug } from '@/src/debug/Debug';
import Experiment from '@/src/Experiment';
import { ValidationErrors } from '@/src/ValidationErrors';

import { notFound } from 'next/navigation';
type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  params: Promise<{ slug: string }>;
};

export const revalidate = 0; // Disable caching to ensure fresh data on each request

export default async function Home(props: Props) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;

  const experiment = EXPERIMENTS[slug];

  if (!experiment) {
    notFound();
  }

  const errors = validateExperiment(experiment);

  if (errors.length > 0) {
    console.error(
      `== Experiment validation errors for "${slug}" (${errors.length}): ==`,
    );
    errors.forEach((error) => console.error(error));
    return <ValidationErrors errors={errors} />;
  }

  const startingNode = selectStartNode(searchParams, experiment);
  const locale = selectLocale(searchParams, experiment);

  return (
    <>
      {process.env.NODE_ENV === 'development' && (
        <details className="my-2">
          <summary className="text-content-secondary cursor-pointer text-xs">
            Debug Info
          </summary>
          <StateDebug />
        </details>
      )}
      <Experiment
        startingNode={startingNode}
        experiment={experiment}
        locale={locale}
        experimentSlug={slug}
      />
      {process.env.NODE_ENV === 'development' && (
        <details className="my-2">
          <summary className="text-content-secondary cursor-pointer text-xs">
            Data Debug
          </summary>
          <DataDebug />
        </details>
      )}
    </>
  );
}
