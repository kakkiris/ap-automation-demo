"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { locate, moduleHref } from "@/lib/registry";
import { LookupPanel } from "@/packs/property-owner-lookup/ui/lookup-panel";

// A slim bar: the sidebar trigger, the breadcrumb with the department as an index tab,
// and on Family Office screens the Property Owner Lookup button that opens the lookup anywhere.
export function TopBar() {
  const pathname = usePathname();
  const here = locate(pathname);
  return (
    <header className="sticky top-0 z-20 flex h-11 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
      <SidebarTrigger aria-label="Toggle the sidebar" />
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {!here ? (
          <span className="text-muted-foreground">Demo home</span>
        ) : (
          <>
            <Link href={`/?department=${here.department.slug}`} className="rounded-md bg-dept-soft px-2 py-0.5 text-xs font-medium text-dept hover:underline">
              {here.department.label}
            </Link>
            <span className="text-muted-foreground/60">/</span>
            <Link href={moduleHref(here.module)} className="truncate text-foreground/80 hover:underline">
              {here.module.name}
            </Link>
            {here.screen && (
              <>
                <span className="text-muted-foreground/60">/</span>
                <span className="truncate font-medium" aria-current="page">
                  {here.screen.label}
                </span>
              </>
            )}
          </>
        )}
      </nav>
      {here?.department.slug === "family-office-ap" && (
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" size="sm" className="ml-auto">
                <Search />
                Property Owner Lookup
              </Button>
            }
          />
          <SheetContent side="right" className="w-[520px] sm:max-w-[520px]">
            <SheetHeader>
              <SheetTitle>Property Owner Lookup</SheetTitle>
              <SheetDescription>An address or a parcel number in, one owner record out.</SheetDescription>
            </SheetHeader>
            <div className="px-4">
              <LookupPanel autoFocus />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </header>
  );
}
