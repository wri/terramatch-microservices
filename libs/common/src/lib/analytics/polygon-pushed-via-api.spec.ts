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
    it("sets partner_id from site_polygon.source for greenhouse", () => {
      expect(
        buildSitePolygonPushedViaApiParams({
          siteUuid: "site-123",
          polygonUuid: "polygon-456",
          source: "greenhouse"
        })
      ).toEqual({
        entity_type: "site",
        entity_id: "site-123",
        polygon_id: "polygon-456",
        source: "api",
        partner_id: "greenhouse"
      });
    });

    it("sets partner_id from site_polygon.source for research", () => {
      expect(
        buildSitePolygonPushedViaApiParams({
          siteUuid: "site-123",
          polygonUuid: "polygon-456",
          source: "research"
        })?.partner_id
      ).toBe("research");
    });

    it("returns null for terramatch source", () => {
      expect(
        buildSitePolygonPushedViaApiParams({
          siteUuid: "site-123",
          polygonUuid: "polygon-456",
          source: "terramatch"
        })
      ).toBeNull();
    });

    it("returns null when required identifiers are missing", () => {
      expect(
        buildSitePolygonPushedViaApiParams({ siteUuid: null, polygonUuid: "polygon-456", source: "greenhouse" })
      ).toBeNull();
      expect(
        buildSitePolygonPushedViaApiParams({ siteUuid: "site-123", polygonUuid: null, source: "greenhouse" })
      ).toBeNull();
      expect(
        buildSitePolygonPushedViaApiParams({ siteUuid: "site-123", polygonUuid: "polygon-456", source: null })
      ).toBeNull();
    });
  });
});
