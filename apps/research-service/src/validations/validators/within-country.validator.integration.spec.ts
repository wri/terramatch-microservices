import { Test, TestingModule } from "@nestjs/testing";
import { WithinCountryValidator } from "./within-country.validator";
import {
  SitePolygon,
  PolygonGeometry,
  Site,
  Project,
  WorldCountryGeneralized
} from "@terramatch-microservices/database/entities";
import {
  SitePolygonFactory,
  PolygonGeometryFactory,
  SiteFactory,
  ProjectFactory
} from "@terramatch-microservices/database/factories";
import { cambodiaGeometry } from "@terramatch-microservices/database/test-fixtures/cambodia-geometry";

describe("WithinCountryValidator - Integration Tests", () => {
  let validator: WithinCountryValidator;
  let testProject: Project;
  let testSite: Site;
  let cambodiaCountry: WorldCountryGeneralized;
  const testPolygonUuids: string[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WithinCountryValidator]
    }).compile();

    validator = module.get<WithinCountryValidator>(WithinCountryValidator);

    if (WorldCountryGeneralized.sequelize == null) {
      throw new Error("Sequelize connection not available");
    }

    await WorldCountryGeneralized.sequelize.query(
      `
      INSERT INTO world_countries_generalized (country, iso, geometry)
      VALUES (
        'Cambodia',
        'KHM',
        ST_GeomFromGeoJSON('${JSON.stringify(cambodiaGeometry)}')
      )
      `
    );

    cambodiaCountry = (await WorldCountryGeneralized.findOne({
      where: { iso: "KHM" }
    })) as WorldCountryGeneralized;

    testProject = await ProjectFactory.create({
      name: "Test Project for WithinCountry Validator Integration",
      country: "KHM"
    });

    testSite = await SiteFactory.create({
      projectId: testProject.id,
      name: "Test Site Cambodia"
    });

    const testGeometries = [
      {
        type: "Polygon" as const,
        coordinates: [
          [
            [104.16086018482935, 12.634081210376962],
            [104.1655896984207, 12.63084245920291],
            [104.17294849914686, 12.631483561370558],
            [104.1721261998643, 12.63498740034828],
            [104.1706954000727, 12.636104100224088],
            [104.16851299997501, 12.636178699887125],
            [104.16628320020959, 12.636678099714572],
            [104.1633670999118, 12.63584619984232],
            [104.16269720031562, 12.635184000241452],
            [104.16086018482935, 12.634081210376962]
          ]
        ]
      },
      {
        type: "Polygon" as const,
        coordinates: [
          [
            [105.1840955413441, 14.34216529102271],
            [105.18206259871607, 14.34266549816219],
            [105.17983604250333, 14.341414978218452],
            [105.18090091721388, 14.33972676522464],
            [105.18427302046229, 14.339117129629543],
            [105.18532176070755, 14.340617768112438],
            [105.18553150875636, 14.34182139796657],
            [105.1840955413441, 14.34216529102271]
          ]
        ]
      },
      {
        type: "Polygon" as const,
        coordinates: [
          [
            [102.56370278226285, 12.633913810224044],
            [102.55514930608223, 12.620595402070443],
            [102.5681984694682, 12.62277867546618],
            [102.58888057880995, 12.626844167389265],
            [102.57301418836272, 12.63676563458732],
            [102.56370278226285, 12.633913810224044]
          ]
        ]
      },
      {
        type: "Polygon" as const,
        coordinates: [
          [
            [104.43709887836172, 10.434704386522213],
            [104.43396732179531, 10.432961489634394],
            [104.43926650940375, 10.429605033188835],
            [104.43605501026474, 10.418822977706682],
            [104.4406390189472, 10.414759290055343],
            [104.44795529863995, 10.412090009953033],
            [104.46274806423554, 10.415765365308246],
            [104.46322263461042, 10.425777620066384],
            [104.45824225232133, 10.439903107225533],
            [104.43709887836172, 10.434704386522213]
          ]
        ]
      }
    ];

    const polygonNames = ["C", "B", "D", "A"];

    for (let i = 0; i < testGeometries.length; i++) {
      const polygonGeometry = await PolygonGeometryFactory.create({
        polygon: testGeometries[i]
      });

      await SitePolygonFactory.create({
        polygonUuid: polygonGeometry.uuid,
        siteUuid: testSite.uuid,
        polyName: polygonNames[i],
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

    if (cambodiaCountry != null) {
      await WorldCountryGeneralized.destroy({
        where: { OGRFID: cambodiaCountry.OGRFID }
      });
    }
  });

  describe("Real Database Integration Tests", () => {
    it("should validate polygon C as valid", async () => {
      const result = await validator.validatePolygon(testPolygonUuids[0]);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).not.toBeNull();

      if (result.extraInfo != null) {
        expect(result.extraInfo.inside_percentage).toBeGreaterThanOrEqual(75);
        expect(result.extraInfo.country_name).toBe("Cambodia");
      }
    });

    it("should validate polygon B as valid", async () => {
      const result = await validator.validatePolygon(testPolygonUuids[1]);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).not.toBeNull();

      if (result.extraInfo != null) {
        expect(result.extraInfo.inside_percentage).toBeGreaterThanOrEqual(75);
        expect(result.extraInfo.inside_percentage).toBeCloseTo(83.12, 1);
        expect(result.extraInfo.country_name).toBe("Cambodia");
      }
    });

    it("should validate polygon D as valid", async () => {
      const result = await validator.validatePolygon(testPolygonUuids[2]);

      expect(result.valid).toBe(true);
      expect(result.extraInfo).not.toBeNull();

      if (result.extraInfo != null) {
        expect(result.extraInfo.inside_percentage).toBeGreaterThanOrEqual(75);
        expect(result.extraInfo.inside_percentage).toBeCloseTo(78, 1);
        expect(result.extraInfo.country_name).toBe("Cambodia");
      }
    });

    it("should validate polygon A as invalid", async () => {
      const result = await validator.validatePolygon(testPolygonUuids[3]);

      expect(result.valid).toBe(false);
      expect(result.extraInfo).not.toBeNull();

      if (result.extraInfo != null) {
        expect(result.extraInfo.inside_percentage).toBeLessThan(75);
        expect(result.extraInfo.country_name).toBe("Cambodia");
      }
    });

    it("should handle polygon with no associated site", async () => {
      const orphanGeometry = {
        type: "Polygon" as const,
        coordinates: [
          [
            [104.0, 12.0],
            [104.1, 12.0],
            [104.1, 12.1],
            [104.0, 12.1],
            [104.0, 12.0]
          ]
        ]
      };

      const polygonGeometry = await PolygonGeometryFactory.create({
        polygon: orphanGeometry
      });

      try {
        await expect(validator.validatePolygon(polygonGeometry.uuid)).rejects.toThrow();
      } finally {
        await PolygonGeometry.destroy({
          where: { uuid: polygonGeometry.uuid }
        });
      }
    });

    it("should handle polygon completely outside country", async () => {
      const outsideGeometry = {
        type: "Polygon" as const,
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ]
      };

      const polygonGeometry = await PolygonGeometryFactory.create({
        polygon: outsideGeometry
      });

      await SitePolygonFactory.create({
        polygonUuid: polygonGeometry.uuid,
        siteUuid: testSite.uuid,
        polyName: "Outside Cambodia",
        isActive: true
      });

      try {
        await expect(validator.validatePolygon(polygonGeometry.uuid)).rejects.toThrow(
          `Polygon with UUID ${polygonGeometry.uuid} not found or has no associated project`
        );
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
