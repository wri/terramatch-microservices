import { Test } from "@nestjs/testing";
import { Project } from "@terramatch-microservices/database/entities";
import { PROJECT_QA_STATUS_AUDIT_TYPES } from "@terramatch-microservices/database/constants";
import {
  AuditStatusFactory,
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
      polygonCount: 0,
      sumNumTrees: 0,
      sumCalcArea: 0,
      latestQaCycle: null,
      latestQaStatus: null
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

  it("sums numTrees and calcArea of active polygons in any status", async () => {
    const project = await ProjectFactory.create({ lat: 1, long: 1 });
    const site = await SiteFactory.create({ projectId: project.id });
    await SitePolygonFactory.create({ siteUuid: site.uuid, status: "approved", numTrees: 100, calcArea: 1.5 });
    await SitePolygonFactory.create({ siteUuid: site.uuid, status: "draft", numTrees: 50, calcArea: 2.25 });
    await SitePolygonFactory.create({ siteUuid: site.uuid, numTrees: null, calcArea: null });
    await SitePolygonFactory.create({ siteUuid: site.uuid, isActive: false, numTrees: 1000, calcArea: 100 });

    expect(await findEntry(project.uuid)).toMatchObject({ polygonCount: 3, sumNumTrees: 150, sumCalcArea: 3.75 });
  });

  describe("latest QA status", () => {
    const createQaAudit = (project: Project, cycle: number, status: string | null) =>
      AuditStatusFactory.project(project).create({ type: PROJECT_QA_STATUS_AUDIT_TYPES[cycle - 1], status });

    it("returns the status of the most recently updated cycle, not the highest one", async () => {
      const project = await ProjectFactory.create({ lat: 1, long: 1 });
      await createQaAudit(project, 1, "qa-completed");
      await createQaAudit(project, 4, "qa-in-progress");
      await createQaAudit(project, 2, "no-data-submitted");

      expect(await findEntry(project.uuid)).toMatchObject({ latestQaCycle: 2, latestQaStatus: "no-data-submitted" });
    });

    it("ignores audits that are not QA status audits", async () => {
      const project = await ProjectFactory.create({ lat: 1, long: 1 });
      await createQaAudit(project, 3, "qa-completed");
      await AuditStatusFactory.project(project).create({ type: "status", status: "approved" });

      expect(await findEntry(project.uuid)).toMatchObject({ latestQaCycle: 3, latestQaStatus: "qa-completed" });
    });

    it("returns null when the most recent QA audit cleared the status", async () => {
      const project = await ProjectFactory.create({ lat: 1, long: 1 });
      await createQaAudit(project, 1, "qa-completed");
      await createQaAudit(project, 2, null);

      expect(await findEntry(project.uuid)).toMatchObject({ latestQaCycle: null, latestQaStatus: null });
    });

    it("ignores QA status columns that have no audit", async () => {
      const project = await ProjectFactory.create({ lat: 1, long: 1, projectQaStatus1: "qa-completed" });

      expect(await findEntry(project.uuid)).toMatchObject({ latestQaCycle: null, latestQaStatus: null });
    });
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
