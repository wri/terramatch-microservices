export const ORGANISATION_TYPES = ["for-profit-organization", "non-profit-organization"];
export const LANDSCAPE_TYPES = ["Ghana Cocoa Belt", "Greater Rift Valley of Kenya", "Lake Kivu & Rusizi River Basin"];
export const FRAMEWORK_TF_TYPES = ["terrafund", "terrafund-landscapes", "enterprises"];
export type OrganisationType = (typeof ORGANISATION_TYPES)[number];
export type LandscapeType = (typeof LANDSCAPE_TYPES)[number];
export type FrameworkType = (typeof FRAMEWORK_TF_TYPES)[number];
