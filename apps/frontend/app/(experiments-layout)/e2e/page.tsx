import { notFound } from 'next/navigation';
import { validateExperiment } from '@experiment-hub/engine/experiment-validation';
import Experiment from '@/src/Experiment';
import { ValidationErrors } from '@/src/ValidationErrors';

export const revalidate = 0;

export default async function E2EPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const { testExperiment } = await import('@/e2e/fixture');

  const errors = validateExperiment(testExperiment);
  if (errors.length > 0) {
    return <ValidationErrors errors={errors} />;
  }

  return <Experiment experiment={testExperiment} experimentSlug="e2e" />;
}
