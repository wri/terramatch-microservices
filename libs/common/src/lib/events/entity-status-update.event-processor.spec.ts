/* eslint-disable @typescript-eslint/no-explicit-any */
import * as FakeTimers from "@sinonjs/fake-timers";
import { EventService } from "./event.service";
import { EntityStatusUpdate } from "./entity-status-update.event-processor";
import {
  FinancialReportFactory,
  NurseryReportFactory,
  ProjectFactory,
  ProjectReportFactory,
  SiteReportFactory,
  TaskFactory,
  UpdateRequestFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { RequestContext } from "nestjs-request-context";
import { ActionFactory } from "@terramatch-microservices/database/factories/action.factory";
import { Action, AuditStatus, Task } from "@terramatch-microservices/database/entities";
import { faker } from "@faker-js/faker";
import { DateTime } from "luxon";
import { ReportModel } from "@terramatch-microservices/database/constants/entities";
import { Attributes } from "sequelize";
import {
  APPROVED,
  AWAITING_APPROVAL,
  DUE,
  NEEDS_MORE_INFORMATION,
  ReportStatus,
  STARTED
} from "@terramatch-microservices/database/constants/status";
import { InternalServerErrorException } from "@nestjs/common";

function mockUserId(userId?: number) {
  jest
    .spyOn(RequestContext, "currentContext", "get")
    .mockReturnValue({ req: { authenticatedUserId: userId }, res: {} });
}

describe("EntityStatusUpdate EventProcessor", () => {
  let eventService: DeepMocked<EventService>;

  beforeEach(async () => {
    eventService = createMock<EventService>();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should avoid status email and actions for non-entities", async () => {
    mockUserId();
    const processor = new EntityStatusUpdate(eventService, await UpdateRequestFactory.forProject().create());
    const statusUpdateSpy = jest.spyOn(processor as any, "sendStatusUpdateEmail");
    const updateActionsSpy = jest.spyOn(processor as any, "updateActions");
    const createAuditStatusSpy = jest.spyOn(processor as any, "createAuditStatus");
    await processor.handle();
    expect(createAuditStatusSpy).toHaveBeenCalled();
    expect(updateActionsSpy).not.toHaveBeenCalled();
    expect(statusUpdateSpy).not.toHaveBeenCalled();
  });

  it("should send a status update email", async () => {
    mockUserId();
    const project = await ProjectFactory.create();
    await new EntityStatusUpdate(eventService, project).handle();
    expect(eventService.emailQueue.add).toHaveBeenCalledWith(
      "statusUpdate",
      expect.objectContaining({ type: "projects", id: project.id })
    );
  });

  it("should update actions", async () => {
    mockUserId();
    const project = await ProjectFactory.create({ status: APPROVED });
    const action = await ActionFactory.forProject.create({ targetableId: project.id });
    await new EntityStatusUpdate(eventService, project).handle();

    const actions = await Action.for(project).findAll();
    expect(actions.length).toBe(1);
    expect(actions[0].id).not.toBe(action.id);
    expect(actions[0]).toMatchObject({
      status: "pending",
      type: "notification",
      projectId: project.id,
      organisationId: project.organisationId,
      title: project.name,
      text: "Approved"
    });
  });

  it("should create an audit status", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);

    const feedback = faker.lorem.sentence();
    const project = await ProjectFactory.create({ status: APPROVED, feedback });
    await new EntityStatusUpdate(eventService, project).handle();

    const auditStatus = await AuditStatus.for(project).findOne({ order: [["createdAt", "DESC"]] });
    expect(auditStatus).toMatchObject({
      createdBy: user.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      comment: `Approved: ${feedback}`
    });
  });

  describe("checkTaskStatus", () => {
    function createHandler(report: ReportModel) {
      const handler = new EntityStatusUpdate(eventService, report);
      jest.spyOn(handler as any, "sendStatusUpdateEmail").mockResolvedValue(undefined);
      jest.spyOn(handler as any, "updateActions").mockResolvedValue(undefined);
      jest.spyOn(handler as any, "createAuditStatus").mockResolvedValue(undefined);
      return handler;
    }

    async function createOldTask(props?: Partial<Attributes<Task>>) {
      const creationTime = DateTime.fromJSDate(new Date()).minus({ minutes: 5 }).set({ millisecond: 0 }).toJSDate();
      const clock = FakeTimers.install({ shouldAdvanceTime: true });
      try {
        clock.setSystemTime(creationTime);
        return await TaskFactory.create(props);
      } finally {
        clock.uninstall();
      }
    }

    it("should only be called for valid task update statuses", async () => {
      const report = await ProjectReportFactory.create();
      const handler = createHandler(report);
      const spy = jest.spyOn(handler as any, "checkTaskStatus").mockResolvedValue(undefined);
      await handler.handle();
      expect(spy).not.toHaveBeenCalled();

      async function expectCall(status: ReportStatus, expectCall: boolean) {
        spy.mockClear();
        report.status = status;
        await handler.handle();
        if (expectCall) expect(spy).toHaveBeenCalledTimes(1);
        else expect(spy).not.toHaveBeenCalled();
      }

      await expectCall(STARTED, false);
      await expectCall(AWAITING_APPROVAL, true);
      await expectCall(NEEDS_MORE_INFORMATION, true);
      await expectCall(APPROVED, true);
    });

    it("should log a warning if no task ID is found", async () => {
      const projectReport = await ProjectReportFactory.create({ taskId: null, status: AWAITING_APPROVAL });
      const handler = createHandler(projectReport);
      const logSpy = jest.spyOn((handler as any).logger, "warn");
      await handler.handle();
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching("No task found for status changed report"));
    });

    it("should skip task status check for FinancialReport (which has no taskId)", async () => {
      const financialReport = await FinancialReportFactory.create({ status: AWAITING_APPROVAL });
      const handler = createHandler(financialReport);
      const logSpy = jest.spyOn((handler as any).logger, "warn");
      await handler.handle();
      expect(logSpy).toHaveBeenCalledWith(
        `Skipping task status check for model without taskId [${financialReport.constructor.name}, ${financialReport.id}]`
      );
    });

    it("should log a warning if the task for the ID is not found", async () => {
      const projectReport = await ProjectReportFactory.create({ status: AWAITING_APPROVAL });
      await Task.destroy({ where: { id: projectReport.taskId as number } });
      const handler = createHandler(projectReport);
      const logSpy = jest.spyOn((handler as any).logger, "error");
      await handler.handle();
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching("No task found for task id"));
    });

    it("should NOOP if the task is DUE", async () => {
      const task = await createOldTask();
      const projectReport = await ProjectReportFactory.create({ taskId: task.id, status: AWAITING_APPROVAL });
      await createHandler(projectReport).handle();
      await task.reload();
      expect(task.updatedAt).toEqual(task.createdAt);
    });

    it("should move task to approved if all reports are approved", async () => {
      const task = await createOldTask({ status: AWAITING_APPROVAL });
      const projectReport = await ProjectReportFactory.create({ taskId: task.id, status: APPROVED });
      await SiteReportFactory.create({ taskId: task.id, status: APPROVED });
      await NurseryReportFactory.create({ taskId: task.id, status: APPROVED });
      await createHandler(projectReport).handle();
      await task.reload();
      expect(task.updatedAt).not.toEqual(task.createdAt);
      expect(task.status).toBe(APPROVED);
    });

    it("should throw if there is a report in a bad status", async () => {
      const task = await createOldTask({ status: AWAITING_APPROVAL });
      const projectReport = await ProjectReportFactory.create({ taskId: task.id, status: APPROVED });
      const siteReport = await SiteReportFactory.create({ taskId: task.id, status: DUE });
      await expect(createHandler(projectReport).handle()).rejects.toThrow(InternalServerErrorException);

      await siteReport.update({ status: STARTED });
      await expect(createHandler(projectReport).handle()).rejects.toThrow(InternalServerErrorException);
    });

    it("should move to needs-more-information if a report is in that status", async () => {
      const task = await createOldTask({ status: AWAITING_APPROVAL });
      const projectReport = await ProjectReportFactory.create({ taskId: task.id, status: APPROVED });
      const siteReport = await SiteReportFactory.create({ taskId: task.id, status: NEEDS_MORE_INFORMATION });
      await createHandler(projectReport).handle();
      await task.reload();
      expect(task.updatedAt).not.toEqual(task.createdAt);
      expect(task.status).toBe(NEEDS_MORE_INFORMATION);

      await task.update({ status: AWAITING_APPROVAL });
      await siteReport.update({ status: AWAITING_APPROVAL, updateRequestStatus: NEEDS_MORE_INFORMATION });
      await createHandler(projectReport).handle();
      await task.reload();
      expect(task.updatedAt).not.toEqual(task.createdAt);
      expect(task.status).toBe(NEEDS_MORE_INFORMATION);
    });

    it("should move the task to awaiting-approval when all reports are in awaiting-approval", async () => {
      const task = await createOldTask({ status: NEEDS_MORE_INFORMATION });
      const projectReport = await ProjectReportFactory.create({ taskId: task.id, status: AWAITING_APPROVAL });
      await SiteReportFactory.create({ taskId: task.id, status: AWAITING_APPROVAL });
      await NurseryReportFactory.create({
        taskId: task.id,
        status: NEEDS_MORE_INFORMATION,
        updateRequestStatus: AWAITING_APPROVAL
      });
      await createHandler(projectReport).handle();
      await task.reload();
      expect(task.updatedAt).not.toEqual(task.createdAt);
      expect(task.status).toBe(AWAITING_APPROVAL);
    });

    it("should send status update email for FinancialReport to createdBy user", async () => {
      mockUserId();
      const user = await UserFactory.create();
      const financialReport = await FinancialReportFactory.create({
        status: APPROVED,
        createdBy: user.id
      });

      await new EntityStatusUpdate(eventService, financialReport).handle();

      expect(eventService.emailQueue.add).toHaveBeenCalledWith(
        "statusUpdate",
        expect.objectContaining({ type: "financialReports", id: financialReport.id })
      );
    });
  });
});
