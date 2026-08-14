import { AppShell } from '@/src/AppShell';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell className="max-w-lg">{children}</AppShell>;
}
