import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/vendor-creator-to-avid/store";
import { runPayload, setTaskDone } from "@/packs/vendor-creator-to-avid/lib/sync";
import type { TaskDoneBody } from "@/packs/vendor-creator-to-avid/lib/types";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<TaskDoneBody>;
  if (typeof body.task_id !== "string" || typeof body.done !== "boolean") return fail("task_id and done are required");
  try {
    const store = getStore();
    setTaskDone(store, body.task_id, body.done);
    return json(runPayload(store));
  } catch (err) {
    return fail((err as Error).message, 404);
  }
}
