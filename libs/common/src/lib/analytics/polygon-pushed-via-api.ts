export const POLYGON_PUSHED_VIA_API_EVENT = "polygon_pushed_via_api";

export type PolygonPushedViaApiParams = {
  entity_type: string;
  entity_id: string;
  polygon_id: string;
  polygon_source: "api";
  partner_id: string;
};

/** Skip terramatch (UI / Postman session). All other sources (e.g. greenhouse, research) fire polygon_pushed_via_api. */
export const isApiPartnerSource = (source: string): boolean => source !== "terramatch";

export const buildSitePolygonPushedViaApiParams = (sitePolygon: {
  siteUuid: string | null;
  polygonUuid: string | null;
  polygon_source: string | null;
}): PolygonPushedViaApiParams | null => {
  const { siteUuid, polygonUuid, polygon_source: partnerName } = sitePolygon;
  if (siteUuid == null || polygonUuid == null || partnerName == null || !isApiPartnerSource(partnerName)) {
    return null;
  }

  return {
    entity_type: "site",
    entity_id: siteUuid,
    polygon_id: polygonUuid,
    polygon_source: "api",
    partner_id: partnerName
  };
};
