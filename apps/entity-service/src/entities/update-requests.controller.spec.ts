import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { EntitiesService } from "./entities.service";
import { FormDataService } from "./form-data.service";
import { StubProcessor } from "./entities.controller.spec";
import { FormFactory, ProjectFactory, UpdateRequestFactory } from "@terramatch-microservices/database/factories";
import { UpdateRequestsController } from "./update-requests.controller";
import { Form, Project, UpdateRequest } from "@terramatch-microservices/database/entities";
import { Resource } from "@terramatch-microservices/common/util/json-api-builder";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { UpdateRequestUpdateBody } from "./dto/update-request.dto";
import { UpdateRequestStatus } from "@terramatch-microservices/database/constants/status";

describe("UpdateRequestsController", () => {
  let controller: UpdateRequestsController;
  let service: DeepMocked<FormDataService>;
  let policyService: DeepMocked<PolicyService>;
  let entitiesService: DeepMocked<EntitiesService>;
  let processor: StubProcessor;

  beforeEach(async () => {
    await Form.truncate();

    const module = await Test.createTestingModule({
      controllers: [UpdateRequestsController],
      providers: [
        { provide: FormDataService, useValue: (service = createMock<FormDataService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: EntitiesService, useValue: (entitiesService = createMock<EntitiesService>()) }
      ]
    }).compile();

    controller = module.get(UpdateRequestsController);
    processor = new StubProcessor(entitiesService, "projects");
    entitiesService.createEntityProcessor.mockImplementation(() => processor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findUpdateRequest", () => {
    it("throws if the entity is not found", async () => {
      await expect(controller.updateRequestGet({ entity: "projects", uuid: "fake-uuid" })).rejects.toThrow(
        "Entity not found for uuid: fake-uuid"
      );
    });

    it("throws if an update request is not found", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      await expect(controller.updateRequestGet({ entity: "projects", uuid: project.uuid })).rejects.toThrow(
        `Update request not found for uuid: ${project.uuid}`
      );
    });

    it("throws if the form is not found", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      await UpdateRequestFactory.project(project).create();
      await expect(controller.updateRequestGet({ entity: "projects", uuid: project.uuid })).rejects.toThrow(
        `Form not found for update request: ${project.uuid}`
      );
    });
  });

  describe("updateRequestGet", () => {
    it("returns a populated DTO", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      const updateRequest = await UpdateRequestFactory.project(project).create({
        content: { color: "red" }
      });
      const form = await FormFactory.create({ frameworkKey: project.frameworkKey, model: Project.LARAVEL_TYPE });
      service.getAnswers.mockResolvedValue({ color: "blue" });

      const result = serialize(await controller.updateRequestGet({ entity: "projects", uuid: project.uuid }));
      const resource = result.data as Resource;
      expect(policyService.authorize).toHaveBeenCalledWith("approve", project);
      expect(resource.id).toBe(`projects:${project.uuid}`);
      expect(resource.type).toBe("updateRequests");
      expect(resource.attributes).toMatchObject({
        formUuid: form.uuid,
        status: updateRequest.status,
        entityAnswers: { color: "blue" },
        updateRequestAnswers: { color: "red" }
      });
    });
  });

  describe("updateRequestUpdate", () => {
    const createPayload = (
      id: string,
      status?: UpdateRequestStatus,
      feedback?: string,
      feedbackFields?: string[]
    ): UpdateRequestUpdateBody => ({
      data: { type: "updateRequests", id, attributes: { status, feedback, feedbackFields } }
    });

    it("throws if the payload and path do not match", async () => {
      await expect(
        controller.updateRequestUpdate({ entity: "projects", uuid: "fake-uuid" }, createPayload("fake-uuid"))
      ).rejects.toThrow("Payload type and ID do not match the request path");
    });

    it("does not update if the status has not changed", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      const updateRequest = await UpdateRequestFactory.project(project).create({
        content: { color: "red" }
      });
      await FormFactory.create({ frameworkKey: project.frameworkKey, model: Project.LARAVEL_TYPE });
      service.getAnswers.mockResolvedValue({ color: "blue" });

      jest.spyOn(UpdateRequest, "findOne").mockResolvedValue(updateRequest);
      const updateSpy = jest.spyOn(updateRequest, "update");
      await controller.updateRequestUpdate(
        { entity: "projects", uuid: project.uuid },
        createPayload(`projects:${project.uuid}`, updateRequest.status)
      );
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("updates if the status has changed", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      const updateRequest = await UpdateRequestFactory.project(project).create({
        status: "awaiting-approval",
        content: { color: "red" }
      });
      await FormFactory.create({ frameworkKey: project.frameworkKey, model: Project.LARAVEL_TYPE });
      service.getAnswers.mockResolvedValue({ color: "blue" });

      jest.spyOn(UpdateRequest, "findOne").mockResolvedValue(updateRequest);
      const updateSpy = jest.spyOn(updateRequest, "update");
      await controller.updateRequestUpdate(
        { entity: "projects", uuid: project.uuid },
        createPayload(`projects:${project.uuid}`, "needs-more-information", "feedback", ["feedback", "fields"])
      );
      await updateRequest.reload();
      expect(updateSpy).toHaveBeenCalled();
      expect(policyService.authorize).toHaveBeenCalledWith("approve", project);
      expect(updateRequest.status).toBe("needs-more-information");
      expect(updateRequest.feedback).toBe("feedback");
      expect(updateRequest.feedbackFields).toMatchObject(["feedback", "fields"]);
      expect(service.storeEntityAnswers).not.toHaveBeenCalledWith();
    });

    it("stores the update request answers if the status is approved", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      await UpdateRequestFactory.project(project).create({
        status: "awaiting-approval",
        content: { color: "red" }
      });
      const form = await FormFactory.create({ frameworkKey: project.frameworkKey, model: Project.LARAVEL_TYPE });
      await form.reload();
      service.getAnswers.mockResolvedValue({ color: "blue" });

      await controller.updateRequestUpdate(
        { entity: "projects", uuid: project.uuid },
        createPayload(`projects:${project.uuid}`, "approved")
      );
      expect(service.storeEntityAnswers).toHaveBeenCalledWith(project, form, expect.objectContaining({ color: "red" }));
    });
  });
});
