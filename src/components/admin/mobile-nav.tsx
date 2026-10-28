"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { AdminNav, type NavBadges } from "./admin-nav";

/** Sidebar as a slide-over sheet on small screens. */
export function MobileNav(badges: NavBadges) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open admin menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-border bg-obsidian p-4">
        <SheetHeader className="p-0 pb-6">
          <SheetTitle className="sr-only">Admin menu</SheetTitle>
          <Logo href="/admin" />
        </SheetHeader>
        <AdminNav onNavigate={() => setOpen(false)} {...badges} />
      </SheetContent>
    </Sheet>
  );
}
