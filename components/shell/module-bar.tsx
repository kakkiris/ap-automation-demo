// A slim bar under the top bar for a module's own controls (seat switch, mode toggle).
// Renders nothing when the module has no controls.
export function ModuleBar({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="border-b bg-card/70">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-6 py-2 text-sm">{children}</div>
    </div>
  );
}
