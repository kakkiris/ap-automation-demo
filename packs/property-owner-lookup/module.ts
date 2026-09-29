import type { Module } from "@/lib/registry";

// Shared by AP Inbox, the splitter, and later the legal line coder: one code module,
// imported by the others, and a module of its own with a lookup screen.
export const propertyOwnerLookupPack: Module = {
  slug: "property-owner-lookup",
  name: "Property Owner Lookup",
  department: "family-office-ap",
  sentence: "An address or a parcel number in, one owner record out, with the entity and cash account an invoice for that property should carry.",
  base: "/family-office-ap/property-owner-lookup",
  apiBase: "/api/family-office-ap/property-owner-lookup",
  resetPath: "/api/family-office-ap/property-owner-lookup/reset",
  systems: [
    { name: "Parcel database", role: "reads", note: "the parcel, its owner, the lien status and the lender" },
    { name: "Yardi", role: "reads", note: "the entity code and cash account behind each owner" },
    { name: "Legacy property system", role: "replaces", note: "the lookup typed in by hand, being retired" },
  ],
  screens: [
    { slug: "look-up-an-owner", label: "Look up an owner" },
    {
      slug: "owner-to-entity-map",
      label: "Owner to entity map",
      systems: [
        { name: "Yardi", role: "reads", note: "the entity code and cash account for each owner" },
        { name: "Parcel database", role: "reads", note: "how many parcels each owner holds" },
      ],
    },
  ],
};
