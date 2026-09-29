import { AnnotationsProvider } from "@/components/shell/annotations";
import { ModuleBar } from "@/components/shell/module-bar";

export default function ModuleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AnnotationsProvider>
      <ModuleBar></ModuleBar>
      <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
    </AnnotationsProvider>
  );
}
