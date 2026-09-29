import { DemoHome } from "@/components/shell/demo-home";

export default async function Home({ searchParams }: { searchParams: Promise<{ department?: string }> }) {
  const { department } = await searchParams;
  return <DemoHome department={department} />;
}
