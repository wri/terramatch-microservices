export const ORGANISATION_TYPES = ["for-profit-organization", "non-profit-organization"] as const;
export type OrganisationType = (typeof ORGANISATION_TYPES)[number];
