"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { locate, navScreens, screenHref } from "@/lib/registry";

// [ and ] move between the screens of the open module, in work order.
export function KeyboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "[" && e.key !== "]") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const here = locate(pathname);
      if (!here) return;
      const screens = navScreens(here.module);
      if (screens.length === 0) return;
      let idx = screens.findIndex((s) => s.slug === here.screen?.slug);
      if (idx < 0) {
        // A detail screen (One property, month by month; One meter's history) is not in the
        // sidebar list, so step from where it sits among all the module's screens instead of
        // falling back to the first one.
        const all = here.module.screens;
        const at = all.findIndex((s) => s.slug === here.screen?.slug);
        const before = all.slice(0, at < 0 ? 0 : at).filter((s) => s.nav !== false);
        idx = before.length - 1;
      }
      const next = e.key === "]" ? Math.min(screens.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (next === idx || next < 0) return;
      e.preventDefault();
      router.push(screenHref(here.module, screens[next].slug));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);
  return null;
}
