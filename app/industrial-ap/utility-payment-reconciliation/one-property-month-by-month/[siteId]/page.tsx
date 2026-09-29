import { SiteGrid } from "@/packs/utility-bills-to-yardi/ui/site-grid";
export default async function Page({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <SiteGrid siteId={siteId} />;
}
