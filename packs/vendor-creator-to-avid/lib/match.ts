// The matcher. Pure functions over the two masters: same input, same output, no clock,
// no randomness, no store import. Every outcome carries the reason shown on screen.
//
// Rules, in order, for one active Yardi vendor against the Avid list:
//   1. inactive in Yardi: skip_inactive.
//   2. an Avid vendor with the same normalized name:
//        same address and the same spelling once punctuation is stripped: skip_exact;
//        otherwise hold, with the reasons listed (different address or suffix difference).
//   3. an Avid vendor whose token overlap reaches the threshold: hold as a similar name.
//   4. nothing: stage (assisted) or create (automatic).
// A stored decision on the pair then turns a hold into skip_exact (link) or stage/create (create).

import type { AvidVendor, Decision, DeltaAction, MatchCandidate, MatchReason, Store, SyncMode, YardiVendor } from "./types";
import { MATCH_REASONS } from "./types";
import { NEAR_MATCH_THRESHOLD, sameAddress, sameNormalizedName, suffixDiffers, tokenOverlap } from "./normalize";

export interface Outcome {
  action: DeltaAction;
  reason: string;
  avid_vendor_id: string | null;
  candidate: MatchCandidate | null;
}

/** The slice of the store the matcher reads. */
export type MatchView = Pick<Store, "yardi_vendors" | "avid_vendors" | "match_candidates" | "mode">;

export const REASON_INACTIVE = "inactive in Yardi, not synced";
export const REASON_NO_MATCH = "no match in Avid";
export const REASON_DIFFERENT_BY_HAND = "different vendor, confirmed by hand";

export function exactReason(avidVendorId: string): string {
  return `already in Avid as ${avidVendorId}, same name and address`;
}

export function linkedReason(avidVendorId: string): string {
  return `linked by hand to ${avidVendorId}, same vendor`;
}

function createOrStage(mode: SyncMode): DeltaAction {
  return mode === "automatic" ? "create" : "stage";
}

function taxReason(yardi: YardiVendor, avid: AvidVendor): MatchReason | null {
  if (avid.tax_id_last4 === null) return null;
  return avid.tax_id_last4 === yardi.tax_id_last4 ? MATCH_REASONS.sameTaxLast4 : MATCH_REASONS.differentTaxLast4;
}

function addressReason(yardi: YardiVendor, avid: AvidVendor): MatchReason {
  return sameAddress(yardi.address_line, avid.address_line) ? MATCH_REASONS.sameAddress : MATCH_REASONS.differentAddress;
}

function hold(yardi: YardiVendor, avid: AvidVendor, score: number, reasons: MatchReason[]): Outcome {
  const candidate: MatchCandidate = {
    yardi_vendor_id: yardi.yardi_vendor_id,
    avid_vendor_id: avid.avid_vendor_id,
    score,
    reasons,
    decision: "none",
  };
  return {
    action: "hold",
    reason: `near match with ${avid.avid_vendor_id}: ${reasons.join(", ")}`,
    avid_vendor_id: avid.avid_vendor_id,
    candidate,
  };
}

/** One Yardi vendor against the Avid list, before any human decision. */
export function matchVendor(yardi: YardiVendor, avid: AvidVendor[], mode: SyncMode): Outcome {
  if (yardi.status === "inactive") {
    return { action: "skip_inactive", reason: REASON_INACTIVE, avid_vendor_id: null, candidate: null };
  }

  const exact = avid.find((a) => sameNormalizedName(yardi.name, a.name));
  if (exact) {
    const addressSame = sameAddress(yardi.address_line, exact.address_line);
    const spellingDiffers = suffixDiffers(yardi.name, exact.name);
    if (addressSame && !spellingDiffers) {
      return { action: "skip_exact", reason: exactReason(exact.avid_vendor_id), avid_vendor_id: exact.avid_vendor_id, candidate: null };
    }
    const reasons: MatchReason[] = [MATCH_REASONS.sameNormalizedName, addressReason(yardi, exact)];
    if (spellingDiffers) reasons.push(MATCH_REASONS.suffixDifference);
    const tax = taxReason(yardi, exact);
    if (tax) reasons.push(tax);
    return hold(yardi, exact, 1, reasons);
  }

  let best: AvidVendor | null = null;
  let bestScore = 0;
  for (const a of avid) {
    const score = tokenOverlap(yardi.name, a.name);
    if (score >= NEAR_MATCH_THRESHOLD && score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  if (best) {
    const reasons: MatchReason[] = [MATCH_REASONS.similarName, addressReason(yardi, best)];
    const tax = taxReason(yardi, best);
    if (tax) reasons.push(tax);
    return hold(yardi, best, bestScore, reasons);
  }

  return { action: createOrStage(mode), reason: REASON_NO_MATCH, avid_vendor_id: null, candidate: null };
}

/** A human decision on a held pair. Anything that is not a hold passes through unchanged. */
export function applyDecision(outcome: Outcome, decision: Decision, mode: SyncMode): Outcome {
  if (outcome.action !== "hold" || !outcome.candidate) return outcome;
  const candidate: MatchCandidate = { ...outcome.candidate, decision };
  if (decision === "link") {
    return { action: "skip_exact", reason: linkedReason(candidate.avid_vendor_id), avid_vendor_id: candidate.avid_vendor_id, candidate };
  }
  if (decision === "create") {
    return { action: createOrStage(mode), reason: REASON_DIFFERENT_BY_HAND, avid_vendor_id: null, candidate };
  }
  return { ...outcome, candidate };
}

export function findCandidate(candidates: MatchCandidate[], yardiVendorId: string, avidVendorId: string): MatchCandidate | undefined {
  return candidates.find((c) => c.yardi_vendor_id === yardiVendorId && c.avid_vendor_id === avidVendorId);
}

/** The matcher plus the stored decision for the pair, if there is one. */
export function outcomeFor(view: MatchView, yardi: YardiVendor): Outcome {
  const outcome = matchVendor(yardi, view.avid_vendors, view.mode);
  if (!outcome.candidate) return outcome;
  const stored = findCandidate(view.match_candidates, yardi.yardi_vendor_id, outcome.candidate.avid_vendor_id);
  return stored ? applyDecision(outcome, stored.decision, view.mode) : outcome;
}

/** Active Yardi vendors the sync would stage or create right now. */
export function computeGap(view: MatchView): number {
  let gap = 0;
  for (const v of view.yardi_vendors) {
    if (v.status !== "active") continue;
    const action = outcomeFor(view, v).action;
    if (action === "stage" || action === "create") gap += 1;
  }
  return gap;
}

/** Active Yardi vendors held for a decision right now. */
export function computeHeld(view: MatchView): number {
  let held = 0;
  for (const v of view.yardi_vendors) {
    if (v.status !== "active") continue;
    if (outcomeFor(view, v).action === "hold") held += 1;
  }
  return held;
}
