import { Suspense } from "react";
import { MeterDetail } from "@/packs/utility-bills-to-yardi/ui/meter-detail";
export default async function Page({ params }: { params: Promise<{ meterId: string }> }) {
  const { meterId } = await params;
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading the meter.</p>}>
      <MeterDetail meterId={meterId} />
    </Suspense>
  );
}
