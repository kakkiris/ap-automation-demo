import { json } from "@/lib/api";
export const dynamic = "force-dynamic";
// The lookup keeps no session state; reset is a no-op kept so every module has one.
export async function POST() {
  return json({ ok: true });
}
