// The suite registry: two departments, their modules in presentation order, and each
// module's screens in the order the work happens. Module and screen slugs are the only
// identifiers used in routes, folders, and names; display names are the client's words.
import { utilityBillsToYardiPack, meterRegisterPack, utilityPaymentReconciliationPack } from "@/packs/utility-bills-to-yardi/module";
import { invoiceDescriptionWriterPack } from "@/packs/invoice-description-writer/module";
import { vendorCreatorToAvidPack } from "@/packs/vendor-creator-to-avid/module";
import { apInboxPack, multiPropertySplitPack } from "@/packs/ap-inbox/module";
import { propertyOwnerLookupPack } from "@/packs/property-owner-lookup/module";

export type DepartmentSlug = "family-office-ap" | "industrial-ap";

/** How this demo relates to a system the client already runs. */
export type SystemRole = "reads" | "receives" | "replaces" | "unchanged";

export interface SystemRef {
  /** The platform as the team names it: Monday.com, Yardi, Avid, the parcel database. */
  name: string;
  role: SystemRole;
  /** A short phrase saying what passes between them. */
  note: string;
}

export interface Screen {
  /** kebab-case of the label; the last route segment */
  slug: string;
  /** the step in the client's words */
  label: string;
  /** false for detail screens reached by clicking, never listed in the sidebar */
  nav?: boolean;
  /** name of the dynamic segment that follows the slug, e.g. "itemId" */
  param?: string;
  /** Systems this screen touches, when they differ from the module's. */
  systems?: SystemRef[];
}

export interface Module {
  slug: string;
  /** display name without the department prefix */
  name: string;
  department: DepartmentSlug;
  /** one sentence on what it does, from the pack's "What we are demoing" */
  sentence: string;
  base: string;
  apiBase: string;
  resetPath: string;
  screens: Screen[];
  /** when set, the sidebar entry is a plain link here instead of expanding screens */
  entry?: string;
  /** the utility module keeps the two seats; nothing else has seats */
  seats?: boolean;
  /** modules that share one store and one reset (the three utility modules) */
  sharesStoreWith?: string[];
  /** The systems this module would read from and write to. Nothing is connected in the demo. */
  systems: SystemRef[];
}

export interface Department {
  slug: DepartmentSlug;
  label: string;
  blurb: string;
  modules: Module[];
}

export const departments: Department[] = [
  {
    slug: "family-office-ap",
    label: "Family Office AP",
    blurb: "Accounts payable for the family office: invoices, parcels, owners, and the property tracker.",
    modules: [propertyOwnerLookupPack, multiPropertySplitPack, apInboxPack],
  },
  {
    slug: "industrial-ap",
    label: "Industrial AP",
    blurb: "Accounts payable for the industrial portfolio: utility bills, meters, descriptions, and vendors.",
    modules: [utilityBillsToYardiPack, meterRegisterPack, utilityPaymentReconciliationPack, invoiceDescriptionWriterPack, vendorCreatorToAvidPack],
  },
];

export const modules: Module[] = departments.flatMap((d) => d.modules);

export function findDepartment(slug: string): Department | undefined {
  return departments.find((d) => d.slug === slug);
}

export function findModule(slug: string): Module | undefined {
  return modules.find((m) => m.slug === slug);
}

export function departmentOf(module: Module): Department {
  return departments.find((d) => d.slug === module.department)!;
}

/** Screens shown in the sidebar, in work order. */
export function navScreens(module: Module): Screen[] {
  return module.screens.filter((s) => s.nav !== false);
}

export function firstScreen(module: Module): Screen {
  return navScreens(module)[0] ?? module.screens[0];
}

export function screenHref(module: Module, screenSlug: string, param?: string): string {
  const s = module.screens.find((x) => x.slug === screenSlug);
  if (!s) return module.base;
  return param ? `${module.base}/${s.slug}/${encodeURIComponent(param)}` : `${module.base}/${s.slug}`;
}

/** The module's landing: its entry link when it has one, else its first screen. */
export function moduleHref(module: Module): string {
  return module.entry ?? screenHref(module, firstScreen(module).slug);
}

/** Resolve a pathname to the module and screen it belongs to. */
export function locate(pathname: string): { department: Department; module: Module; screen: Screen | null } | null {
  for (const m of modules) {
    if (pathname === m.base || pathname.startsWith(`${m.base}/`)) {
      const rest = pathname.slice(m.base.length + 1);
      const seg = rest.split("/")[0] ?? "";
      const screen = m.screens.find((s) => s.slug === seg) ?? null;
      return { department: departmentOf(m), module: m, screen };
    }
  }
  return null;
}

/** The systems to show on a screen: the screen's own list, else the module's. */
export function systemsFor(module: Module, screen?: Screen | null): SystemRef[] {
  return screen?.systems ?? module.systems;
}

/** Every distinct reset route, once (the utility modules share one). */
export function resetPaths(): { label: string; path: string }[] {
  const seen = new Set<string>();
  const out: { label: string; path: string }[] = [];
  for (const m of modules) {
    if (seen.has(m.resetPath)) continue;
    seen.add(m.resetPath);
    out.push({ label: m.name, path: m.resetPath });
  }
  return out;
}
