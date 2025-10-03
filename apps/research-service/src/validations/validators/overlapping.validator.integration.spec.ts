import { Test, TestingModule } from "@nestjs/testing";
import { OverlappingValidator } from "./overlapping.validator";
import { SitePolygon, PolygonGeometry, Site, Project } from "@terramatch-microservices/database/entities";
import {
  SitePolygonFactory,
  PolygonGeometryFactory,
  SiteFactory,
  ProjectFactory
} from "@terramatch-microservices/database/factories";

describe("OverlappingValidator - Integration Tests", () => {
  let validator: OverlappingValidator;
  let testProject: Project;
  let testSite: Site;
  const testPolygonUuids: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OverlappingValidator]
    }).compile();

    validator = module.get<OverlappingValidator>(OverlappingValidator);

    testProject = await ProjectFactory.create({
      name: "Test Project for Overlapping Validator Integration"
    });

    testSite = await SiteFactory.create({
      projectId: testProject.id,
      name: "CAPULIN VMRL CAFE CAPITAN"
    });

    const testGeometries = [
      {
        type: "Polygon" as const,
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
      {
        type: "Polygon" as const,
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
      {
        type: "Polygon" as const,
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
    ];

    const polygonNames = ["14-1 (new)", "A", "B"];

    for (let i = 0; i < testGeometries.length; i++) {
      const polygonGeometry = await PolygonGeometryFactory.create({
        polygon: testGeometries[i]
      });

      await SitePolygonFactory.create({
        polygonUuid: polygonGeometry.uuid,
        siteUuid: testSite.uuid,
        polyName: polygonNames[i],
        practice: i === 0 ? "tree-planting" : null,
        plantStart: i === 0 ? new Date("2021-11-11") : null,
        numTrees: i === 0 ? null : 0,
        isActive: true
      });

      testPolygonUuids.push(polygonGeometry.uuid);
    }
  });

  afterAll(async () => {
    if (testPolygonUuids.length > 0) {
      await SitePolygon.destroy({
        where: { polygonUuid: testPolygonUuids }
      });
      await PolygonGeometry.destroy({
        where: { uuid: testPolygonUuids }
      });
    }

    if (testSite != null) {
      await Site.destroy({
        where: { uuid: testSite.uuid }
      });
    }

    if (testProject != null) {
      await Project.destroy({
        where: { id: testProject.id }
      });
    }
  });

  describe("Real Database Integration Tests", () => {
    it("should detect real overlaps with actual geometries using real database", async () => {
      const result = await validator.validatePolygon(testPolygonUuids[0]);

      expect(result.valid).toBe(false);
      expect(result.extraInfo).not.toBeNull();
      expect(result.extraInfo).toHaveLength(2);

      const overlapInfo = result.extraInfo;
      if (overlapInfo == null) {
        throw new Error("Expected overlap info to be present");
      }

      const polyUuids = overlapInfo.map(info => info.poly_uuid);
      expect(polyUuids).toContain(testPolygonUuids[1]);
      expect(polyUuids).toContain(testPolygonUuids[2]);

      overlapInfo.forEach(info => {
        expect(info.percentage).toBeGreaterThan(0);
        expect(info.percentage).toBeLessThan(50);
        expect(info.site_name).toBe("CAPULIN VMRL CAFE CAPITAN");
      });
    });

    it("should validate multiple polygons with real database", async () => {
      const results = await validator.validatePolygons(testPolygonUuids);

      expect(results).toHaveLength(3);

      expect(results[0].polygonUuid).toBe(testPolygonUuids[0]);
      expect(results[0].valid).toBe(false);
      expect(results[0].extraInfo).toHaveLength(2);

      expect(results[1].polygonUuid).toBe(testPolygonUuids[1]);
      expect(results[1].valid).toBe(false);
      expect(results[1].extraInfo).toHaveLength(2);

      expect(results[2].polygonUuid).toBe(testPolygonUuids[2]);
      expect(results[2].valid).toBe(false);
      expect(results[2].extraInfo).toHaveLength(2);
    });

    it("should handle non-overlapping polygons correctly", async () => {
      const nonOverlappingGeometry = {
        type: "Polygon" as const,
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

      const polygonGeometry = await PolygonGeometryFactory.create({
        polygon: nonOverlappingGeometry
      });

      const sitePolygon = await SitePolygonFactory.create({
        polygonUuid: polygonGeometry.uuid,
        siteUuid: testSite.uuid,
        polyName: "Non-overlapping",
        isActive: true
      });

      try {
        const result = await validator.validatePolygon(polygonGeometry.uuid);
        expect(result.valid).toBe(true);
        expect(result.extraInfo).toBeNull();
      } finally {
        await SitePolygon.destroy({
          where: { polygonUuid: polygonGeometry.uuid }
        });
        await PolygonGeometry.destroy({
          where: { uuid: polygonGeometry.uuid }
        });
      }
    });
  });
});
