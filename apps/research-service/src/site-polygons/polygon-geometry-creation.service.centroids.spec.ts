import { Project } from "@terramatch-microservices/database/entities";
import {
  PolygonGeometryFactory,
  ProjectFactory,
  SiteFactory,
  SitePolygonFactory
} from "@terramatch-microservices/database/factories";
import { PolygonGeometryCreationService } from "./polygon-geometry-creation.service";

const squareAround = (lng: number, lat: number) => ({
  type: "Polygon",
  coordinates: [
    [
      [lng - 1, lat - 1],
      [lng + 1, lat - 1],
      [lng + 1, lat + 1],
      [lng - 1, lat + 1],
      [lng - 1, lat - 1]
    ]
  ]
});

const createPolygon = async (project: Project, lng: number, lat: number) => {
  const site = await SiteFactory.create({ projectId: project.id });
  const geometry = await PolygonGeometryFactory.create({ polygon: squareAround(lng, lat) });
  const sitePolygon = await SitePolygonFactory.create({ siteUuid: site.uuid, polygonUuid: geometry.uuid });
  return { geometry, sitePolygon };
};

describe("PolygonGeometryCreationService - project centroids (database)", () => {
  const service = new PolygonGeometryCreationService();

  it("updates every affected project from its remaining active polygons", async () => {
    const projectA = await ProjectFactory.create();
    const projectB = await ProjectFactory.create();
    await createPolygon(projectA, 10, 20);
    const deletedA = await createPolygon(projectA, 50, 60);
    const keptB = await createPolygon(projectB, -30, -40);
    await deletedA.sitePolygon.destroy();
    await deletedA.geometry.destroy();

    await service.bulkUpdateProjectCentroids([deletedA.geometry.uuid, keptB.geometry.uuid]);

    await projectA.reload();
    await projectB.reload();
    expect(projectA.long).toBeCloseTo(10);
    expect(projectA.lat).toBeCloseTo(20);
    expect(projectB.long).toBeCloseTo(-30);
    expect(projectB.lat).toBeCloseTo(-40);
  });
});
