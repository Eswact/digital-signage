'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { LiveProvider } from '@/lib/live';
import { Shell } from '@/components/Shell';
import { Skeleton } from '@/components/ui/Misc';

/** Everything behind sign-in: guards the session and wraps pages in the app shell + live updates. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session === null) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [session, router, pathname]);

  if (!session) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return (
    <LiveProvider>
      <Shell>{children}</Shell>
    </LiveProvider>
  );
}
