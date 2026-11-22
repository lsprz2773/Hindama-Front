import { AppShellSkeleton } from "@/components/skeletons/app-shell-skeleton";
import { DashboardSkeleton } from "@/components/skeletons/page-skeletons";

/** Mientras carga una vista de un proyecto: marco con barra del proyecto y esqueleto del panel. */
export default function Loading() {
  return (
    <AppShellSkeleton withProject>
      <DashboardSkeleton />
    </AppShellSkeleton>
  );
}
