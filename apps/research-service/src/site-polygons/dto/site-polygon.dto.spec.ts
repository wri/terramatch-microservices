import { Disturbance, SitePolygon } from "@terramatch-microservices/database/entities";
import {
  DisturbanceFactory,
  DisturbanceReportFactory,
  SiteFactory,
  SitePolygonFactory
} from "@terramatch-microservices/database/factories";
import { SitePolygonFullDto, SitePolygonLightDto } from "./site-polygon.dto";

const loadPolygonWithDisturbance = async (uuid: string) =>
  SitePolygon.findOne({
    where: { uuid },
    include: [
      {
        model: Disturbance,
        attributes: ["id", "disturbanceableId", "disturbanceableType", Disturbance.disturbanceReportUuidAttribute()]
      }
    ]
  });

describe("SitePolygon DTOs disturbanceReportUuid", () => {
  afterEach(async () => {
    await SitePolygon.truncate();
    await Disturbance.truncate();
  });

  it("returns the report uuid when disturbance is owned by a DisturbanceReport", async () => {
    const site = await SiteFactory.create();
    const report = await DisturbanceReportFactory.create();
    const disturbance = await DisturbanceFactory.disturbanceReport(report).create();
    const polygon = await SitePolygonFactory.create({ siteUuid: site.uuid, disturbanceId: disturbance.id });

    const loaded = await loadPolygonWithDisturbance(polygon.uuid);
    if (loaded == null) throw new Error("Expected site polygon to be loaded");

    const light = new SitePolygonLightDto(loaded);
    const full = new SitePolygonFullDto(loaded);

    expect(light.disturbanceableId).toBe(report.id);
    expect(light.disturbanceReportUuid).toBe(report.uuid);
    expect(full.disturbanceReportUuid).toBe(report.uuid);
  });

  it("returns null when the polygon has no disturbance", async () => {
    const site = await SiteFactory.create();
    const polygon = await SitePolygonFactory.create({ siteUuid: site.uuid, disturbanceId: null });

    const loaded = await loadPolygonWithDisturbance(polygon.uuid);
    if (loaded == null) throw new Error("Expected site polygon to be loaded");

    const light = new SitePolygonLightDto(loaded);

    expect(light.disturbanceableId).toBeNull();
    expect(light.disturbanceReportUuid).toBeNull();
  });

  it("returns null when disturbance is owned by a Site (legacy morph type)", async () => {
    const site = await SiteFactory.create();
    const disturbance = await DisturbanceFactory.site(site).create();
    const polygon = await SitePolygonFactory.create({ siteUuid: site.uuid, disturbanceId: disturbance.id });

    const loaded = await loadPolygonWithDisturbance(polygon.uuid);
    if (loaded == null) throw new Error("Expected site polygon to be loaded");

    const light = new SitePolygonLightDto(loaded);

    expect(light.disturbanceableId).toBe(site.id);
    expect(light.disturbanceReportUuid).toBeNull();
  });
});
