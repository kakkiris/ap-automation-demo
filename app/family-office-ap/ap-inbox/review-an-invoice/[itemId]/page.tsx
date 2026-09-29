import { Review } from "@/packs/ap-inbox/ui/review";

export default async function Page({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return <Review itemId={itemId} />;
}
