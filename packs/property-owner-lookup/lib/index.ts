export type { NormalizedAddress, ParcelRecord, ParcelStatus, ResolveInput, ResolveMethod, Resolution } from "./types";
export { loadParcels, parcelById } from "./registry";
export { normalizeAddress, KNOWN_CITIES } from "./normalize";
export { resolveParcel, findParcelText, searchParcels, normalizeParcelId } from "./resolve";
export { HOLDING_COMPANIES, OPERATING_COMPANY, SCRIPTED_PARCELS, NOT_IN_SYSTEM_LIST } from "./scripted";
export { entityList, entityForOwner, type Entity } from "./entities";
export type { LookupView } from "./lookup";
export { lookupView } from "./lookup";
