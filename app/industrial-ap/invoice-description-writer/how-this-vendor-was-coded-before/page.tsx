import { Suspense } from "react";
import { VendorHistory } from "@/packs/invoice-description-writer/ui/vendor-history";
export default function Page() {
  return (
    <Suspense fallback={null}>
      <VendorHistory />
    </Suspense>
  );
}
