import { Suspense } from "react";
import { Queue } from "@/packs/utility-bills-to-yardi/ui/queue";
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Queue />
    </Suspense>
  );
}
