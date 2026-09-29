import { AnnotationsProvider } from "@/components/shell/annotations";
import { ModuleBar } from "@/components/shell/module-bar";
import { ModeProvider } from "@/packs/vendor-creator-to-avid/ui/mode";
import { ModeBar } from "@/packs/vendor-creator-to-avid/ui/mode-bar";
export default function ModuleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AnnotationsProvider>
      <ModeProvider>
      <ModuleBar><ModeBar /></ModuleBar>
      <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
      </ModeProvider>
    </AnnotationsProvider>
  );
}
