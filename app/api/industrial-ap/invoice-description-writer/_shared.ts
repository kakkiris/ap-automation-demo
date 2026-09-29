// Not a route: shared error handling for this pack's route handlers.
import { fail } from "@/lib/api";
import { PackError } from "@/packs/invoice-description-writer/lib/errors";

/** Turns a thrown PackError into a plain failure with its status; anything else is a 500 with its message. */
export function failFrom(err: unknown): Response {
  if (err instanceof PackError) return fail(err.message, err.status);
  return fail(err instanceof Error ? err.message : "Something went wrong.", 500);
}
