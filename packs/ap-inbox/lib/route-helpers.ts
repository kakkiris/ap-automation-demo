import { fail, json } from "@/lib/api";
import { ActionError } from "./actions";

// Shared by the route handlers: run an action and answer with json, or fail with the
// action's plain-word message.

export async function run(fn: () => unknown | Promise<unknown>): Promise<Response> {
  try {
    return json(await fn());
  } catch (err) {
    if (err instanceof ActionError) return fail(err.message, err.status);
    return fail("Something went wrong on our side. Try again or reset the demo.", 500);
  }
}

/** The JSON body of a request, or an empty object when there is none. */
export async function readBody<T extends Record<string, unknown>>(req: Request): Promise<Partial<T>> {
  try {
    const text = await req.text();
    return text ? (JSON.parse(text) as Partial<T>) : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown): string => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
export const num = (v: unknown): number => (typeof v === "number" ? v : parseInt(str(v), 10));

export type ItemParams = { params: Promise<{ itemId: string }> };
