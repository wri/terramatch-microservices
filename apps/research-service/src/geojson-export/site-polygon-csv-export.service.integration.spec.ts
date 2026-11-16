import { PassThrough } from "stream";
import { ConfigService } from "@nestjs/config";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { FileService } from "@terramatch-microservices/common/file/file.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { Site } from "@terramatch-microservices/database/entities";
import { ProjectFactory, SiteFactory, SitePolygonFactory } from "@terramatch-microservices/database/factories";
import { GeoJsonExportAttributes } from "./dto/geojson-export-request.dto";
import { GeoJsonExportService } from "./geojson-export.service";
import { SITE_POLYGON_CSV_COLUMNS, SitePolygonCsvExportService } from "./site-polygon-csv-export.service";

const HEADER = Object.values(SITE_POLYGON_CSV_COLUMNS).join(",");

describe("SitePolygonCsvExportService (database)", () => {
  let service: SitePolygonCsvExportService;
  let siteAlpha: Site;
  let siteBeta: Site;

  // Writes the CSV for the scope and returns its lines, so each assertion reads the file the way a user would.
  const exportLines = async (scope: GeoJsonExportAttributes) => {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", chunk => chunks.push(chunk));
    const ended = new Promise(resolve => stream.on("end", resolve));
    await service.writeCsv(scope, stream, async () => undefined);
    await ended;
    return Buffer.concat(chunks).toString().trim().split("\n");
  };

  beforeAll(async () => {
    // The CSV path needs no file, config or media services; they are only used for S3 and media URLs.
    const csvExportService = new CsvExportService({} as FileService, {} as ConfigService, {} as MediaService);
    service = new SitePolygonCsvExportService(csvExportService, new GeoJsonExportService({} as never));

    const project = await ProjectFactory.create({ name: "CSV Export Project" });
    siteAlpha = await SiteFactory.create({ projectId: project.id, name: "Alpha Site" });
    siteBeta = await SiteFactory.create({ projectId: project.id, name: "Beta Site" });

    await SitePolygonFactory.create({
      siteUuid: siteBeta.uuid,
      polyName: "bravo",
      numTrees: 10,
      calcArea: 2.5,
      status: "approved"
    });
    await SitePolygonFactory.create({
      siteUuid: siteAlpha.uuid,
      polyName: "charlie",
      numTrees: 5,
      calcArea: 1.25,
      status: "approved"
    });
    await SitePolygonFactory.create({
      siteUuid: siteAlpha.uuid,
      polyName: "alpha",
      numTrees: null,
      calcArea: null,
      status: "approved"
    });
  });

  const scope = (extra: Partial<GeoJsonExportAttributes> = {}): GeoJsonExportAttributes => ({
    siteUuids: [siteAlpha.uuid, siteBeta.uuid],
    ...extra
  });

  const polyNames = (lines: string[]) => lines.slice(1, -1).map(line => line.split(",")[0]);

  it("writes a header, one row per polygon with its site name, then a totals row", async () => {
    const lines = await exportLines(scope());

    expect(lines[0]).toBe(HEADER);
    expect(lines.length).toBe(5);
    expect(lines[lines.length - 1]).toBe("Total,,,,,,,,15,3.75,");
  });

  it("writes the site name for each polygon", async () => {
    const lines = await exportLines(scope({ sort: { field: "name", direction: "ASC" } }));

    expect(lines[1].split(",")[1]).toBe("Alpha Site");
    expect(lines[2].split(",")[1]).toBe("Beta Site");
  });

  it("orders rows by the requested sort field and direction", async () => {
    expect(polyNames(await exportLines(scope({ sort: { field: "name", direction: "ASC" } })))).toEqual([
      "alpha",
      "bravo",
      "charlie"
    ]);
    expect(polyNames(await exportLines(scope({ sort: { field: "name", direction: "DESC" } })))).toEqual([
      "charlie",
      "bravo",
      "alpha"
    ]);
  });

  it("sorts by site name, with the polygon id keeping equal keys in a stable order", async () => {
    const lines = await exportLines(scope({ sort: { field: "siteName", direction: "ASC" } }));

    expect(lines[1].split(",")[1]).toBe("Alpha Site");
    expect(lines[2].split(",")[1]).toBe("Alpha Site");
    expect(lines[3].split(",")[1]).toBe("Beta Site");
  });

  it("keeps the totals row last whatever the sort", async () => {
    const lines = await exportLines(scope({ sort: { field: "numTrees", direction: "DESC" } }));

    expect(lines[lines.length - 1]).toBe("Total,,,,,,,,15,3.75,");
  });

  it("writes the header and a zero totals row for an empty scope", async () => {
    const lines = await exportLines({ polygonUuids: ["00000000-0000-0000-0000-000000000000"] });

    expect(lines).toEqual([HEADER, "Total,,,,,,,,0,0,"]);
  });
});
