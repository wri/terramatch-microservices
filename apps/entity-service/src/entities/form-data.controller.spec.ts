/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { EntitiesService } from "./entities.service";
import { FormDataController } from "./form-data.controller";
import { FormDataService } from "./form-data.service";
import { StubProcessor } from "./entities.controller.spec";
import { Form, Project } from "@terramatch-microservices/database/entities";
import { FormFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { FormDataDto, UpdateFormDataBody } from "./dto/form-data.dto";
import { mockRequestContext, serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util/json-api-builder";
import { Dictionary } from "lodash";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";

describe("FormDataController", () => {
  let controller: FormDataController;
  let service: DeepMocked<FormDataService>;
  let policyService: PolicyService;
  let entitiesService: DeepMocked<EntitiesService>;
  let processor: StubProcessor;

  beforeEach(async () => {
    await Form.truncate();

    const module = await Test.createTestingModule({
      controllers: [FormDataController],
      providers: [
        PolicyService,
        { provide: FormDataService, useValue: (service = createMock<FormDataService>()) },
        {
          provide: EntitiesService,
          useValue: (entitiesService = createMock<EntitiesService>({
            get userLocale() {
              return "en-US" as ValidLocale;
            }
          }))
        }
      ]
    }).compile();

    policyService = module.get(PolicyService);
    controller = module.get(FormDataController);
    processor = new StubProcessor(entitiesService, "projects");
    entitiesService.createEntityProcessor.mockImplementation(() => processor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("formDataGet", () => {
    it("throws if the entity is not found", async () => {
      await expect(controller.get({ entity: "projects", uuid: "fake-uuid" })).rejects.toThrow(
        "Entity not found for uuid: fake-uuid"
      );
    });

    it("throws if the form is not found", async () => {
      const project = await ProjectFactory.create();
      mockRequestContext({ userId: 123, permissions: [`framework-${project.frameworkKey}`] });
      processor.findOne.mockResolvedValue(project);
      await expect(controller.get({ entity: "projects", uuid: project.uuid })).rejects.toThrow(
        "Form for entity not found"
      );
    });

    it("checks the policy and returns the form data", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      const form = await FormFactory.create({ frameworkKey: project.frameworkKey, model: Project.LARAVEL_TYPE });
      await form.reload(); // this seems to be needed to get the matching object to what is returned from findOne()
      const localeSpy = jest.spyOn(entitiesService, "userLocale", "get").mockReturnValue("es-MX");
      const dto = new FormDataDto();
      service.getDtoForEntity.mockResolvedValue(dto);
      const authSpy = jest.spyOn(policyService, "authorize").mockResolvedValue();

      const result = serialize(await controller.get({ entity: "projects", uuid: project.uuid }));
      expect(localeSpy).toHaveBeenCalled();
      expect(service.getDtoForEntity).toHaveBeenCalledWith("projects", project, form, "es-MX");
      expect(authSpy).toHaveBeenCalledWith("read", project);
      expect((result.data as Resource).id).toBe(`projects|${project.uuid}`);
      expect((result.data as Resource).type).toBe("formData");
    });
  });

  describe("formDataUpdate", () => {
    const createPayload = (id: string, answers: Dictionary<unknown>): UpdateFormDataBody => ({
      data: { type: "formData", id, attributes: { answers } }
    });

    it("throws if the payload and path do not match", async () => {
      await expect(
        controller.update({ entity: "projects", uuid: "fake-uuid" }, createPayload("fake-uuid", {}))
      ).rejects.toThrow("Id in payload does not match entity and uuid from path");
    });

    it("throws if the model is not found", async () => {
      await expect(
        controller.update({ entity: "projects", uuid: "fake-uuid" }, createPayload("projects|fake-uuid", {}))
      ).rejects.toThrow("Entity not found for uuid: fake-uuid");
    });

    it("throws if the form is not found", async () => {
      const project = await ProjectFactory.create();
      mockRequestContext({ userId: 123, permissions: [`framework-${project.frameworkKey}`] });
      processor.findOne.mockResolvedValue(project);
      await expect(
        controller.update({ entity: "projects", uuid: project.uuid }, createPayload(`projects|${project.uuid}`, {}))
      ).rejects.toThrow("Form for entity not found");
    });

    it("checks policy and stores answers", async () => {
      const project = await ProjectFactory.create();
      processor.findOne.mockResolvedValue(project);
      const form = await FormFactory.create({ frameworkKey: project.frameworkKey, model: Project.LARAVEL_TYPE });
      await form.reload();
      const localeSpy = jest.spyOn(entitiesService, "userLocale", "get").mockReturnValue("es-MX");
      const dto = new FormDataDto();
      service.getDtoForEntity.mockResolvedValue(dto);
      const authSpy = jest.spyOn(policyService, "authorize").mockResolvedValue();

      const answers = { jedi: "Obi-Wan Kenobi", sith: "Darth Vader" };
      const result = serialize(
        await controller.update(
          { entity: "projects", uuid: project.uuid },
          createPayload(`projects|${project.uuid}`, answers)
        )
      );
      expect(service.storeEntityAnswers).toHaveBeenCalledWith(project, form, answers);
      expect(localeSpy).toHaveBeenCalled();
      expect(service.getDtoForEntity).toHaveBeenCalledWith("projects", project, form, "es-MX");
      expect(authSpy).toHaveBeenCalledWith("update", project);
      expect((result.data as Resource).id).toBe(`projects|${project.uuid}`);
      expect((result.data as Resource).type).toBe("formData");
    });
  });
});
