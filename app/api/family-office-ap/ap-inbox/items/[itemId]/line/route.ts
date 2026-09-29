import { fail } from "@/lib/api";
import { getStore } from "@/packs/ap-inbox/store";
import { setLineAmount } from "@/packs/ap-inbox/lib/actions";
import { dollarsToCents } from "@/packs/ap-inbox/lib/money";
import { num, readBody, run, str, type ItemParams } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: ItemParams) {
  const { itemId } = await params;
  const body = await readBody<{ lineNumber: number; amount: string }>(req);
  const cents = dollarsToCents(str(body.amount));
  if (cents === null) return fail("Enter the amount as dollars and cents, like 50.00");
  return run(() => setLineAmount(getStore(), itemId, num(body.lineNumber), cents));
}
