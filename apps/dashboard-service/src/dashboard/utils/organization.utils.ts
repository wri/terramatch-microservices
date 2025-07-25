export function assignOrganizationUrl(url: string | null | undefined): string | undefined {
  return url != null && url !== "" ? url : undefined;
}

export function createOrganizationUrls(org: {
  name?: string | null;
  countries?: string[] | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
}) {
  return {
    name: org.name ?? "",
    countries: Array.isArray(org.countries)
      ? org.countries
          .filter((c: string) => c != null && c !== "")
          .map((c: string) => ({ label: c, icon: c !== "" ? `/flags/${c.toLowerCase()}.svg` : null }))
      : [],
    facebook_url: assignOrganizationUrl(org.facebookUrl),
    instagram_url: assignOrganizationUrl(org.instagramUrl),
    linkedin_url: assignOrganizationUrl(org.linkedinUrl),
    twitter_url: assignOrganizationUrl(org.twitterUrl)
  };
}
