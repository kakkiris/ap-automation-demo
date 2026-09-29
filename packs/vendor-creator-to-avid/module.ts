import type { Module } from "@/lib/registry";

export const vendorCreatorToAvidPack: Module = {
  slug: "vendor-creator-to-avid",
  name: "Vendor Creator to Avid",
  department: "industrial-ap",
  sentence: "A vendor is created once in Yardi; the nightly sync creates the clean delta in Avid or hands over an import file, and stops for a person when two names might be the same vendor.",
  base: "/industrial-ap/vendor-creator-to-avid",
  apiBase: "/api/industrial-ap/vendor-creator-to-avid",
  resetPath: "/api/industrial-ap/vendor-creator-to-avid/reset",
  systems: [
    { name: "Yardi", role: "reads", note: "the vendor master, the one place a vendor is typed" },
    { name: "Avid", role: "receives", note: "the new vendors, or an import file and a task list" },
  ],
  screens: [
    { slug: "create-the-vendor-once-in-yardi", label: "Create the vendor once in Yardi" },
    { slug: "run-the-nightly-sync-to-avid", label: "Run the nightly sync to Avid" },
    {
      slug: "decide-the-near-matches",
      label: "Decide the near matches",
      systems: [{ name: "Avid", role: "unchanged", note: "nothing is created until a person decides" }, { name: "Yardi", role: "reads", note: "the vendor that might already be there under another name" }],
    },
    {
      slug: "catch-unknown-payees-on-arrival",
      label: "Catch unknown payees on arrival",
      systems: [
        { name: "Avid", role: "replaces", note: "the research queue an unknown payee waits in today" },
        { name: "Yardi", role: "reads", note: "the vendor master each payee is checked against" },
      ],
    },
  ],
};
