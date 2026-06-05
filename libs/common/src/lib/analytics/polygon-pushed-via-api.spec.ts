import { buildSitePolygonPushedViaApiParams, isApiPartnerSource } from "./polygon-pushed-via-api";

describe("polygon-pushed-via-api", () => {
  describe("isApiPartnerSource", () => {
    it("returns false for terramatch UI source", () => {
      expect(isApiPartnerSource("terramatch")).toBe(false);
    });

    it("returns true for partner API sources", () => {
      expect(isApiPartnerSource("greenhouse")).toBe(true);
      expect(isApiPartnerSource("research")).toBe(true);
    });
  });

  describe("buildSitePolygonPushedViaApiParams", () => {
    it("builds GA4 params for a site polygon", () => {
      expect(
        buildSitePolygonPushedViaApiParams({ siteUuid: "site-123", polygonUuid: "polygon-456" }, "greenhouse")
      ).toEqual({
        entity_type: "site",
        entity_id: "site-123",
        polygon_id: "polygon-456",
        source: "api",
        partner_id: "greenhouse"
      });
    });

    it("returns null when required identifiers are missing", () => {
      expect(
        buildSitePolygonPushedViaApiParams({ siteUuid: null, polygonUuid: "polygon-456" }, "greenhouse")
      ).toBeNull();
      expect(buildSitePolygonPushedViaApiParams({ siteUuid: "site-123", polygonUuid: null }, "greenhouse")).toBeNull();
    });
  });
});
