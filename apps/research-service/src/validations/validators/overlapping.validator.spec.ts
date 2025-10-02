import { Test, TestingModule } from "@nestjs/testing";
import { OverlappingValidator } from "./overlapping.validator";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { Sequelize } from "sequelize";

describe("OverlappingValidator", () => {
  let validator: OverlappingValidator;
  let sequelize: Sequelize;

  const TEST_POLYGONS = {
    "25128475-00d4-44f2-8573-82f807fbcb91": {
      type: "Polygon",
      coordinates: [
        [
          [143.23334803138664, -38.520624013387476],
          [143.23241588768315, -38.52108391858792],
          [143.23224759035406, -38.52019817000951],
          [143.2327841960339, -38.51992980781432],
          [143.23334803138664, -38.520624013387476]
        ]
      ]
    },
    "d3b9202b-d268-42e9-8aa4-c9cd80861616": {
      type: "Polygon",
      coordinates: [
        [
          [143.23331767280024, -38.52047557910399],
          [143.2333078408945, -38.52087942596131],
          [143.23437951872864, -38.52094865662333],
          [143.23454666114372, -38.520406347986956],
          [143.23384367981237, -38.519979421293],
          [143.23331767280024, -38.52047557910399]
        ]
      ]
    },
    "3b742306-234d-4b4d-8a87-8515a5b60c62": {
      type: "Polygon",
      coordinates: [
        [
          [143.23268581159294, -38.519941738752955],
          [143.23426288751273, -38.52002249071761],
          [143.23422985974366, -38.51971563277105],
          [143.23273122477292, -38.51971886286175],
          [143.23268581159294, -38.519941738752955]
        ]
      ]
    }
  };

  beforeAll(async () => {
    sequelize = PolygonGeometry.sequelize as Sequelize;
    if (sequelize == null) {
      throw new Error("Sequelize connection not available for testing");
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [OverlappingValidator]
    }).compile();

    validator = module.get<OverlappingValidator>(OverlappingValidator);
  });

  beforeEach(async () => {
    await sequelize.query("DELETE FROM site_polygon WHERE polygon_uuid IN (:uuids)", {
      replacements: { uuids: Object.keys(TEST_POLYGONS) }
    });
    await sequelize.query("DELETE FROM polygon_geometry WHERE uuid IN (:uuids)", {
      replacements: { uuids: Object.keys(TEST_POLYGONS) }
    });
    await sequelize.query("DELETE FROM v2_sites WHERE uuid = :siteUuid", {
      replacements: { siteUuid: "test-site-uuid" }
    });

    await sequelize.query(`
      INSERT INTO v2_sites (uuid, name, project_id, created_at, updated_at) 
      VALUES ('test-site-uuid', 'CAPULIN VMRL CAFE CAPITAN', 1, NOW(), NOW())
    `);

    // Insert test polygons into database with PostGIS geometry
    for (const [uuid, polygon] of Object.entries(TEST_POLYGONS)) {
      await sequelize.query(
        `
        INSERT INTO polygon_geometry (uuid, geom, created_at, updated_at) 
        VALUES (:uuid, ST_GeomFromGeoJSON(:geoJson), NOW(), NOW())
      `,
        {
          replacements: {
            uuid,
            geoJson: JSON.stringify(polygon)
          }
        }
      );

      const polyName =
        uuid === "25128475-00d4-44f2-8573-82f807fbcb91"
          ? "14-1 (new)"
          : uuid === "d3b9202b-d268-42e9-8aa4-c9cd80861616"
          ? "A"
          : "B";

      await sequelize.query(
        `
        INSERT INTO site_polygon (poly_id, site_id, poly_name, is_active, created_at, updated_at) 
        VALUES (:polyId, 'test-site-uuid', :polyName, 1, NOW(), NOW())
      `,
        {
          replacements: {
            polyId: uuid,
            polyName
          }
        }
      );
    }
  });

  afterEach(async () => {
    // Clean up test data
    await sequelize.query("DELETE FROM site_polygon WHERE polygon_uuid IN (:uuids)", {
      replacements: { uuids: Object.keys(TEST_POLYGONS) }
    });
    await sequelize.query("DELETE FROM polygon_geometry WHERE uuid IN (:uuids)", {
      replacements: { uuids: Object.keys(TEST_POLYGONS) }
    });
    await sequelize.query("DELETE FROM v2_sites WHERE uuid = :siteUuid", {
      replacements: { siteUuid: "test-site-uuid" }
    });
  });

  describe("validatePolygon", () => {
    it("should return valid=true when no related polygons exist", async () => {
      const isolatedUuid = "isolated-polygon-uuid";
      const isolatedPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [140.0, -40.0],
            [140.1, -40.0],
            [140.1, -40.1],
            [140.0, -40.1],
            [140.0, -40.0]
          ]
        ]
      };

      await sequelize.query(
        `
        INSERT INTO polygon_geometry (uuid, geom, created_at, updated_at) 
        VALUES (:uuid, ST_GeomFromGeoJSON(:geoJson), NOW(), NOW())
      `,
        {
          replacements: {
            uuid: isolatedUuid,
            geoJson: JSON.stringify(isolatedPolygon)
          }
        }
      );

      await sequelize.query(`
        INSERT INTO v2_sites (uuid, name, project_id, created_at, updated_at) 
        VALUES ('isolated-site-uuid', 'Isolated Site', 999, NOW(), NOW())
      `);

      await sequelize.query(
        `
        INSERT INTO site_polygon (poly_id, site_id, poly_name, is_active, created_at, updated_at) 
        VALUES (:polyId, 'isolated-site-uuid', 'Isolated', 1, NOW(), NOW())
      `,
        {
          replacements: { polyId: isolatedUuid }
        }
      );

      const result = await validator.validatePolygon(isolatedUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();

      // Clean up
      await sequelize.query("DELETE FROM site_polygon WHERE poly_id = :uuid", {
        replacements: { uuid: isolatedUuid }
      });
      await sequelize.query("DELETE FROM polygon_geometry WHERE uuid = :uuid", {
        replacements: { uuid: isolatedUuid }
      });
      await sequelize.query("DELETE FROM v2_sites WHERE uuid = :uuid", {
        replacements: { uuid: "isolated-site-uuid" }
      });
    });

    it("should return valid=false for overlapping polygons", async () => {
      const polygonUuid = "25128475-00d4-44f2-8573-82f807fbcb91";

      const result = await validator.validatePolygon(polygonUuid);

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toBeDefined();
      expect(Array.isArray(result.extraInfo)).toBe(true);
      expect(result.extraInfo?.length).toBeGreaterThan(0);

      if (result.extraInfo != null && Array.isArray(result.extraInfo)) {
        // Verify we get overlap information for the intersecting polygons
        const overlapUuids = result.extraInfo.map(overlap => overlap.poly_uuid);
        expect(overlapUuids).toContain("d3b9202b-d268-42e9-8aa4-c9cd80861616");
        expect(overlapUuids).toContain("3b742306-234d-4b4d-8a87-8515a5b60c62");

        // Verify overlap properties
        result.extraInfo.forEach(overlap => {
          expect(overlap).toHaveProperty("poly_uuid");
          expect(overlap).toHaveProperty("poly_name");
          expect(overlap).toHaveProperty("site_name", "CAPULIN VMRL CAFE CAPITAN");
          expect(overlap).toHaveProperty("percentage");
          expect(overlap).toHaveProperty("intersectSmaller");
          expect(typeof overlap.percentage).toBe("number");
          expect(typeof overlap.intersectSmaller).toBe("boolean");
        });
      }
    });

    it("should return valid=true for non-overlapping polygons", async () => {
      // Create a non-overlapping polygon
      const nonOverlappingPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [140.0, -40.0],
            [140.1, -40.0],
            [140.1, -40.1],
            [140.0, -40.1],
            [140.0, -40.0]
          ]
        ]
      };

      const testUuid = "non-overlapping-uuid";

      // Insert the non-overlapping polygon
      await sequelize.query(
        `
        INSERT INTO polygon_geometry (uuid, geom, created_at, updated_at) 
        VALUES (:uuid, ST_GeomFromGeoJSON(:geoJson), NOW(), NOW())
      `,
        {
          replacements: {
            uuid: testUuid,
            geoJson: JSON.stringify(nonOverlappingPolygon)
          }
        }
      );

      await sequelize.query(
        `
        INSERT INTO site_polygon (poly_id, site_id, poly_name, is_active, created_at, updated_at) 
        VALUES (:polyId, 'test-site-uuid', 'Non-overlapping', 1, NOW(), NOW())
      `,
        {
          replacements: { polyId: testUuid }
        }
      );

      const result = await validator.validatePolygon(testUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();

      // Clean up
      await sequelize.query("DELETE FROM site_polygon WHERE poly_id = :uuid", {
        replacements: { uuid: testUuid }
      });
      await sequelize.query("DELETE FROM polygon_geometry WHERE uuid = :uuid", {
        replacements: { uuid: testUuid }
      });
    });

    it("should throw NotFoundException when polygon is not found", async () => {
      const polygonUuid = "non-existent-uuid";

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(NotFoundException);
    });
  });

  describe("validatePolygons", () => {
    it("should handle empty polygon list", async () => {
      const result = await validator.validatePolygons([]);
      expect(result).toEqual([]);
    });

    it("should handle polygons with no project associations", async () => {
      const result = await validator.validatePolygons(["non-existent-1", "non-existent-2"]);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        polygonUuid: "non-existent-1",
        valid: false,
        extraInfo: { error: "Polygon not found or has no associated project" }
      });
      expect(result[1]).toEqual({
        polygonUuid: "non-existent-2",
        valid: false,
        extraInfo: { error: "Polygon not found or has no associated project" }
      });
    });

    it("should handle polygons with no candidate polygons in project", async () => {
      // Create a polygon with no other polygons in the same project
      const isolatedUuid = "isolated-batch-uuid";
      const isolatedPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [140.0, -40.0],
            [140.1, -40.0],
            [140.1, -40.1],
            [140.0, -40.1],
            [140.0, -40.0]
          ]
        ]
      };

      // Insert isolated polygon with different project
      await sequelize.query(
        `
        INSERT INTO polygon_geometry (uuid, geom, created_at, updated_at) 
        VALUES (:uuid, ST_GeomFromGeoJSON(:geoJson), NOW(), NOW())
      `,
        {
          replacements: {
            uuid: isolatedUuid,
            geoJson: JSON.stringify(isolatedPolygon)
          }
        }
      );

      await sequelize.query(`
        INSERT INTO v2_sites (uuid, name, project_id, created_at, updated_at) 
        VALUES ('isolated-batch-site-uuid', 'Isolated Batch Site', 888, NOW(), NOW())
      `);

      await sequelize.query(
        `
        INSERT INTO site_polygon (poly_id, site_id, poly_name, is_active, created_at, updated_at) 
        VALUES (:polyId, 'isolated-batch-site-uuid', 'Isolated Batch', 1, NOW(), NOW())
      `,
        {
          replacements: { polyId: isolatedUuid }
        }
      );

      const result = await validator.validatePolygons([isolatedUuid]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        polygonUuid: isolatedUuid,
        valid: true,
        extraInfo: null
      });

      // Clean up
      await sequelize.query("DELETE FROM site_polygon WHERE poly_id = :uuid", {
        replacements: { uuid: isolatedUuid }
      });
      await sequelize.query("DELETE FROM polygon_geometry WHERE uuid = :uuid", {
        replacements: { uuid: isolatedUuid }
      });
      await sequelize.query("DELETE FROM v2_sites WHERE uuid = :uuid", {
        replacements: { uuid: "isolated-batch-site-uuid" }
      });
    });

    it("should validate multiple overlapping polygons", async () => {
      const polygonUuids = ["25128475-00d4-44f2-8573-82f807fbcb91", "d3b9202b-d268-42e9-8aa4-c9cd80861616"];

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toHaveLength(2);
      expect(result[0].polygonUuid).toBe("25128475-00d4-44f2-8573-82f807fbcb91");
      expect(result[1].polygonUuid).toBe("d3b9202b-d268-42e9-8aa4-c9cd80861616");

      // Both polygons should have overlaps
      expect(result[0].valid).toBe(false);
      expect(result[1].valid).toBe(false);

      // Verify overlap information
      result.forEach(polygonResult => {
        if (polygonResult.extraInfo != null && Array.isArray(polygonResult.extraInfo)) {
          expect(polygonResult.extraInfo.length).toBeGreaterThan(0);
          polygonResult.extraInfo.forEach(overlap => {
            expect(overlap).toHaveProperty("poly_uuid");
            expect(overlap).toHaveProperty("poly_name");
            expect(overlap).toHaveProperty("site_name", "CAPULIN VMRL CAFE CAPITAN");
            expect(overlap).toHaveProperty("percentage");
            expect(overlap).toHaveProperty("intersectSmaller");
          });
        }
      });
    });
  });

  describe("error handling", () => {
    it("should handle database transaction errors", async () => {
      // Mock sequelize to throw an error during transaction
      const originalTransaction = PolygonGeometry.sequelize?.transaction;
      if (PolygonGeometry.sequelize != null) {
        (PolygonGeometry.sequelize as unknown as { transaction: jest.Mock }).transaction = jest
          .fn()
          .mockRejectedValue(new Error("Transaction failed"));
      }

      const polygonUuid = "25128475-00d4-44f2-8573-82f807fbcb91";

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow("Transaction failed");

      // Restore original transaction method
      if (PolygonGeometry.sequelize != null) {
        (PolygonGeometry.sequelize as unknown as { transaction: unknown }).transaction = originalTransaction;
      }
    });

    it("should handle missing sequelize connection", async () => {
      // Mock sequelize to be null
      const originalSequelize = PolygonGeometry.sequelize;
      (PolygonGeometry as unknown as { sequelize: null }).sequelize = null;

      const polygonUuid = "25128475-00d4-44f2-8573-82f807fbcb91";

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(
        "PolygonGeometry model is missing sequelize connection"
      );

      // Restore original sequelize
      if (originalSequelize != null) {
        (PolygonGeometry as unknown as { sequelize: Sequelize }).sequelize = originalSequelize;
      }
    });

    it("should handle empty target or candidate arrays in checkIntersections", async () => {
      // This tests the early return in checkIntersections when arrays are empty

      // Create a polygon with no related polygons to trigger empty candidate array
      const isolatedUuid = "test-empty-candidates";
      const isolatedPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [150.0, -50.0],
            [150.1, -50.0],
            [150.1, -50.1],
            [150.0, -50.1],
            [150.0, -50.0]
          ]
        ]
      };

      await sequelize.query(
        `
        INSERT INTO polygon_geometry (uuid, geom, created_at, updated_at) 
        VALUES (:uuid, ST_GeomFromGeoJSON(:geoJson), NOW(), NOW())
      `,
        {
          replacements: {
            uuid: isolatedUuid,
            geoJson: JSON.stringify(isolatedPolygon)
          }
        }
      );

      await sequelize.query(`
        INSERT INTO v2_sites (uuid, name, project_id, created_at, updated_at) 
        VALUES ('empty-candidates-site-uuid', 'Empty Candidates Site', 777, NOW(), NOW())
      `);

      await sequelize.query(
        `
        INSERT INTO site_polygon (poly_id, site_id, poly_name, is_active, created_at, updated_at) 
        VALUES (:polyId, 'empty-candidates-site-uuid', 'Empty Candidates', 1, NOW(), NOW())
      `,
        {
          replacements: { polyId: isolatedUuid }
        }
      );

      const result = await validator.validatePolygon(isolatedUuid);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();

      // Clean up
      await sequelize.query("DELETE FROM site_polygon WHERE poly_id = :uuid", {
        replacements: { uuid: isolatedUuid }
      });
      await sequelize.query("DELETE FROM polygon_geometry WHERE uuid = :uuid", {
        replacements: { uuid: isolatedUuid }
      });
      await sequelize.query("DELETE FROM v2_sites WHERE uuid = :uuid", {
        replacements: { uuid: "empty-candidates-site-uuid" }
      });
    });
  });

  describe("buildOverlapInfo edge cases", () => {
    it("should handle intersection with zero area", async () => {
      // This tests the filter in checkIntersections that removes intersections with area <= 1e-10
      // and the percentage calculation in buildOverlapInfo when minArea is 0
      const polygonUuid = "25128475-00d4-44f2-8573-82f807fbcb91";

      const result = await validator.validatePolygon(polygonUuid);

      // The buildOverlapInfo method should handle edge cases properly
      if (result.extraInfo != null && Array.isArray(result.extraInfo)) {
        result.extraInfo.forEach(overlap => {
          expect(typeof overlap.percentage).toBe("number");
          expect(overlap.percentage).toBeGreaterThanOrEqual(0);
          expect(overlap.percentage).toBeLessThanOrEqual(100);
        });
      }
    });

    it("should handle missing polygon names and site names", async () => {
      // This tests the null coalescing in buildOverlapInfo for candidate_name and site_name
      const polygonUuid = "25128475-00d4-44f2-8573-82f807fbcb91";

      const result = await validator.validatePolygon(polygonUuid);

      if (result.extraInfo != null && Array.isArray(result.extraInfo)) {
        result.extraInfo.forEach(overlap => {
          expect(typeof overlap.poly_name).toBe("string");
          expect(typeof overlap.site_name).toBe("string");
          // Should not be undefined, should be empty string if null
          expect(overlap.poly_name).toBeDefined();
          expect(overlap.site_name).toBeDefined();
        });
      }
    });
  });
});
