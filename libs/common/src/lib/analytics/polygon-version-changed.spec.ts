import {
  DUPLICATE_VERSION_CHANGE_REASON,
  GEOMETRY_UPLOAD_CHANGE_REASON,
  buildPolygonVersionChangedParams,
  isAdminSessionFromRoles,
  resolvePolygonVersionChangeSource
} from "./polygon-version-changed";

describe("polygon-version-changed", () => {
  describe("isAdminSessionFromRoles", () => {
    it("returns true for admin roles", () => {
      expect(isAdminSessionFromRoles([{ name: "admin-terrafund" }])).toBe(true);
    });

    it("returns false for non-admin roles", () => {
      expect(isAdminSessionFromRoles([{ name: "project-developer" }])).toBe(false);
    });
  });

  describe("resolvePolygonVersionChangeSource", () => {
    it("returns duplicate for duplicate version change reason", () => {
      expect(
        resolvePolygonVersionChangeSource({
          changeReason: DUPLICATE_VERSION_CHANGE_REASON,
          newPolygonGeometryUuid: null,
          isAdminSession: true
        })
      ).toBe("duplicate");
    });

    it("returns api_push for non-terramatch sources", () => {
      expect(
        resolvePolygonVersionChangeSource({
          changeReason: "Geometry updated",
          newPolygonGeometryUuid: "geometry-uuid",
          source: "greenhouse"
        })
      ).toBe("api_push");
    });

    it("returns geometry_upload for geometry file upload change reason", () => {
      expect(
        resolvePolygonVersionChangeSource({
          changeReason: `${GEOMETRY_UPLOAD_CHANGE_REASON} - extra detail`,
          newPolygonGeometryUuid: "geometry-uuid",
          source: "terramatch"
        })
      ).toBe("geometry_upload");
    });

    it("returns admin_action for admin attribute edits", () => {
      expect(
        resolvePolygonVersionChangeSource({
          changeReason: "Updated polygon attributes from admin panel",
          newPolygonGeometryUuid: null,
          source: "terramatch",
          isAdminSession: true
        })
      ).toBe("admin_action");
    });

    it("returns shape_edit for non-admin geometry edits", () => {
      expect(
        resolvePolygonVersionChangeSource({
          changeReason: "Shape updated on map",
          newPolygonGeometryUuid: "geometry-uuid",
          source: "terramatch",
          isAdminSession: false
        })
      ).toBe("shape_edit");
    });

    it("returns attribute_edit for non-admin attribute-only edits", () => {
      expect(
        resolvePolygonVersionChangeSource({
          changeReason: "Updated attributes",
          newPolygonGeometryUuid: null,
          source: "terramatch",
          isAdminSession: false
        })
      ).toBe("attribute_edit");
    });
  });

  describe("buildPolygonVersionChangedParams", () => {
    it("builds params with primaryUuid as polygon_id", () => {
      const params = buildPolygonVersionChangedParams(
        {
          uuid: "previous-version-uuid",
          primaryUuid: "primary-group-uuid",
          siteUuid: "site-uuid"
        },
        { uuid: "new-version-uuid" },
        {
          changeReason: "Updated attributes",
          newPolygonGeometryUuid: null,
          source: "terramatch"
        }
      );

      expect(params).toEqual({
        polygon_id: "primary-group-uuid",
        entity_id: "site-uuid",
        entity_type: "site",
        previous_version: "previous-version-uuid",
        new_version: "new-version-uuid",
        change_source: "attribute_edit"
      });
    });

    it("returns null when required identifiers are missing", () => {
      expect(
        buildPolygonVersionChangedParams(
          { uuid: "previous-version-uuid", primaryUuid: null, siteUuid: "site-uuid" },
          { uuid: "new-version-uuid" },
          { changeReason: "Updated attributes", newPolygonGeometryUuid: null }
        )
      ).toBeNull();
    });
  });
});
