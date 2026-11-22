import { AppShellSkeleton } from "@/components/skeletons/app-shell-skeleton";
import { StatsSkeleton } from "@/components/skeletons/page-skeletons";

/** Mientras carga una vista de administración. */
export default function Loading() {
  return (
    <AppShellSkeleton>
      <StatsSkeleton />
    </AppShellSkeleton>
  );
}
