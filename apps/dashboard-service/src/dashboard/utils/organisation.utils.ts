export function assignOrganisationUrl(url: string | null | undefined): string | undefined {
  return url != null && url !== "" ? url : undefined;
}

export function createOrganisationUrls(org: {
  name?: string | null;
  countries?: string[] | null;
  facebookUrl?: string | undefined;
  instagramUrl?: string | undefined;
  linkedinUrl?: string | undefined;
  twitterUrl?: string | undefined;
}) {
  return {
    name: org.name ?? "",
    countries: Array.isArray(org.countries)
      ? org.countries
          .filter((c: string) => c != null && c !== "")
          .map((c: string) => ({ label: c, icon: c !== "" ? `/flags/${c.toLowerCase()}.svg` : null }))
      : [],
    facebook_url: assignOrganisationUrl(org.facebookUrl),
    instagram_url: assignOrganisationUrl(org.instagramUrl),
    linkedin_url: assignOrganisationUrl(org.linkedinUrl),
    twitter_url: assignOrganisationUrl(org.twitterUrl)
  };
}
