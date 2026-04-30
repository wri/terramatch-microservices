/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ProjectReport } from "@terramatch-microservices/database/entities";
import { DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { Dictionary, reverse, sortBy, sum } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  EntityFormFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  TrackingFactory,
  TreeSpeciesFactory
} from "@terramatch-microservices/database/factories";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { ProjectReportProcessor } from "./project-report.processor";
import { DateTime } from "luxon";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ProjectReportLightDto } from "../dto/project-report.dto";
import { mockEntityService } from "./entity.processor.spec";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { setMockedPermissions } from "@terramatch-microservices/common/util/testing";

describe("ProjectReportProcessor", () => {
  let processor: ProjectReportProcessor;
  let policyService: PolicyService;
  let csvExportService: DeepMocked<CsvExportService>;

  beforeEach(async () => {
    await ProjectReport.truncate();

    const module = await mockEntityService();
    policyService = module.get(PolicyService);
    csvExportService = module.get(CsvExportService);
    processor = module.get(EntitiesService).createEntityProcessor("projectReports") as ProjectReportProcessor;
  });

  describe("findMany", () => {
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
      setMockedPermissions(...permissions);
      const { models, paginationTotal } = await processor.findMany(query as EntityQueryDto);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }

    it("should returns project reports", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId: policyService.userId, projectId: project.id });
      const managedProjectReports = await ProjectReportFactory.createMany(3, { projectId: project.id });
      await ProjectReportFactory.createMany(5);
      await expectProjectReports(managedProjectReports, {}, { permissions: ["manage-own"] });
    });

    it("should returns managed project reports", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({
        userId: policyService.userId,
        projectId: project.id,
        isMonitoring: false,
        isManaging: true
      });
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
      const p1 = await ProjectFactory.create({ country: "MX" });
      const p2 = await ProjectFactory.create({ country: "CA" });
      await ProjectUserFactory.create({ userId: policyService.userId, projectId: p1.id });
      await ProjectUserFactory.create({ userId: policyService.userId, projectId: p2.id });

      const first = await ProjectReportFactory.create({
        title: "first project report",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        frameworkKey: "ppc",
        projectId: p1.id
      });
      const second = await ProjectReportFactory.create({
        title: "second project report",
        status: "started",
        updateRequestStatus: "awaiting-approval",
        frameworkKey: "ppc",
        projectId: p1.id
      });
      const third = await ProjectReportFactory.create({
        title: "third project report",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        frameworkKey: "ppc",
        projectId: p1.id
      });
      const fourth = await ProjectReportFactory.create({
        title: "fourth project report",
        status: "approved",
        updateRequestStatus: "approved",
        frameworkKey: "terrafund",
        projectId: p2.id
      });

      await expectProjectReports([first, second, third], { updateRequestStatus: "awaiting-approval" });

      await expectProjectReports([fourth], { projectUuid: p2.uuid });

      await expectProjectReports([first, second, third], { country: "MX" });
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

    it("should throw an error if the sort field is not recognized", async () => {
      setMockedPermissions();
      await expect(processor.findMany({ sort: { field: "foo" } })).rejects.toThrow(BadRequestException);
    });
  });

  describe("findOne", () => {
    it("should return a requested project report", async () => {
      const projectReport = await ProjectReportFactory.create();
      const result = await processor.findOne(projectReport.uuid);
      expect(result?.id).toBe(projectReport.id);
    });
  });

  describe("getFullDto / getLightDto", () => {
    it("should serialize a Project Report as a light resource (ProjectReportLightDto)", async () => {
      const { uuid } = await ProjectReportFactory.create();
      const projectReport = await processor.findOne(uuid);
      const { id, dto } = await processor.getLightDto(projectReport!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: true
      });
    });

    it("should include calculated fields in ProjectReportFullDto", async () => {
      const ppcProject = await ProjectFactory.create({ frameworkKey: "ppc" });
      const tfProject = await ProjectFactory.create({ frameworkKey: "terrafund" });
      const hbfProject = await ProjectFactory.create({ frameworkKey: "hbf" });

      const { uuid: ppcUuid } = await ProjectReportFactory.create({ projectId: ppcProject.id, frameworkKey: "ppc" });
      const { uuid: tfUuid } = await ProjectReportFactory.create({
        projectId: tfProject.id,
        frameworkKey: "terrafund"
      });
      const { uuid: hbfUuid } = await ProjectReportFactory.create({
        projectId: hbfProject.id,
        frameworkKey: "hbf"
      });

      const ppcResult = await processor.getFullDto((await processor.findOne(ppcUuid))!);
      expect(ppcResult.id).toEqual(ppcUuid);
      expect(ppcResult.dto).toMatchObject({
        uuid: ppcUuid,
        lightResource: false,
        projectUuid: ppcProject.uuid
      });

      const tfResult = await processor.getFullDto((await processor.findOne(tfUuid))!);
      expect(tfResult.id).toEqual(tfUuid);
      expect(tfResult.dto).toMatchObject({
        uuid: tfUuid,
        lightResource: false,
        projectUuid: tfProject.uuid
      });

      const hbfResult = await processor.getFullDto((await processor.findOne(hbfUuid))!);
      expect(hbfResult.id).toEqual(hbfUuid);
      expect(hbfResult.dto).toMatchObject({
        uuid: hbfUuid,
        lightResource: false,
        projectUuid: hbfProject.uuid
      });
    });

    it("should include calculated fields in ProjectReportFullDto completion Completed", async () => {
      const project = await ProjectFactory.create();

      const { uuid } = await ProjectReportFactory.create({
        projectId: project.id,
        title: "Project Report",
        completion: 100
      });

      const projectReport = await processor.findOne(uuid);
      const { id, dto } = await processor.getFullDto(projectReport!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid
      });
    });

    it("should include calculated fields in ProjectReportFullDto completion Not Completed", async () => {
      const project = await ProjectFactory.create();

      const { uuid } = await ProjectReportFactory.create({
        projectId: project.id,
        title: null,
        dueAt: null,
        completion: 0
      });

      const siteReport = await processor.findOne(uuid);
      const { id, dto } = await processor.getFullDto(siteReport!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid
      });
    });

    it("should include calculated fields in ProjectReportFullDto completion Started", async () => {
      const project = await ProjectFactory.create();

      const { uuid } = await ProjectReportFactory.create({
        projectId: project.id,
        title: "",
        dueAt: null,
        completion: 50
      });

      const siteReport = await processor.findOne(uuid);
      const { id, dto } = await processor.getFullDto(siteReport!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid
      });
    });

    it("resolves planting status as completed from community progress answer", async () => {
      const project = await ProjectFactory.create();
      const { uuid } = await ProjectReportFactory.create({
        projectId: project.id,
        plantingStatus: null,
        landscapeCommunityContribution: null,
        communityProgress: "Yes"
      });

      const report = await processor.findOne(uuid);
      const { dto } = await processor.getFullDto(report!);

      expect(dto.plantingStatus).toBe("completed");
      expect(dto.landscapeCommunityContribution).toBe("Yes");
    });

    it("keeps null planting status for non-completed community progress text", async () => {
      const project = await ProjectFactory.create();
      const { uuid } = await ProjectReportFactory.create({
        projectId: project.id,
        plantingStatus: null,
        landscapeCommunityContribution: null,
        communityProgress: "Planting still in progress"
      });

      const report = await processor.findOne(uuid);
      const { dto } = await processor.getFullDto(report!);

      expect(dto.plantingStatus).toBeNull();
      expect(dto.landscapeCommunityContribution).toBe("Planting still in progress");
    });

    it("falls back to completed contribution text when hidden values clear contribution", async () => {
      const project = await ProjectFactory.create();
      const { uuid } = await ProjectReportFactory.create({
        projectId: project.id,
        plantingStatus: "completed",
        landscapeCommunityContribution: null,
        communityProgress: null
      });
      const processorWithEntitiesService = processor as ProjectReportProcessor & {
        entitiesService: Pick<EntitiesService, "removeHiddenValues">;
      };
      jest
        .spyOn(processorWithEntitiesService.entitiesService, "removeHiddenValues")
        .mockImplementation(async (_model, dto) => {
          const maybeDto = dto as { landscapeCommunityContribution?: string | null };
          maybeDto.landscapeCommunityContribution = null;
        });

      const report = await processor.findOne(uuid);
      const { dto } = await processor.getFullDto(report!);

      expect(dto.plantingStatus).toBe("completed");
      expect(dto.landscapeCommunityContribution).toBe("completed");
    });
  });

  describe("processSideload", () => {
    it("should include sideloaded demographics", async () => {
      const projectReport = await ProjectReportFactory.create();
      await TrackingFactory.projectReportWorkday(projectReport).create();
      await TrackingFactory.projectReportJobs(projectReport).create();

      setMockedPermissions(`framework-${projectReport.frameworkKey}`);
      const document = buildJsonApi(ProjectReportLightDto);
      await processor.addIndex(document, {
        sideloads: [{ entity: "trackings", pageSize: 5 }]
      });

      const result = document.serialize();
      expect(result.included?.length).toBe(2);
      expect(result.included!.filter(({ type }) => type === "trackings").length).toBe(2);
    });
  });

  describe("exportAll", () => {
    it("throws if the framework key is missing", async () => {
      await expect(processor.exportAll({})).rejects.toThrow("Framework key not found");
    });

    it("writes all project reports to the CSV", async () => {
      setMockedPermissions("framework-ppc");
      await ProjectReport.truncate();
      const orgs = [
        await OrganisationFactory.create({ type: "non-profit-organization" }),
        await OrganisationFactory.create({ type: "for-profit-organization" })
      ];
      const projects = [
        await ProjectFactory.create({ organisationId: orgs[0].id, frameworkKey: "ppc" }),
        await ProjectFactory.create({ organisationId: orgs[1].id, frameworkKey: "ppc" })
      ];
      const reports = [
        await ProjectReportFactory.create({ projectId: projects[0].id, frameworkKey: "ppc" }),
        await ProjectReportFactory.create({ projectId: projects[1].id, frameworkKey: "ppc" }),
        await ProjectReportFactory.create({ projectId: projects[1].id, frameworkKey: "ppc" })
      ];
      // non framework reports should be ignored
      await ProjectReportFactory.create({ frameworkKey: "terrafund" });
      await EntityFormFactory.projectReport(reports[0]).create();

      // For PPC, we do some calculations based on trees planted in the project reports
      const firstReportSum = sum(
        (await TreeSpeciesFactory.projectReportNurserySeedling(reports[1]).createMany(2)).map(({ amount }) => amount)
      );
      // make sure this report is "older" than the next
      reports[1].setDataValue("createdAt", DateTime.fromJSDate(reports[1].createdAt).minus({ days: 1 }));
      await reports[1].save();
      const secondReportSum = sum(
        (await TreeSpeciesFactory.projectReportNurserySeedling(reports[2]).createMany(2)).map(({ amount }) => amount)
      );

      const addRow = jest.fn();
      csvExportService.writeCsv.mockImplementation(async (fileName, response, columns, writeRows) => {
        await writeRows(addRow);
      });
      await processor.exportAll({ frameworkKey: "ppc" });

      expect(addRow).toHaveBeenCalledTimes(3);
      const [result1, additional1] = addRow.mock.calls[0] as [ProjectReport, Dictionary<unknown>];
      expect(result1).toMatchObject({ uuid: reports[0].uuid });
      expect(result1.projectName).toEqual(projects[0].name);
      expect(result1.organisationReadableType).toEqual("Non Profit Organization");
      expect(result1.organisationName).toEqual(orgs[0].name);
      expect(additional1).toMatchObject({ totalSeedlingsGrownReport: null, totalSeedlingsGrown: null });
      const [result2, additional2] = addRow.mock.calls[1] as [ProjectReport, Dictionary<unknown>];
      expect(result2).toMatchObject({ uuid: reports[1].uuid });
      expect(result2.projectName).toEqual(projects[1].name);
      expect(result2.organisationReadableType).toEqual("For Profit Organization");
      expect(result2.organisationName).toEqual(orgs[1].name);
      expect(additional2).toMatchObject({
        totalSeedlingsGrownReport: firstReportSum,
        totalSeedlingsGrown: firstReportSum
      });
      const [result3, additional3] = addRow.mock.calls[2] as [ProjectReport, Dictionary<unknown>];
      expect(result3).toMatchObject({ uuid: reports[2].uuid });
      expect(result3.projectName).toEqual(projects[1].name);
      expect(result3.organisationReadableType).toEqual("For Profit Organization");
      expect(result3.organisationName).toEqual(orgs[1].name);
      expect(additional3).toMatchObject({
        totalSeedlingsGrownReport: secondReportSum,
        totalSeedlingsGrown: firstReportSum + secondReportSum
      });
    });

    it("writes project project reports to the CSV", async () => {
      await ProjectReport.truncate();
      const org = await OrganisationFactory.create({ type: "non-profit-organization" });
      const projects = [
        await ProjectFactory.create({ organisationId: org.id, frameworkKey: "ppc" }),
        await ProjectFactory.create({ organisationId: org.id, frameworkKey: "ppc" })
      ];
      const reports = [
        await ProjectReportFactory.create({ projectId: projects[0].id, frameworkKey: "ppc" }),
        await ProjectReportFactory.create({ projectId: projects[1].id, frameworkKey: "ppc" }),
        await ProjectReportFactory.create({ projectId: projects[1].id, frameworkKey: "ppc" })
      ];
      await EntityFormFactory.projectReport(reports[0]).create();

      // For PPC, we do some calculations based on trees planted in the project reports
      const firstReportSum = sum(
        (await TreeSpeciesFactory.projectReportNurserySeedling(reports[1]).createMany(2)).map(({ amount }) => amount)
      );
      // make sure this report is "older" than the next
      reports[1].setDataValue("createdAt", DateTime.fromJSDate(reports[1].createdAt).minus({ days: 1 }));
      await reports[1].save();
      const secondReportSum = sum(
        (await TreeSpeciesFactory.projectReportNurserySeedling(reports[2]).createMany(2)).map(({ amount }) => amount)
      );

      const addRow = jest.fn();
      csvExportService.writeCsv.mockImplementation(async (fileName, response, columns, writeRows) => {
        await writeRows(addRow);
      });
      await processor.exportAll({ projectUuid: projects[1].uuid });

      expect(addRow).toHaveBeenCalledTimes(2);
      const [result1, additional1] = addRow.mock.calls[0] as [ProjectReport, Dictionary<unknown>];
      expect(result1).toMatchObject({ uuid: reports[1].uuid });
      expect(result1.projectName).toEqual(projects[1].name);
      expect(result1.organisationReadableType).toEqual("Non Profit Organization");
      expect(result1.organisationName).toEqual(org.name);
      expect(additional1).toMatchObject({
        totalSeedlingsGrownReport: firstReportSum,
        totalSeedlingsGrown: firstReportSum
      });
      const [result2, additional2] = addRow.mock.calls[1] as [ProjectReport, Dictionary<unknown>];
      expect(result2).toMatchObject({ uuid: reports[2].uuid });
      expect(result2.projectName).toEqual(projects[1].name);
      expect(result2.organisationReadableType).toEqual("Non Profit Organization");
      expect(result2.organisationName).toEqual(org.name);
      expect(additional2).toMatchObject({
        totalSeedlingsGrownReport: secondReportSum,
        totalSeedlingsGrown: firstReportSum + secondReportSum
      });
    });
  });
});
