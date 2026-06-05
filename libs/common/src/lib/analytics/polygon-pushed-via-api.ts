export const POLYGON_PUSHED_VIA_API_EVENT = "polygon_pushed_via_api";

export type PolygonPushedViaApiParams = {
  entity_type: string;
  entity_id: string;
  polygon_id: string;
  source: "api";
  partner_id: string;
};

/** Partner systems push polygons via API; TerraMatch UI uses the browser GA4 tag instead. */
export const isApiPartnerSource = (source: string): boolean => source !== "terramatch";

export const buildSitePolygonPushedViaApiParams = (
  sitePolygon: { siteUuid: string | null; polygonUuid: string | null },
  partnerId: string
): PolygonPushedViaApiParams | null => {
  const { siteUuid, polygonUuid } = sitePolygon;
  if (siteUuid == null || polygonUuid == null) {
    return null;
  }

  return {
    entity_type: "site",
    entity_id: siteUuid,
    polygon_id: polygonUuid,
    source: "api",
    partner_id: partnerId
  };
};
