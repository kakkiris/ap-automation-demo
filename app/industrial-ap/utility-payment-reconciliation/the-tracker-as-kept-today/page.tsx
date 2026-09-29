import { Suspense } from "react";
import { Today } from "@/packs/utility-bills-to-yardi/ui/today";
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Today />
    </Suspense>
  );
}
