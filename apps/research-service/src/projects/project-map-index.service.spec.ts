import { Test } from "@nestjs/testing";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectReportFactory
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

  it("returns uuid, name and centroid for every project when no filters are given", async () => {
    const project = await ProjectFactory.create({ lat: 1.25, long: -3.5 });

    const result = await service.getMapIndex({});

    expect(result.projects).toContainEqual({ uuid: project.uuid, name: project.name, lat: 1.25, long: -3.5 });
    expect(result.total).toBe(result.projects.length);
  });

  it("includes projects without a centroid with a null lat / long", async () => {
    const project = await ProjectFactory.create({ lat: null, long: null });

    const result = await service.getMapIndex({});

    expect(result.projects).toContainEqual({ uuid: project.uuid, name: project.name, lat: null, long: null });
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
      country: "KE",
      organisationId: organisation.id
    });
    const otherFramework = await ProjectFactory.create({
      lat: 1,
      long: 1,
      frameworkKey: "terrafund",
      country: "KE",
      organisationId: organisation.id
    });
    const otherCountry = await ProjectFactory.create({
      lat: 1,
      long: 1,
      frameworkKey: "ppc",
      country: "GH",
      organisationId: organisation.id
    });
    const otherOrganisation = await ProjectFactory.create({ lat: 1, long: 1, frameworkKey: "ppc", country: "KE" });

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
