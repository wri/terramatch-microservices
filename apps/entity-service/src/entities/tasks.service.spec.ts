/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { TasksService } from "./tasks.service";
import { Test } from "@nestjs/testing";
import { EntitiesService } from "./entities.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { PolicyService } from "@terramatch-microservices/common";
import { TaskQueryDto } from "./dto/task-query.dto";
import { Task } from "@terramatch-microservices/database/entities";
import { reverse, sortBy, sumBy, uniq } from "lodash";
import {
  NurseryFactory,
  NurseryReportFactory,
  ProjectFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  SiteFactory,
  SiteReportFactory,
  TaskFactory,
  TreeSpeciesFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import FakeTimers from "@sinonjs/fake-timers";
import { faker } from "@faker-js/faker";
import { DateTime } from "luxon";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { buildJsonApi, Relationship, Resource } from "@terramatch-microservices/common/util";
import { TaskFullDto } from "./dto/task.dto";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { APPROVED, AWAITING_APPROVAL, DUE, STARTED } from "@terramatch-microservices/database/constants/status";
import { AuditStatus } from "@terramatch-microservices/database/entities/audit-status.entity";
import { TaskUpdateBody } from "./dto/task-update.dto";
import { SiteReport, NurseryReport } from "@terramatch-microservices/database/entities";
import { AuditStatusFactory } from "@terramatch-microservices/database/factories/audit-status.factory";

describe("TasksService", () => {
  let service: TasksService;
  let policyService: DeepMocked<PolicyService>;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await Task.truncate();

    const module = await Test.createTestingModule({
      providers: [
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>({ userId })) },
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService,
        TasksService
      ]
    }).compile();

    service = module.get(TasksService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getTasks", () => {
    async function expectTasks(
      expected: Task[],
      query: Omit<TaskQueryDto, "field" | "direction" | "size" | "number">,
      {
        permissions = ["manage-own"],
        sortField = "id",
        sortUp = true,
        paginationTotal = expected.length
      }: { permissions?: string[]; sortField?: string; sortUp?: boolean; paginationTotal?: number } = {}
    ) {
      policyService.getPermissions.mockResolvedValue(permissions);
      const { tasks, total } = await service.getTasks(query);
      expect(tasks.length).toBe(expected.length);
      expect(total).toBe(paginationTotal);

      const sorted = sortBy(tasks, sortField);
      if (!sortUp) reverse(sorted);
      expect(tasks.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }

    it("should return my tasks", async () => {
      const tasks: Task[] = [];
      for (const { id } of await ProjectFactory.createMany(3)) {
        await ProjectUserFactory.create({ userId, projectId: id });
        tasks.push(...(await TaskFactory.createMany(2, { projectId: id })));
      }
      await TaskFactory.createMany(2);

      await expectTasks(tasks, {}, { sortField: "dueAt", sortUp: false });
    });

    it("should return managed tasks", async () => {
      const tasks: Task[] = [];
      for (const { id } of await ProjectFactory.createMany(3)) {
        await ProjectUserFactory.create({ userId, projectId: id, isMonitoring: false, isManaging: true });
        tasks.push(...(await TaskFactory.createMany(2, { projectId: id })));
      }
      await TaskFactory.createMany(2);

      await expectTasks(tasks, {}, { sortField: "dueAt", sortUp: false, permissions: ["projects-manage"] });
    });

    it("should return framework tasks", async () => {
      const projects = [
        await ProjectFactory.create({ frameworkKey: "hbf" }),
        await ProjectFactory.create({ frameworkKey: "ppc" })
      ];
      const tfProject = await ProjectFactory.create({ frameworkKey: "terrafund" });
      const tasks: Task[] = [];
      for (const { id } of projects) {
        tasks.push(...(await TaskFactory.createMany(2, { projectId: id })));
      }
      await TaskFactory.createMany(2, { projectId: tfProject.id });

      await expectTasks(tasks, {}, { permissions: ["framework-hbf", "framework-ppc"] });
    });

    it("should filter", async () => {
      const ppcProject = await ProjectFactory.create({ frameworkKey: "ppc" });
      const ppcTask = await TaskFactory.create({ projectId: ppcProject.id, status: "awaiting-approval" });
      const tfProject = await ProjectFactory.create({ frameworkKey: "terrafund" });
      const tfTask1 = await TaskFactory.create({ projectId: tfProject.id, status: "awaiting-approval" });
      const tfTask2 = await TaskFactory.create({ projectId: tfProject.id, status: "approved" });

      const permissions = ["framework-ppc", "framework-terrafund"];
      await expectTasks([ppcTask, tfTask1], { status: "awaiting-approval" }, { permissions });
      await expectTasks([tfTask1, tfTask2], { frameworkKey: "terrafund" }, { permissions });
      await expectTasks([tfTask1, tfTask2], { projectUuid: tfProject.uuid }, { permissions });
    });

    it("should sort", async () => {
      // sequelize doesn't support manually setting createdAt or updatedAt, so we have to mess with the
      // system clock for this test.
      const clock = FakeTimers.install({ shouldAdvanceTime: true });
      try {
        const oldDate = faker.date.past({ years: 1 });
        let newDate = faker.date.recent();
        clock.setSystemTime(oldDate);
        const tasks = await TaskFactory.createMany(3);
        clock.setSystemTime(newDate);
        tasks[0].setDataValue("status", "approved");
        await tasks[0].save();
        clock.setSystemTime((newDate = DateTime.fromJSDate(newDate).plus({ hours: 1 }).toJSDate()));
        await tasks[1].update({ status: "awaiting-approval" });
        clock.setSystemTime(DateTime.fromJSDate(newDate).plus({ hours: 1 }).toJSDate());
        tasks[2].setDataValue("status", "needs-more-information");
        await tasks[2].save();

        const frameworks: string[] = [];
        for (const task of tasks) {
          task.project = await task.$get("project");
          frameworks.push(task.frameworkKey);
          task.organisation = await task.$get("organisation");
        }

        const permissions = uniq(frameworks).map(framework => `framework-${framework}`);
        await expectTasks(tasks, { sort: { field: "status" } }, { sortField: "status", permissions });
        await expectTasks(
          tasks,
          { sort: { field: "status", direction: "DESC" } },
          { sortField: "status", sortUp: false, permissions }
        );
        await expectTasks(tasks, { sort: { field: "dueAt" } }, { sortField: "dueAt", permissions });
        await expectTasks(
          tasks,
          { sort: { field: "dueAt", direction: "DESC" } },
          { sortField: "dueAt", sortUp: false, permissions }
        );
        await expectTasks(tasks, { sort: { field: "updatedAt" } }, { sortField: "updatedAt", permissions });
        await expectTasks(
          tasks,
          { sort: { field: "updatedAt", direction: "DESC" } },
          { sortField: "updatedAt", sortUp: false, permissions }
        );
        await expectTasks(
          tasks,
          { sort: { field: "organisationName" } },
          { sortField: "organisationName", permissions }
        );
        await expectTasks(
          tasks,
          { sort: { field: "organisationName", direction: "DESC" } },
          { sortField: "organisationName", sortUp: false, permissions }
        );
        await expectTasks(tasks, { sort: { field: "projectName" } }, { sortField: "projectName", permissions });
        await expectTasks(
          tasks,
          { sort: { field: "projectName", direction: "DESC" } },
          { sortField: "projectName", sortUp: false, permissions }
        );
      } finally {
        clock.uninstall();
      }
    });
  });

  describe("getTask", () => {
    it("should throw if the task is not found", async () => {
      await expect(service.getTask("fake-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should return the task", async () => {
      const task = await TaskFactory.create();
      const result = await service.getTask(task.uuid);
      expect(result.id).toBe(task.id);
    });
  });

  describe("addFullTaskDto", () => {
    it("should add all task details", async () => {
      const project = await ProjectFactory.create();
      const task = await TaskFactory.create({ projectId: project.id });
      policyService.getPermissions.mockResolvedValue([`framework-${project.frameworkKey}`]);
      const projectReport = await ProjectReportFactory.create({
        taskId: task.id,
        projectId: project.id,
        frameworkKey: project.frameworkKey
      });
      // Create a bogus extra project report to make sure it's not included.
      await ProjectReportFactory.create({
        taskId: task.id,
        projectId: project.id,
        frameworkKey: project.frameworkKey
      });
      const site = await SiteFactory.create({ projectId: project.id, frameworkKey: project.frameworkKey });
      const siteReports = await SiteReportFactory.createMany(2, {
        taskId: task.id,
        siteId: site.id,
        status: AWAITING_APPROVAL,
        frameworkKey: project.frameworkKey
      });
      siteReports.push(
        await SiteReportFactory.create({
          taskId: task.id,
          siteId: site.id,
          status: APPROVED,
          frameworkKey: project.frameworkKey
        })
      );
      const nursery = await NurseryFactory.create({ projectId: project.id, frameworkKey: project.frameworkKey });
      const nurseryReports = await NurseryReportFactory.createMany(2, {
        taskId: task.id,
        nurseryId: nursery.id,
        frameworkKey: project.frameworkKey
      });
      // Unapproved report, should not be included in planted count.
      await TreeSpeciesFactory.forSiteReportTreePlanted.create({ speciesableId: siteReports[0].id });
      const trees = await TreeSpeciesFactory.forSiteReportTreePlanted.createMany(2, {
        speciesableId: siteReports[2].id
      });

      const result = (await service.addFullTaskDto(buildJsonApi(TaskFullDto), task)).serialize();
      const taskResource = result.data as Resource;
      expect(result.included).toHaveLength(6);
      const projectReportDtos = result.included!.filter(({ type }) => type === "projectReports");
      expect(projectReportDtos).toHaveLength(1);
      expect(projectReportDtos[0].id).toBe(projectReport.uuid);
      expect((taskResource.relationships!.projectReport.data as Relationship).id).toBe(projectReport.uuid);
      const siteReportDtos = result.included!.filter(({ type }) => type === "siteReports");
      expect(siteReportDtos).toHaveLength(siteReports.length);
      expect(siteReportDtos.map(({ id }) => id).sort()).toEqual(siteReports.map(({ uuid }) => uuid).sort());
      const siteReportRelationshipIds = (taskResource.relationships!.siteReports.data as Relationship[])
        .map(({ id }) => id)
        .sort();
      expect(siteReportRelationshipIds).toEqual(siteReports.map(({ uuid }) => uuid).sort());
      const nurseryReportDtos = result.included!.filter(({ type }) => type === "nurseryReports");
      expect(nurseryReportDtos).toHaveLength(nurseryReports.length);
      expect(nurseryReportDtos.map(({ id }) => id).sort()).toEqual(nurseryReports.map(({ uuid }) => uuid).sort());
      const nurseryReportRelationshipIds = (taskResource.relationships!.nurseryReports.data as Relationship[])
        .map(({ id }) => id)
        .sort();
      expect(nurseryReportRelationshipIds).toEqual(nurseryReports.map(({ uuid }) => uuid).sort());

      expect(taskResource.attributes.treesPlantedCount).toBe(sumBy(trees, "amount"));
    });
  });

  describe("submitForApproval", () => {
    it("should NOOP if status is already awaiting-approval", async () => {
      const spy = jest.spyOn(service as never, "loadReports");
      const task = await TaskFactory.create({ status: AWAITING_APPROVAL });
      await service.submitForApproval(task);
      expect(spy).not.toHaveBeenCalled();
    });

    it("should throw if the status cannot move to awaiting approval", async () => {
      const task = await TaskFactory.create({ status: APPROVED });
      // The current state machine definition doesn't have any states that can't transition to awaiting-approval
      // other than awaiting-approval itself, which is covered in the NOOP test above.
      jest.spyOn(task, "statusCanBe").mockReturnValue(false);
      await expect(service.submitForApproval(task)).rejects.toThrow(BadRequestException);
    });

    it("should throw if there is an incomplete report", async () => {
      const project = await ProjectFactory.create();
      policyService.getPermissions.mockResolvedValue([`framework-${project.frameworkKey}`]);
      const task = await TaskFactory.create({ projectId: project.id });
      await ProjectReportFactory.create({
        taskId: task.id,
        projectId: project.id,
        frameworkKey: project.frameworkKey,
        status: DUE
      });
      await expect(service.submitForApproval(task)).rejects.toThrow(BadRequestException);
    });

    it("should ensure all reports are in a complete state", async () => {
      const project = await ProjectFactory.create();
      policyService.getPermissions.mockResolvedValue([`framework-${project.frameworkKey}`]);
      const task = await TaskFactory.create({ projectId: project.id });
      const projectReport = await ProjectReportFactory.create({
        taskId: task.id,
        projectId: project.id,
        frameworkKey: project.frameworkKey,
        status: STARTED,
        completion: 50,
        submittedAt: undefined
      });
      const siteReport = await SiteReportFactory.create({
        taskId: task.id,
        frameworkKey: project.frameworkKey,
        status: DUE,
        completion: 0,
        submittedAt: undefined
      });
      const nurseryReport = await NurseryReportFactory.create({
        taskId: task.id,
        frameworkKey: project.frameworkKey,
        status: APPROVED,
        completion: 10,
        submittedAt: undefined
      });

      await service.submitForApproval(task);
      expect(task.status).toBe(AWAITING_APPROVAL);

      await projectReport.reload();
      expect(projectReport.status).toBe(AWAITING_APPROVAL);
      expect(projectReport.completion).toBe(100);
      expect(projectReport.submittedAt).toBeDefined();
      await siteReport.reload();
      expect(siteReport.status).toBe(AWAITING_APPROVAL);
      expect(siteReport.completion).toBe(0);
      expect(siteReport.nothingToReport).toBe(true);
      expect(siteReport.submittedAt).toBeDefined();
      await nurseryReport.reload();
      expect(nurseryReport.status).toBe(APPROVED);
      expect(nurseryReport.completion).toBe(10);
      expect(nurseryReport.submittedAt).toBeDefined();
    });
  });

  describe("approveBulkReports", () => {
    it("should approve the specified site and nursery reports and create audit status records", async () => {
      const user = await UserFactory.create();
      Object.defineProperty(service["entitiesService"], "userId", { value: user.id });

      const task = await TaskFactory.create();
      const siteReport = await SiteReportFactory.create({ taskId: task.id, status: "due" });
      const nurseryReport = await NurseryReportFactory.create({ taskId: task.id, status: "due" });

      const updateBody = {
        data: {
          attributes: {
            siteReportNothingToReportUuids: [siteReport.uuid],
            nurseryReportNothingToReportUuids: [nurseryReport.uuid],
            feedback: "Looks good"
          }
        }
      } as unknown as TaskUpdateBody;

      await service.approveBulkReports(updateBody.data.attributes, task);

      await AuditStatusFactory.create({
        auditableType: "siteReports",
        auditableId: siteReport.id,
        status: APPROVED,
        comment: "Looks good"
      });
      await AuditStatusFactory.create({
        auditableType: "nurseryReports",
        auditableId: nurseryReport.id,
        status: APPROVED,
        comment: "Looks good"
      });

      const updatedSiteReport = await SiteReport.findOne({ where: { id: siteReport.id } });
      const updatedNurseryReport = await NurseryReport.findOne({ where: { id: nurseryReport.id } });

      expect(updatedSiteReport?.status).toBe(APPROVED);
      expect(updatedNurseryReport?.status).toBe(APPROVED);

      const auditStatuses = await AuditStatus.findAll({
        where: { auditableId: [siteReport.id, nurseryReport.id] }
      });
      expect(auditStatuses).toHaveLength(2);
      expect(auditStatuses[0].comment).toBe("Looks good");
      expect(auditStatuses[1].comment).toBe("Looks good");
      expect([siteReport.id, nurseryReport.id]).toContain(auditStatuses[0].auditableId);
      expect([siteReport.id, nurseryReport.id]).toContain(auditStatuses[1].auditableId);
    });
  });
});
