import { Skeleton } from "@/components/ui/skeleton";

export function EditorSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-8 w-64 bg-obsidian-raised" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Skeleton className="h-9 w-48 bg-obsidian-raised" />
          <Skeleton className="h-12 bg-obsidian-raised" />
          <Skeleton className="h-96 bg-obsidian-raised" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-56 bg-obsidian-raised" />
          <Skeleton className="h-64 bg-obsidian-raised" />
        </div>
      </div>
    </div>
  );
}
