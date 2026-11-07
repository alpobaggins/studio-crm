import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка">
      <Skeleton className="h-11 w-64 rounded-sm" />
      <Skeleton className="mt-3 mb-10 h-6 w-96 max-w-full rounded-sm" />
      <Skeleton className="h-28 rounded-xl" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <Skeleton className="h-96 rounded-xl xl:col-span-7" />
        <Skeleton className="h-96 rounded-xl xl:col-span-5" />
      </div>
    </div>
  );
}
