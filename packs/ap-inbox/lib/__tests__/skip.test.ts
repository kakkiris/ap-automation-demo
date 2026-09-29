import { beforeAll, describe, expect, it } from "vitest";
import { resetStore } from "../../store";
import { arrive, keep, skip } from "../actions";
import { exceptionsView } from "../views";
import type { Store } from "../types";

// Skip and Keep on the possible duplicate I-0009, against the real seed.

describe("skip and keep on the possible duplicate", () => {
  let store: Store;
  beforeAll(async () => {
    store = resetStore();
    await arrive(store);
  });

  const item = (id: string) => store.items.find((i) => i.itemId === id)!;
  const duplicate = (id: string) => store.drafts[id].exceptions.find((e) => e.kind === "possible_duplicate")!;
  const cardsFor = (id: string) => exceptionsView(store).cards.filter((c) => c.itemId === id);

  it("I-0009 starts on the Exceptions screen with four other open cards", () => {
    expect(item("I-0009").state).toBe("Needs attention");
    expect(cardsFor("I-0009")).toHaveLength(1);
    expect(exceptionsView(store).open).toBe(5);
  });

  it("skip resolves the duplicate exception and drops the card from Exceptions", () => {
    const v = skip(store, "I-0009");
    expect(v.item.state).toBe("Skipped");
    expect(item("I-0009").state).toBe("Skipped");
    expect(duplicate("I-0009").resolved).toBe(true);
    expect(duplicate("I-0009").resolution).toBe("Skipped, duplicate of 4471");
    expect(cardsFor("I-0009")).toHaveLength(0);
    expect(exceptionsView(store).open).toBe(4);
  });

  it("every Exceptions card belongs to an item in Needs attention", () => {
    const view = exceptionsView(store);
    expect(view.cards.every((c) => c.state === "Needs attention")).toBe(true);
    expect(view.open).toBe(view.cards.length);
  });

  it("keep after skip returns I-0009 to Drafted with the exception kept, not a duplicate", () => {
    const v = keep(store, "I-0009");
    expect(v.item.state).toBe("Drafted");
    expect(item("I-0009").state).toBe("Drafted");
    expect(duplicate("I-0009").resolved).toBe(true);
    expect(duplicate("I-0009").resolution).toBe("Kept, not a duplicate");
    expect(cardsFor("I-0009")).toHaveLength(0);
    expect(exceptionsView(store).open).toBe(4);
  });
});
