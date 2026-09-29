import { Suspense } from "react";
import { Master } from "@/packs/utility-bills-to-yardi/ui/master";
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Master />
    </Suspense>
  );
}
