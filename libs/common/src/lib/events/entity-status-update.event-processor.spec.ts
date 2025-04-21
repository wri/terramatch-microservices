/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventService } from "./event.service";
import { EntityStatusUpdate } from "./entity-status-update.event-processor";
import { ProjectFactory, UpdateRequestFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { RequestContext } from "nestjs-request-context";
import { ActionFactory } from "@terramatch-microservices/database/factories/action.factory";
import { Action, AuditStatus } from "@terramatch-microservices/database/entities";
import { faker } from "@faker-js/faker";

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
    const processor = new EntityStatusUpdate(eventService, await UpdateRequestFactory.forProject.create());
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
    const project = await ProjectFactory.create({ status: "approved" });
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
    const project = await ProjectFactory.create({ status: "approved", feedback });
    await new EntityStatusUpdate(eventService, project).handle();

    const auditStatus = await AuditStatus.for(project).findOne({ order: [["createdAt", "DESC"]] });
    expect(auditStatus).toMatchObject({
      createdBy: user.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
      comment: `Approved: ${feedback}`
    });
  });
});
