import type { Metadata } from "next";
import { Suspense } from "react";

import { CategoryManager } from "@/components/admin/category-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth-guards";
import { listCategoriesAdmin } from "@/server/categories";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-ivory">Categories</h1>
      <Suspense fallback={<Skeleton className="h-64 bg-obsidian-raised" />}>
        <Categories />
      </Suspense>
    </div>
  );
}

async function Categories() {
  await requireAdmin();
  const categories = await listCategoriesAdmin();
  return <CategoryManager categories={categories} />;
}
