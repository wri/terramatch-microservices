import { Test } from "@nestjs/testing";
import { createMock, PartialFuncReturn } from "@golevelup/ts-jest";
import { ConfigService } from "@nestjs/config";
import fetchMock from "jest-fetch-mock";
import { GwcTileInvalidationService } from "./gwc-tile-invalidation.service";

const ENV: Record<string, string> = {
  GEOSERVER_URL: "http://localhost:8081/geoserver",
  GEOSERVER_USER: "admin",
  GEOSERVER_PASSWORD: "geoserver",
  GEOSERVER_WORKSPACE: "wri"
};

describe("GwcTileInvalidationService", () => {
  let service: GwcTileInvalidationService;

  const buildService = async (env: Record<string, string>) => {
    const module = await Test.createTestingModule({
      providers: [
        GwcTileInvalidationService,
        {
          provide: ConfigService,
          useValue: createMock<ConfigService>({
            get: (key: string): PartialFuncReturn<unknown> => env[key] ?? ""
          })
        }
      ]
    }).compile();

    return module.get(GwcTileInvalidationService);
  };

  beforeEach(async () => {
    fetchMock.enableMocks();
    service = await buildService(ENV);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fetchMock.resetMocks();
  });

  it("does nothing when GEOSERVER_URL is not configured", async () => {
    service = await buildService({ ...ENV, GEOSERVER_URL: "" });
    await service.truncate([-1, -1, 1, 1], ["active"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does nothing when GEOSERVER_WORKSPACE is not configured", async () => {
    service = await buildService({ ...ENV, GEOSERVER_WORKSPACE: "" });
    await service.truncate([-1, -1, 1, 1], ["active"]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does nothing when no layers are requested", async () => {
    await service.truncate([-1, -1, 1, 1], []);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts a truncate seed request for the active layer with basic auth", async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true, text: () => Promise.resolve("") } as Response);

    await service.truncate([-1, -1, 1, 1], ["active"]);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toEqual("http://localhost:8081/geoserver/gwc/rest/seed/wri:polygon_geometry_active.xml");
    expect(init?.method).toEqual("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "text/xml",
      Authorization: `Basic ${Buffer.from("admin:geoserver").toString("base64")}`
    });

    const body = init?.body as string;
    expect(body).toContain("<name>wri:polygon_geometry_active</name>");
    expect(body).toContain("<gridSetId>EPSG:900913</gridSetId>");
    expect(body).toContain("<zoomStart>0</zoomStart>");
    expect(body).toContain("<zoomStop>22</zoomStop>");
    expect(body).toContain("<type>truncate</type>");
    expect(body).toContain("<format>application/vnd.mapbox-vector-tile</format>");
  });

  it("requests both layers in parallel when both are given", async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true, text: () => Promise.resolve("") } as Response);

    await service.truncate([-1, -1, 1, 1], ["active", "deleted"]);

    expect(fetch).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "http://localhost:8081/geoserver/gwc/rest/seed/wri:polygon_geometry_active.xml",
        "http://localhost:8081/geoserver/gwc/rest/seed/wri:polygon_geometry_deleted.xml"
      ])
    );
  });

  it("pads the requested envelope outward before reprojecting to meters", async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true, text: () => Promise.resolve("") } as Response);

    await service.truncate([0, 0, 0.01, 0.01], ["active"]);

    const body = fetchMock.mock.calls[0][1]?.body as string;
    const match = body.match(/<double>([-\d.]+)<\/double><double>([-\d.]+)<\/double><double>([-\d.]+)<\/double>/);
    expect(match).not.toBeNull();
    const minX = Number(match?.[1]);
    // Unpadded [0,0] in EPSG:4326 reprojects to [0,0] in EPSG:900913, so any negative minX
    // proves outward padding was applied.
    expect(minX).toBeLessThan(0);
  });

  it("logs and does not throw when GWC responds with an error status", async () => {
    fetchMock.mockResolvedValue({ status: 500, ok: false, text: () => Promise.resolve("boom") } as Response);

    await expect(service.truncate([-1, -1, 1, 1], ["active"])).resolves.toBeUndefined();
  });

  it("logs and does not throw when the request throws (e.g. network error/timeout)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(service.truncate([-1, -1, 1, 1], ["active"])).resolves.toBeUndefined();
  });
});
