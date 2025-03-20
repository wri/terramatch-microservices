import { ProjectReport } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { reverse, sortBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  OrganisationFactory,
  ProjectFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { ProjectReportProcessor } from "./project-report.processor";
import { ProjectReportFullDto, ProjectReportLightDto } from "../dto/project-report.dto";
import { DateTime } from "luxon";

describe("ProjectReportProcessor", () => {
  let processor: ProjectReportProcessor;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await ProjectReport.truncate();

    const module = await Test.createTestingModule({
      providers: [{ provide: MediaService, useValue: createMock<MediaService>() }, EntitiesService]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("projectReports") as ProjectReportProcessor;
  });

  describe("should return a list of project reports when findMany is called with valid parameters", () => {
    async function expectProjectReports(
      expected: ProjectReport[],
      query: Omit<EntityQueryDto, "field" | "direction" | "size" | "number">,
      {
        permissions = [],
        sortField = "id",
        sortUp = true,
        total = expected.length
      }: { permissions?: string[]; sortField?: string; sortUp?: boolean; total?: number } = {}
    ) {
      const { models, paginationTotal } = await processor.findMany(query as EntityQueryDto, userId, permissions);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }
    it("should returns project reports", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id });
      const managedProjectReports = await ProjectReportFactory.createMany(3, { projectId: project.id });
      await ProjectReportFactory.createMany(5);
      await expectProjectReports(managedProjectReports, {}, { permissions: ["manage-own"] });
    });

    it("should returns managed project reports", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id, isMonitoring: false, isManaging: true });
      await ProjectFactory.create();
      const projectReports = await ProjectReportFactory.createMany(3, { projectId: project.id });
      await ProjectReportFactory.createMany(5);
      await expectProjectReports(projectReports, {}, { permissions: ["projects-manage"] });
    });

    it("should returns framework project reports", async () => {
      const projectReports = await ProjectReportFactory.createMany(3, { frameworkKey: "hbf" });
      await ProjectReportFactory.createMany(3, { frameworkKey: "ppc" });
      for (const p of await ProjectReportFactory.createMany(3, { frameworkKey: "terrafund" })) {
        projectReports.push(p);
      }

      await expectProjectReports(projectReports, {}, { permissions: ["framework-hbf", "framework-terrafund"] });
    });

    it("should return project reports that match the search term", async () => {
      const project1 = await ProjectFactory.create({ name: "Foo Bar" });
      const project2 = await ProjectFactory.create({ name: "Baz Foo" });
      const projectReport1 = await ProjectReportFactory.create({ projectId: project1.id });
      const projectReport2 = await ProjectReportFactory.create({ projectId: project2.id });
      projectReport1.project = await projectReport1.$get("project");
      projectReport2.project = await projectReport2.$get("project");
      await ProjectReportFactory.createMany(3);

      await expectProjectReports([projectReport1, projectReport2], { search: "foo" });
    });

    it("should return project reports filtered by the update request status or project", async () => {
      const p1 = await ProjectFactory.create();
      const p2 = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: p1.id });
      await ProjectUserFactory.create({ userId, projectId: p2.id });

      const first = await ProjectReportFactory.create({
        title: "first project report",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        projectId: p1.id
      });
      const second = await ProjectReportFactory.create({
        title: "second project report",
        status: "started",
        updateRequestStatus: "awaiting-approval",
        projectId: p1.id
      });
      const third = await ProjectReportFactory.create({
        title: "third project report",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        projectId: p1.id
      });
      const fourth = await ProjectReportFactory.create({
        title: "fourth project report",
        status: "approved",
        updateRequestStatus: "approved",
        projectId: p2.id
      });

      await expectProjectReports([first, second, third], { updateRequestStatus: "awaiting-approval" });

      await expectProjectReports([fourth], { projectUuid: p2.uuid });
    });

    it("should throw an error if the project uuid is not found", async () => {
      await expect(processor.findMany({ projectUuid: "123" })).rejects.toThrow(BadRequestException);
    });

    it("should sort project reports by title", async () => {
      const projectReportA = await ProjectReportFactory.create({ title: "A Project Report" });
      const projectReportB = await ProjectReportFactory.create({ title: "B Project Report" });
      const projectReportC = await ProjectReportFactory.create({ title: "C Project Report" });
      await expectProjectReports(
        [projectReportA, projectReportB, projectReportC],
        { sort: { field: "title" } },
        { sortField: "title" }
      );
      await expectProjectReports(
        [projectReportA, projectReportB, projectReportC],
        { sort: { field: "title", direction: "ASC" } },
        { sortField: "title" }
      );
      await expectProjectReports(
        [projectReportC, projectReportB, projectReportA],
        { sort: { field: "title", direction: "DESC" } },
        { sortField: "title", sortUp: false }
      );
    });

    it("should sort project reports by project name", async () => {
      const projectA = await ProjectFactory.create({ name: "A Project" });
      const projectB = await ProjectFactory.create({ name: "B Project" });
      const projectC = await ProjectFactory.create({ name: "C Project" });
      const projectReportA = await ProjectReportFactory.create({ projectId: projectA.id });
      const projectReportB = await ProjectReportFactory.create({ projectId: projectB.id });
      const projectReportC = await ProjectReportFactory.create({ projectId: projectC.id });
      await expectProjectReports(
        [projectReportA, projectReportB, projectReportC],
        { sort: { field: "projectName" } },
        { sortField: "projectName" }
      );
      await expectProjectReports(
        [projectReportC, projectReportB, projectReportA],
        { sort: { field: "projectName", direction: "DESC" } },
        { sortField: "projectName" }
      );
    });

    it("should sort project reports by organisation name", async () => {
      const org1 = await OrganisationFactory.create({ name: "A Org" });
      const org2 = await OrganisationFactory.create({ name: "B Org" });
      const org3 = await OrganisationFactory.create({ name: "C Org" });
      const projectA = await ProjectFactory.create({ organisationId: org1.id });
      const projectB = await ProjectFactory.create({ organisationId: org2.id });
      const projectC = await ProjectFactory.create({ organisationId: org3.id });
      projectA.organisation = await projectA.$get("organisation");
      projectB.organisation = await projectB.$get("organisation");
      projectC.organisation = await projectC.$get("organisation");

      const projectReports = [
        await ProjectReportFactory.create({
          projectId: projectA.id
        })
      ];
      projectReports.push(
        await ProjectReportFactory.create({
          projectId: projectB.id
        })
      );
      projectReports.push(
        await ProjectReportFactory.create({
          projectId: projectC.id
        })
      );
      for (const n of projectReports) {
        n.project = await n.$get("project");
      }

      await expectProjectReports(
        projectReports,
        { sort: { field: "organisationName" } },
        { sortField: "organisationName" }
      );
      await expectProjectReports(
        projectReports,
        { sort: { field: "organisationName", direction: "DESC" } },
        { sortField: "organisationName", sortUp: false }
      );
    });

    it("should sort project reports by status", async () => {
      const projectReportA = await ProjectReportFactory.create({ status: "started" });
      const projectReportB = await ProjectReportFactory.create({ status: "approved" });
      const projectReportC = await ProjectReportFactory.create({ status: "approved" });
      await expectProjectReports(
        [projectReportA, projectReportB, projectReportC],
        { sort: { field: "status" } },
        { sortField: "status" }
      );
      await expectProjectReports(
        [projectReportA, projectReportB, projectReportC],
        { sort: { field: "status", direction: "ASC" } },
        { sortField: "status" }
      );
      await expectProjectReports(
        [projectReportC, projectReportB, projectReportA],
        { sort: { field: "status", direction: "DESC" } },
        { sortField: "status", sortUp: false }
      );
    });

    it("should sort project reports by due date", async () => {
      const projectReportA = await ProjectReportFactory.create({ dueAt: DateTime.now().minus({ days: 1 }).toJSDate() });
      const projectReportB = await ProjectReportFactory.create({
        dueAt: DateTime.now().minus({ days: 10 }).toJSDate()
      });
      const projectReportC = await ProjectReportFactory.create({ dueAt: DateTime.now().minus({ days: 5 }).toJSDate() });
      await expectProjectReports(
        [projectReportA, projectReportC, projectReportB],
        { sort: { field: "dueAt", direction: "DESC" } },
        { sortField: "dueAt", sortUp: false }
      );
      await expectProjectReports(
        [projectReportB, projectReportC, projectReportA],
        { sort: { field: "dueAt", direction: "ASC" } },
        { sortField: "dueAt", sortUp: true }
      );
    });

    it("should sort project reports by updated at", async () => {
      const projectReportA = await ProjectReportFactory.create({
        updatedAt: DateTime.now().minus({ days: 1 }).toJSDate()
      });
      const projectReportB = await ProjectReportFactory.create({
        updatedAt: DateTime.now().minus({ days: 10 }).toJSDate()
      });
      const projectReportC = await ProjectReportFactory.create({
        updatedAt: DateTime.now().minus({ days: 5 }).toJSDate()
      });

      await expectProjectReports(
        [projectReportA, projectReportB, projectReportC],
        { sort: { field: "updatedAt", direction: "DESC" } },
        { sortField: "updatedAt", sortUp: false }
      );
      await expectProjectReports(
        [projectReportA, projectReportB, projectReportC],
        { sort: { field: "updatedAt", direction: "ASC" } },
        { sortField: "updatedAt", sortUp: true }
      );
    });

    it("should sort project reports by submitted at", async () => {
      const now = DateTime.now();
      const projectReportA = await ProjectReportFactory.create({
        submittedAt: now.minus({ minutes: 1 }).toJSDate()
      });
      const projectReportB = await ProjectReportFactory.create({
        submittedAt: now.minus({ minutes: 10 }).toJSDate()
      });
      const projectReportC = await ProjectReportFactory.create({
        submittedAt: now.minus({ minutes: 5 }).toJSDate()
      });
      await expectProjectReports(
        [projectReportA, projectReportC, projectReportB],
        { sort: { field: "submittedAt", direction: "DESC" } },
        { sortField: "submittedAt", sortUp: false }
      );
      await expectProjectReports(
        [projectReportB, projectReportC, projectReportA],
        { sort: { field: "submittedAt", direction: "ASC" } },
        { sortField: "submittedAt", sortUp: true }
      );
    });

    it("should paginate project reports", async () => {
      const projectReports = sortBy(await ProjectReportFactory.createMany(25), "id");
      await expectProjectReports(projectReports.slice(0, 10), { page: { size: 10 } }, { total: projectReports.length });
      await expectProjectReports(
        projectReports.slice(10, 20),
        { page: { size: 10, number: 2 } },
        { total: projectReports.length }
      );
      await expectProjectReports(
        projectReports.slice(20),
        { page: { size: 10, number: 3 } },
        { total: projectReports.length }
      );
    });
  });

  describe("should return a requested project report when findOne is called with a valid uuid", () => {
    it("should return a requested project report", async () => {
      const projectReport = await ProjectReportFactory.create();
      const result = await processor.findOne(projectReport.uuid);
      expect(result.id).toBe(projectReport.id);
    });
  });

  describe("should properly map the project report data into its respective DTOs", () => {
    it("should serialize a Project Report as a light resource (ProjectReportLightDto)", async () => {
      const { uuid } = await ProjectReportFactory.create();
      const projectReport = await processor.findOne(uuid);
      const document = buildJsonApi(ProjectReportLightDto, { forceDataArray: true });
      await processor.addLightDto(document, projectReport);
      const attributes = document.serialize().data[0].attributes as ProjectReportLightDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: true
      });
    });
    it("should include calculated fields in ProjectReportFullDto", async () => {
      const project = await ProjectFactory.create();

      const { uuid } = await ProjectReportFactory.create({
        projectId: project.id
      });

      const projectReport = await processor.findOne(uuid);
      const document = buildJsonApi(ProjectReportFullDto, { forceDataArray: true });
      await processor.addFullDto(document, projectReport);
      const attributes = document.serialize().data[0].attributes as ProjectReportFullDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid
      });
    });
  });
});
