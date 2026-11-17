import { Test, TestingModule } from "@nestjs/testing";
import { PassThrough } from "node:stream";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { GeoJsonExportService } from "./geojson-export.service";
import { SITE_POLYGON_CSV_COLUMNS, SitePolygonCsvExportService } from "./site-polygon-csv-export.service";

// The real CsvExportService pulls in every entity-aware linked field collector, which needs the full entity
// set. This spec only needs the class as an injection token.
jest.mock("@terramatch-microservices/common/export/csv-export.service", () => ({
  CsvExportService: class CsvExportService {}
}));

jest.mock("@terramatch-microservices/common/util/batch-find-all", () => ({
  batchFindAll: jest.fn()
}));

const mockFilterExportScope = jest.fn();

jest.mock("./geojson-export-query.builder", () => {
  class GeoJsonExportQueryBuilder {
    attributes = jest.fn();
    findOptionsForAggregation = jest.fn().mockReturnValue({});
    async filterExportScope(scope: unknown) {
      mockFilterExportScope(scope);
      return this;
    }
    paginationTotal = jest.fn().mockResolvedValue(2);
  }
  return {
    GeoJsonExportQueryBuilder,
    buildExportQuery: async (scope: unknown, attributes?: string[]) => {
      const builder = new GeoJsonExportQueryBuilder();
      if (attributes != null) builder.attributes(attributes);
      return builder.filterExportScope(scope);
    }
  };
});

describe("SitePolygonCsvExportService", () => {
  let service: SitePolygonCsvExportService;

  const mockCsvExportService = { writeToStream: jest.fn() };
  const mockGeoJsonExportService = { writeFeatureCollection: jest.fn() };

  const polygon1 = { id: 1, uuid: "sp-1", polyName: "one", site: { name: "Site A" } } as unknown as SitePolygon;
  const polygon2 = { id: 2, uuid: "sp-2", polyName: "two", site: { name: "Site B" } } as unknown as SitePolygon;

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

    // Each pass over the scope sees the same two pages.
    jest.mocked(batchFindAll).mockImplementation(async function* () {
      yield [polygon1];
      yield [polygon2];
    } as never);
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
        SITE_POLYGON_CSV_COLUMNS,
        expect.any(Function)
      );
      expect(mockGeoJsonExportService.writeFeatureCollection).not.toHaveBeenCalled();
    });
  });

  describe("writeCsv", () => {
    it("uses the fixed export columns with their headers in order", () => {
      expect(Object.entries(SITE_POLYGON_CSV_COLUMNS)).toEqual([
        ["polyName", "Polygon Name"],
        ["siteName", "Site Name"],
        ["status", "Submission"],
        ["validationStatus", "Validation"],
        ["practice", "Restoration Practice"],
        ["targetSys", "Target Land Use System"],
        ["distr", "Tree Distribution"],
        ["plantStart", "Planting Start Date"],
        ["numTrees", "Trees Planted"],
        ["calcArea", "Calculated Area"],
        ["source", "Source"]
      ]);
    });

    it("adds one row per polygon with its site name and reports progress for each page", async () => {
      const addRow = jest.fn();
      mockCsvExportService.writeToStream.mockImplementation(
        async (_destination: unknown, _columns: unknown, writeRows: (add: jest.Mock) => Promise<void>) =>
          writeRows(addRow)
      );
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([{ numTrees: 0, calcArea: 0 }] as never);
      const onProgress = jest.fn();

      await service.writeCsv({ siteUuids: ["site-uuid"] }, new PassThrough(), onProgress);

      expect(addRow).toHaveBeenNthCalledWith(1, polygon1, { siteName: "Site A" });
      expect(addRow).toHaveBeenNthCalledWith(2, polygon2, { siteName: "Site B" });
      expect(onProgress).toHaveBeenNthCalledWith(1, 0, 2);
      expect(onProgress).toHaveBeenLastCalledWith(2, 2);
    });

    it("writes a totals row for trees planted and calculated area after the polygon rows", async () => {
      const addRow = jest.fn();
      mockCsvExportService.writeToStream.mockImplementation(
        async (_destination: unknown, _columns: unknown, writeRows: (add: jest.Mock) => Promise<void>) =>
          writeRows(addRow)
      );
      const findAll = jest
        .spyOn(SitePolygon, "findAll")
        .mockResolvedValue([{ numTrees: "12", calcArea: "3.5" }] as never);

      await service.writeCsv({ siteUuids: ["site-uuid"] }, new PassThrough(), jest.fn());

      expect(findAll).toHaveBeenCalledTimes(1);
      expect(addRow).toHaveBeenLastCalledWith({ polyName: "Total", numTrees: 12, calcArea: 3.5 });
    });

    it("limits the rows to the scope and the table filters", async () => {
      jest.mocked(batchFindAll).mockImplementation(async function* () {
        yield* [];
      } as never);
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([] as never);
      mockCsvExportService.writeToStream.mockImplementation(
        async (_destination: unknown, _columns: unknown, writeRows: (add: jest.Mock) => Promise<void>) =>
          writeRows(jest.fn())
      );
      const scope = { siteUuids: ["site-1"], polygonStatus: ["approved" as const], hasOverlap: true };

      await service.writeCsv(scope, new PassThrough(), jest.fn());

      expect(mockFilterExportScope).toHaveBeenCalledWith(scope);
    });

    it("writes the header and a zero totals row for an empty scope", async () => {
      jest.mocked(batchFindAll).mockImplementation(async function* () {
        yield* [];
      } as never);
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([] as never);
      const addRow = jest.fn();
      mockCsvExportService.writeToStream.mockImplementation(
        async (_destination: unknown, _columns: unknown, writeRows: (add: jest.Mock) => Promise<void>) =>
          writeRows(addRow)
      );

      await service.writeCsv({ polygonUuids: ["missing"] }, new PassThrough(), jest.fn());

      expect(mockCsvExportService.writeToStream).toHaveBeenCalledWith(
        expect.anything(),
        SITE_POLYGON_CSV_COLUMNS,
        expect.any(Function)
      );
      expect(addRow).toHaveBeenCalledTimes(1);
      expect(addRow).toHaveBeenCalledWith({ polyName: "Total", numTrees: 0, calcArea: 0 });
    });
  });
});
