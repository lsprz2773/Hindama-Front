import { AppShellSkeleton } from "@/components/skeletons/app-shell-skeleton";
import { ListPageSkeleton } from "@/components/skeletons/page-skeletons";

/** Se muestra mientras carga la lista de proyectos u otra ruta sin su propio `loading`. */
export default function Loading() {
  return (
    <AppShellSkeleton>
      <ListPageSkeleton />
    </AppShellSkeleton>
  );
}
