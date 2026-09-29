"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Home } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { departments, locate, moduleHref, navScreens, screenHref, type Module } from "@/lib/registry";
import { moduleIcon } from "./module-icons";
import { ResetButton } from "./reset-button";
import { useExpandedModule } from "./shell-state";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const here = locate(pathname);
  const [stored, setStored] = useExpandedModule();
  // One module open at a time: the one the presenter is in, else the one last opened.
  const expanded = here && !here.module.entry ? here.module.slug : stored;
  useEffect(() => {
    if (here && !here.module.entry && stored !== here.module.slug) setStored(here.module.slug);
  }, [here, stored, setStored]);

  function openModule(m: Module) {
    if (!m.entry) setStored(m.slug);
    router.push(moduleHref(m));
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/" />} isActive={pathname === "/"} tooltip="Demo home">
              <Home />
              <span>Demo home</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {departments.map((dept) => (
          <SidebarGroup key={dept.slug} data-department={dept.slug}>
            <SidebarGroupLabel className="gap-2 text-foreground">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px] bg-dept" />
              {dept.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dept.modules.map((m) => {
                  const Icon = moduleIcon(m.slug);
                  const isHere = here?.module.slug === m.slug;
                  const isOpen = !m.entry && expanded === m.slug;
                  return (
                    <SidebarMenuItem key={m.slug}>
                      <SidebarMenuButton isActive={isHere} tooltip={m.name} onClick={() => openModule(m)} data-module={m.slug}>
                        <Icon />
                        <span>{m.name}</span>
                      </SidebarMenuButton>
                      {isOpen && (
                        <SidebarMenuSub>
                          {navScreens(m).map((s) => {
                            const href = screenHref(m, s.slug);
                            const active = isHere && here?.screen?.slug === s.slug;
                            return (
                              <SidebarMenuSubItem key={s.slug}>
                                <SidebarMenuSubButton render={<Link href={href} data-screen={s.slug} />} isActive={active}>
                                  <span>{s.label}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {here ? (
              <ResetButton resetPath={here.module.resetPath} label="Reset this demo" className="w-full justify-start group-data-[collapsible=icon]:hidden" />
            ) : (
              <span className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Open a demo to reset it.</span>
            )}
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/run-sheet" />} tooltip="Presenter run sheet">
              <BookOpen />
              <span>Presenter run sheet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
