export const ORGANISATION_TYPES = ["for-profit-organization", "non-profit-organization", "government-agency"] as const;
export type OrganisationType = (typeof ORGANISATION_TYPES)[number];
