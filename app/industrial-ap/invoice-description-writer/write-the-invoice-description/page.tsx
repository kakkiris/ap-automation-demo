import { Suspense } from "react";
import { Workbench } from "@/packs/invoice-description-writer/ui/workbench";
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Workbench />
    </Suspense>
  );
}
