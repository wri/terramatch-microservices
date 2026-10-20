import { Test } from "@nestjs/testing";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectReportFactory,
  SiteFactory,
  SitePolygonFactory
} from "@terramatch-microservices/database/factories";
import { ProjectMapIndexService } from "./project-map-index.service";
import { ProjectMapIndexQueryDto } from "./dto/project-map-index-query.dto";

describe("ProjectMapIndexService", () => {
  let service: ProjectMapIndexService;

  const getUuids = async (query: ProjectMapIndexQueryDto = {}) =>
    (await service.getMapIndex(query)).projects.map(({ uuid }) => uuid);

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ProjectMapIndexService]
    }).compile();

    service = module.get(ProjectMapIndexService);
  });

  const findEntry = async (uuid: string) =>
    (await service.getMapIndex({})).projects.find(project => project.uuid === uuid);

  it("returns the marker and facet fields for every project when no filters are given", async () => {
    const project = await ProjectFactory.create({
      lat: 1.25,
      long: -3.5,
      frameworkKey: "ppc",
      level0Project: ["KE"],
      cohort: "terrafund"
    });

    const result = await service.getMapIndex({});

    expect(result.projects).toContainEqual({
      uuid: project.uuid,
      name: project.name,
      lat: 1.25,
      long: -3.5,
      frameworkKey: "ppc",
      level0Project: ["KE"],
      cohort: "terrafund",
      polygonCount: 0
    });
    expect(result.total).toBe(result.projects.length);
  });

  it("includes projects without a centroid with a null lat / long", async () => {
    const project = await ProjectFactory.create({ lat: null, long: null });

    expect(await findEntry(project.uuid)).toMatchObject({ lat: null, long: null });
  });

  it("counts only active polygons across all of a project's sites", async () => {
    const project = await ProjectFactory.create({ lat: 1, long: 1 });
    const [siteA, siteB] = await SiteFactory.createMany(2, { projectId: project.id });
    await SitePolygonFactory.createMany(2, { siteUuid: siteA.uuid });
    await SitePolygonFactory.create({ siteUuid: siteB.uuid });
    await SitePolygonFactory.create({ siteUuid: siteB.uuid, isActive: false });
    const otherProject = await ProjectFactory.create({ lat: 1, long: 1 });
    const otherSite = await SiteFactory.create({ projectId: otherProject.id });
    await SitePolygonFactory.create({ siteUuid: otherSite.uuid });

    expect((await findEntry(project.uuid))?.polygonCount).toBe(3);
    expect((await findEntry(otherProject.uuid))?.polygonCount).toBe(1);
  });

  it("excludes test projects", async () => {
    const testProject = await ProjectFactory.create({ lat: 1, long: 1, isTest: true });

    expect(await getUuids()).not.toContain(testProject.uuid);
  });

  it("filters by frameworkKey[], country[] and organisationUuid[]", async () => {
    const organisation = await OrganisationFactory.create();
    const match = await ProjectFactory.create({
      lat: 1,
      long: 1,
      frameworkKey: "ppc",
      level0Project: ["KE"],
      organisationId: organisation.id
    });
    const otherFramework = await ProjectFactory.create({
      lat: 1,
      long: 1,
      frameworkKey: "terrafund",
      level0Project: ["KE"],
      organisationId: organisation.id
    });
    const otherCountry = await ProjectFactory.create({
      lat: 1,
      long: 1,
      frameworkKey: "ppc",
      level0Project: ["GH"],
      organisationId: organisation.id
    });
    const otherOrganisation = await ProjectFactory.create({
      lat: 1,
      long: 1,
      frameworkKey: "ppc",
      level0Project: ["KE"]
    });

    const uuids = await getUuids({
      frameworkKey: ["ppc"],
      country: ["KE"],
      organisationUuid: [organisation.uuid]
    });

    expect(uuids).toEqual([match.uuid]);
    expect(uuids).not.toContain(otherFramework.uuid);
    expect(uuids).not.toContain(otherCountry.uuid);
    expect(uuids).not.toContain(otherOrganisation.uuid);
  });

  it("matches country[] against the first level0Project entry only", async () => {
    const primary = await ProjectFactory.create({ lat: 1, long: 1, level0Project: ["KE", "GH"] });
    const secondary = await ProjectFactory.create({ lat: 1, long: 1, level0Project: ["GH", "KE"] });

    const uuids = await getUuids({ country: ["KE"] });

    expect(uuids).toContain(primary.uuid);
    expect(uuids).not.toContain(secondary.uuid);
  });

  it("filters by plantingStatus of the latest approved project report", async () => {
    const organisation = await OrganisationFactory.create();
    const planting = await ProjectFactory.create({ lat: 1, long: 1, organisationId: organisation.id });
    const notStarted = await ProjectFactory.create({ lat: 1, long: 1, organisationId: organisation.id });
    await ProjectReportFactory.create({ projectId: planting.id, status: "approved", plantingStatus: "in-progress" });
    await ProjectReportFactory.create({
      projectId: notStarted.id,
      status: "approved",
      plantingStatus: "not-started"
    });

    const uuids = await getUuids({ organisationUuid: [organisation.uuid], plantingStatus: "in-progress" });

    expect(uuids).toEqual([planting.uuid]);
  });
});
