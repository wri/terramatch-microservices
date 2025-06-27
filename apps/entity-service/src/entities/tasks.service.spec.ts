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
import { Op } from "sequelize";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import {
  ProjectReport,
  SiteReport,
  NurseryReport,
  User,
  AuditStatus
} from "@terramatch-microservices/database/entities";
import { ReportModel } from "@terramatch-microservices/database/constants/entities";
import { ModelCtor } from "sequelize-typescript";

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
    it("should call findReportsByUuids, updateReportsStatus, and bulkCreate as expected", async () => {
      const attributes = {
        data: {
          type: "tasks",
          id: "some-task-id",
          attributes: {
            siteReportNothingToReportUuid: ["site-uuid"],
            nurseryReportNothingToReportUuid: ["nursery-uuid"],
            feedback: "feedback text"
          }
        }
      };
      const taskId = 123;
      const user = { id: 1, firstName: "John", lastName: "Doe", emailAddress: "john@example.com" };
      const siteReports: ReportModel[] = [
        {
          id: 1,
          uuid: "site-uuid",
          frameworkKey: "ppc",
          siteId: 1,
          createdBy: 1,
          taskId: 1,
          status: "approved",
          completion: 100,
          submittedAt: new Date(),
          nothingToReport: false
        } as Partial<SiteReport> as SiteReport
      ];
      const nurseryReports: ReportModel[] = [
        {
          id: 2,
          uuid: "nursery-uuid",
          frameworkKey: "ppc",
          nurseryId: 1,
          createdBy: 1,
          taskId: 1,
          status: "approved",
          completion: 100,
          submittedAt: new Date(),
          nothingToReport: false
        } as Partial<NurseryReport> as NurseryReport
      ];
      const auditStatusRecords = [{ auditableId: 1 }, { auditableId: 2 }];

      // Mock User.findOne
      const User = require("@terramatch-microservices/database/entities").User;
      jest.spyOn(User, "findOne").mockResolvedValue(user);
      // Mock findReportsByUuids
      const serviceWithPrivate = service as unknown as {
        findReportsByUuids: <T extends ReportModel>(
          modelClass: ModelCtor<T>,
          uuids: string[],
          taskId: number
        ) => Promise<T[]>;
        updateReportsStatus: <T extends ReportModel>(
          modelClass: ModelCtor<T>,
          uuids: string[],
          status: string,
          taskId: number
        ) => Promise<void>;
        createAuditStatusRecords: (
          reports: ReportModel[],
          user: User | null,
          feedback: string | null
        ) => Array<Partial<AuditStatus>>;
      };
      const findReportsByUuidsSpy = jest.spyOn(serviceWithPrivate, "findReportsByUuids");
      findReportsByUuidsSpy.mockResolvedValueOnce(siteReports).mockResolvedValueOnce(nurseryReports);
      // Mock updateReportsStatus
      const updateReportsStatusSpy = jest.spyOn(serviceWithPrivate, "updateReportsStatus").mockResolvedValue(undefined);
      // Mock createAuditStatusRecords
      jest
        .spyOn(serviceWithPrivate, "createAuditStatusRecords")
        .mockImplementation((reports, user, feedback) => auditStatusRecords);
      // Mock AuditStatus.bulkCreate
      const AuditStatus = require("@terramatch-microservices/database/entities").AuditStatus;
      const bulkCreateSpy = jest.spyOn(AuditStatus, "bulkCreate").mockResolvedValue(undefined);

      // Act
      await service.approveBulkReports(attributes, taskId);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({
        where: { id: service["entitiesService"].userId },
        attributes: ["id", "firstName", "lastName", "emailAddress"]
      });
      expect(findReportsByUuidsSpy).toHaveBeenCalledTimes(2);
      expect(updateReportsStatusSpy).toHaveBeenCalledTimes(2);
      expect(bulkCreateSpy).toHaveBeenCalledWith([
        { auditableId: 1 },
        { auditableId: 2 },
        { auditableId: 1 },
        { auditableId: 2 }
      ]);
    });
  });

  describe("findReportsByUuids", () => {
    it("should return reports from modelClass.findAll", async () => {
      const dummyReports = [
        { id: 1, uuid: "a" },
        { id: 2, uuid: "b" }
      ];
      const uuids = ["a", "b"];
      const taskId = 42;
      const modelClass = {
        findAll: jest.fn().mockImplementation(({ where }) => {
          expect(where.uuid[Op.in]).toEqual(uuids);
          expect(where.taskId).toBe(taskId);
          return Promise.resolve(dummyReports);
        })
      } as Partial<ModelCtor<ReportModel>> as ModelCtor<ReportModel>;
      const serviceWithPrivate = service as unknown as {
        findReportsByUuids: (
          modelClass: ModelCtor<ReportModel>,
          uuids: string[] | null,
          taskId: number
        ) => Promise<ReportModel[]>;
      };
      const result = await serviceWithPrivate.findReportsByUuids(modelClass, uuids, taskId);
      expect(result).toBe(dummyReports);
    });
  });

  describe("updateReportsStatus", () => {
    it("should call modelClass.update with correct args", async () => {
      const uuids = ["a", "b"];
      const status = "approved";
      const taskId = 42;
      const modelClass = {
        update: jest.fn().mockImplementation((updateObj, { where }) => {
          expect(updateObj).toEqual({ status });
          expect(where.uuid[Op.in]).toEqual(uuids);
          expect(where.taskId).toBe(taskId);
          return Promise.resolve();
        })
      } as Partial<ModelCtor<ReportModel>> as ModelCtor<ReportModel>;
      const serviceWithPrivate = service as unknown as {
        updateReportsStatus: (
          modelClass: ModelCtor<ReportModel>,
          uuids: string[] | null,
          status: string,
          taskId: number
        ) => Promise<void>;
      };
      await serviceWithPrivate.updateReportsStatus(modelClass, uuids, status, taskId);
    });
  });

  describe("createAuditStatusRecords", () => {
    it("should return correct audit status records for reports and user", () => {
      const reports = [{ id: 1 }, { id: 2 }];
      const user = {
        emailAddress: "test@example.com",
        firstName: "Test",
        lastName: "User"
      };
      const feedback = "Looks good!";
      // @ts-ignore private method access
      const result = service.createAuditStatusRecords(reports, user, feedback);
      expect(result).toHaveLength(2);
      for (const record of result) {
        expect(record.auditableId).toBeDefined();
        expect(record.createdBy).toBe(user.emailAddress);
        expect(record.firstName).toBe(user.firstName);
        expect(record.lastName).toBe(user.lastName);
        expect(record.status).toBe("approved");
        expect(record.comment).toBe(feedback);
      }
    });

    it("should handle null user and feedback", () => {
      const reports = [{ id: 3 }];
      // @ts-ignore private method access
      const result = service.createAuditStatusRecords(reports, null, null);
      expect(result).toHaveLength(1);
      expect(result[0].createdBy).toBeNull();
      expect(result[0].firstName).toBeNull();
      expect(result[0].lastName).toBeNull();
      expect(result[0].comment).toBeNull();
      expect(result[0].status).toBe("approved");
    });
  });
});
