"use client";
import { usePathname } from "next/navigation";
import { locate } from "@/lib/registry";

// Sets data-department on the content column so the department's hue becomes the
// primary color, the ring, and the narration rule for everything inside it.
export function DepartmentScope({ children }: { children: React.ReactNode }) {
  const here = locate(usePathname());
  return (
    <div data-department={here?.department.slug ?? undefined} className="flex min-h-svh flex-1 flex-col">
      {children}
    </div>
  );
}
