import Image from 'next/image';
import { twMerge } from 'tailwind-merge';
import { ThemeToggle } from './ThemeToggle';

/** Logo + theme-toggle chrome wrapping every routed page. */
export function AppShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={twMerge(
        'relative mx-auto flex min-h-screen w-full flex-col items-center justify-start p-6',
        className,
      )}
    >
      <nav className="flex w-full flex-row items-center justify-between gap-3 pb-6">
        <Image
          width="48"
          height="48"
          src="/experiment-hub-logo.png"
          className="h-12 w-auto"
          alt="Experiment Hub logo with text"
        />
        <ThemeToggle />
      </nav>
      <div className="flex w-full flex-1 flex-col">{children}</div>
    </main>
  );
}
