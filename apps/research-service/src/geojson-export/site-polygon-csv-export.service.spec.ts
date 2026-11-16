import { Test, TestingModule } from "@nestjs/testing";
import { PassThrough } from "node:stream";
import { SitePolygon, SitePolygonData } from "@terramatch-microservices/database/entities";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { GeoJsonExportService } from "./geojson-export.service";
import { SitePolygonCsvExportService } from "./site-polygon-csv-export.service";

// The real CsvExportService pulls in every entity-aware linked field collector, which needs the full entity
// set. This spec only needs the class as an injection token.
jest.mock("@terramatch-microservices/common/export/csv-export.service", () => ({
  CsvExportService: class CsvExportService {}
}));

jest.mock("@terramatch-microservices/common/util/batch-find-all", () => ({
  batchFindAll: jest.fn()
}));

jest.mock("./geojson-export-query.builder", () => ({
  GeoJsonExportQueryBuilder: class {
    filterProjectUuids = jest.fn();
    filterSiteUuids = jest.fn();
    filterPolygonUuids = jest.fn();
    paginationTotal = jest.fn().mockResolvedValue(2);
  }
}));

jest.mock("@terramatch-microservices/database/entities", () => ({
  SitePolygon: {},
  SitePolygonData: { findAll: jest.fn() }
}));

describe("SitePolygonCsvExportService", () => {
  let service: SitePolygonCsvExportService;

  const mockCsvExportService = { writeToStream: jest.fn() };
  const mockGeoJsonExportService = {
    writeFeatureCollection: jest.fn(),
    loadCustomAttributeExportContext: jest.fn(),
    buildProperties: jest.fn()
  };

  const polygon1 = { uuid: "sp-1", polyName: "one" } as SitePolygon;
  const polygon2 = { uuid: "sp-2", polyName: "two" } as SitePolygon;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SitePolygonCsvExportService,
        { provide: CsvExportService, useValue: mockCsvExportService },
        { provide: GeoJsonExportService, useValue: mockGeoJsonExportService }
      ]
    }).compile();

    service = module.get(SitePolygonCsvExportService);
    jest.clearAllMocks();
    jest.mocked(SitePolygonData.findAll).mockResolvedValue([]);

    // Each pass over the scope sees the same two pages.
    jest.mocked(batchFindAll).mockImplementation(async function* () {
      yield [polygon1];
      yield [polygon2];
    } as never);
    mockGeoJsonExportService.loadCustomAttributeExportContext.mockResolvedValue({
      keysByFramework: new Map(),
      valuesByUuid: new Map()
    });
    mockGeoJsonExportService.buildProperties.mockImplementation((sitePolygon: SitePolygon) => ({
      uuid: sitePolygon.uuid,
      polyName: sitePolygon.polyName
    }));
  });

  describe("writeExport", () => {
    it("delegates the geojson format to the GeoJSON writer", async () => {
      const destination = new PassThrough();
      const onProgress = jest.fn();

      await service.writeExport("geojson", { siteUuids: ["site-uuid"] }, destination, onProgress);

      expect(mockGeoJsonExportService.writeFeatureCollection).toHaveBeenCalledWith(
        destination,
        { siteUuids: ["site-uuid"] },
        onProgress
      );
      expect(mockCsvExportService.writeToStream).not.toHaveBeenCalled();
    });

    it("writes CSV for the csv format", async () => {
      const destination = new PassThrough();

      await service.writeExport("csv", { siteUuids: ["site-uuid"] }, destination, jest.fn());

      expect(mockCsvExportService.writeToStream).toHaveBeenCalledWith(
        destination,
        expect.any(Object),
        expect.any(Function)
      );
      expect(mockGeoJsonExportService.writeFeatureCollection).not.toHaveBeenCalled();
    });
  });

  describe("writeCsv", () => {
    it("uses the union of stored extra keys as columns and writes fixed properties over them", async () => {
      jest.mocked(SitePolygonData.findAll).mockResolvedValue([
        { sitePolygonUuid: "sp-1", data: { soil: "clay" } },
        { sitePolygonUuid: "sp-2", data: { soil: "sand", rainfall: 12 } }
      ] as SitePolygonData[]);
      const addRow = jest.fn();
      mockCsvExportService.writeToStream.mockImplementation(
        async (_destination: unknown, _columns: unknown, writeRows: (add: jest.Mock) => Promise<void>) =>
          writeRows(addRow)
      );

      await service.writeCsv({ siteUuids: ["site-uuid"] }, new PassThrough());

      const columns = mockCsvExportService.writeToStream.mock.calls[0][1] as Record<string, string>;
      expect(Object.keys(columns)).toEqual(
        expect.arrayContaining(["uuid", "polyName", "siteId", "numTrees", "soil", "rainfall"])
      );
      expect(addRow).toHaveBeenCalledTimes(2);
      expect(addRow).toHaveBeenNthCalledWith(1, { soil: "clay" }, { uuid: "sp-1", polyName: "one" });
    });

    it("writes the base header for an empty scope", async () => {
      jest.mocked(batchFindAll).mockImplementation(async function* () {
        yield* [];
      } as never);
      mockCsvExportService.writeToStream.mockResolvedValue(undefined);

      await service.writeCsv({ polygonUuids: ["missing"] }, new PassThrough());

      const columns = mockCsvExportService.writeToStream.mock.calls[0][1] as Record<string, string>;
      expect(Object.keys(columns)).toEqual([
        "uuid",
        "polyName",
        "plantStart",
        "practice",
        "targetSys",
        "distr",
        "numTrees",
        "siteId"
      ]);
    });
  });
});
