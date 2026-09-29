"use client";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebarOpen } from "./shell-state";

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useSidebarOpen();
  return (
    <TooltipProvider>
      <SidebarProvider open={open} onOpenChange={setOpen}>
        {children}
      </SidebarProvider>
    </TooltipProvider>
  );
}
