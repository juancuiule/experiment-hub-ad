import { QueryProvider } from '@/src/query-provider';
import { ThemeProvider } from '@/src/theme-provider';
import type { Metadata } from 'next';
import { Montserrat, Overpass_Mono } from 'next/font/google';
import { twMerge } from 'tailwind-merge';
import './globals.css';

const montserrat = Montserrat({
  variable: '--font-sans',
  subsets: ['latin'],
});

const overpassMono = Overpass_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Experiment Hub',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={twMerge(
          montserrat.variable,
          overpassMono.variable,
          'bg-background text-content-primary h-svh antialiased',
        )}
      >
        <QueryProvider>
          <ThemeProvider
            attribute={'class'}
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
