import { Suspense } from "react";
import { Actions } from "@/packs/utility-bills-to-yardi/ui/actions";
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Actions />
    </Suspense>
  );
}
