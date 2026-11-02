import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PassThrough } from "stream";
import { FeatureCollection } from "geojson";
import { Project, Site, SitePolygon, SitePolygonData } from "@terramatch-microservices/database/entities";
import { ProjectFactory, SiteFactory, SitePolygonFactory } from "@terramatch-microservices/database/factories";
import { POLYGON } from "@terramatch-microservices/database/factories/polygon-geometry.factory";
import { GeoJsonExportService } from "./geojson-export.service";
import { GeoJsonExportAttributes } from "./dto/geojson-export-request.dto";
import { GeoJsonExportQueryBuilder } from "./geojson-export-query.builder";
import { PolygonAttributeValuesService } from "../site-polygons/polygon-attribute-values.service";

describe("GeoJsonExportService (database)", () => {
  let service: GeoJsonExportService;
  let project: Project;
  let site: Site;
  let otherSite: Site;
  let polygon: SitePolygon;
  let otherSitePolygon: SitePolygon;
  let otherProjectPolygon: SitePolygon;

  const exportScope = async (scope: GeoJsonExportAttributes) => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", chunk => chunks.push(chunk));
    const progress: [number, number][] = [];
    await service.writeFeatureCollection(stream, scope, async (processed, total) => {
      progress.push([processed, total]);
    });
    return {
      collection: JSON.parse(Buffer.concat(chunks).toString()) as FeatureCollection,
      progress,
      ended: stream.writableEnded
    };
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GeoJsonExportService,
        {
          provide: PolygonAttributeValuesService,
          useValue: {
            getActiveKeysByFrameworkKeys: jest.fn().mockResolvedValue(new Map()),
            getMapsByPolygonUuids: jest.fn().mockResolvedValue(new Map())
          }
        }
      ]
    }).compile();
    service = module.get(GeoJsonExportService);

    project = await ProjectFactory.create({ name: "Export Project" });
    site = await SiteFactory.create({ projectId: project.id, name: "Export Site" });
    otherSite = await SiteFactory.create({ projectId: project.id });
    polygon = await SitePolygonFactory.create({ siteUuid: site.uuid });
    otherSitePolygon = await SitePolygonFactory.create({ siteUuid: otherSite.uuid });
    await SitePolygonFactory.create({ siteUuid: site.uuid, isActive: false });
    otherProjectPolygon = await SitePolygonFactory.create();
    await SitePolygonData.create({ sitePolygonUuid: polygon.uuid, data: { landUse: "cropland" } } as SitePolygonData);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("writeFeatureCollection", () => {
    it("exports every active polygon in a project with its geometry and properties", async () => {
      const { collection, progress, ended } = await exportScope({ projectUuids: [project.uuid] });

      expect(collection.type).toBe("FeatureCollection");
      expect(collection.features.map(({ properties }) => properties?.uuid).sort()).toEqual(
        [polygon.uuid, otherSitePolygon.uuid].sort()
      );
      const feature = collection.features.find(({ properties }) => properties?.uuid === polygon.uuid);
      expect(feature?.geometry).toEqual(POLYGON);
      expect(feature?.properties).toMatchObject({
        polyName: polygon.polyName,
        siteId: site.uuid,
        numTrees: polygon.numTrees,
        landUse: "cropland"
      });
      expect(progress).toEqual([
        [0, 2],
        [2, 2]
      ]);
      expect(ended).toBe(true);
    });

    it("exports only the requested sites", async () => {
      const { collection } = await exportScope({ siteUuids: [otherSite.uuid] });

      expect(collection.features.map(({ properties }) => properties?.uuid)).toEqual([otherSitePolygon.uuid]);
    });

    it("exports only the requested polygons", async () => {
      const { collection } = await exportScope({
        polygonUuids: [polygon.polygonUuid, otherProjectPolygon.polygonUuid].filter(
          (uuid): uuid is string => uuid != null
        )
      });

      expect(collection.features.map(({ properties }) => properties?.uuid).sort()).toEqual(
        [polygon.uuid, otherProjectPolygon.uuid].sort()
      );
    });

    it("writes a valid empty collection when nothing matches", async () => {
      const { collection, progress } = await exportScope({ siteUuids: [crypto.randomUUID()] });

      expect(collection).toEqual({ type: "FeatureCollection", features: [] });
      expect(progress).toEqual([[0, 0]]);
    });

    it("joins features across batches", async () => {
      jest.spyOn(GeoJsonExportQueryBuilder.prototype, "paginationTotal").mockResolvedValue(501);
      const execute = jest
        .spyOn(GeoJsonExportQueryBuilder.prototype, "execute")
        .mockResolvedValueOnce([polygon])
        .mockResolvedValueOnce([otherSitePolygon]);

      const { collection, progress } = await exportScope({ projectUuids: [project.uuid] });

      expect(execute).toHaveBeenCalledTimes(2);
      expect(collection.features.map(({ properties }) => properties?.uuid)).toEqual([
        polygon.uuid,
        otherSitePolygon.uuid
      ]);
      expect(progress).toEqual([
        [0, 501],
        [1, 501],
        [2, 501]
      ]);
    });

    it("ends the stream when a query fails", async () => {
      jest.spyOn(GeoJsonExportQueryBuilder.prototype, "paginationTotal").mockRejectedValue(new Error("DB down"));
      const stream = new PassThrough();

      await expect(service.writeFeatureCollection(stream, { siteUuids: [site.uuid] }, jest.fn())).rejects.toThrow(
        "DB down"
      );
      expect(stream.writableEnded).toBe(true);
    });
  });

  describe("getExportTarget", () => {
    it.each([{}, { projectUuids: ["a"], siteUuids: ["b"] }])("requires exactly one scope: %j", async scope => {
      await expect(service.getExportTarget(scope)).rejects.toThrow(BadRequestException);
    });

    it("names a single project export after the project", async () => {
      expect(await service.getExportTarget({ projectUuids: [project.uuid] })).toEqual({
        entityName: "Export Project",
        entityType: Project.LARAVEL_TYPE
      });
    });

    it("names a multi-site export by its count", async () => {
      expect(await service.getExportTarget({ siteUuids: [site.uuid, otherSite.uuid, site.uuid] })).toEqual({
        entityName: "2 sites",
        entityType: Site.LARAVEL_TYPE
      });
    });

    it("names a selected polygon export by its count", async () => {
      expect(await service.getExportTarget({ polygonUuids: ["a", "b"] })).toEqual({ entityName: "2 selected" });
    });

    it("throws when a project does not exist", async () => {
      await expect(service.getExportTarget({ projectUuids: [project.uuid, crypto.randomUUID()] })).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws when a site does not exist", async () => {
      await expect(service.getExportTarget({ siteUuids: [crypto.randomUUID()] })).rejects.toThrow(NotFoundException);
    });
  });
});
