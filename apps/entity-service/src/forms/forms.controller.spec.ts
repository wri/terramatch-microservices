import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { Test } from "@nestjs/testing";
import { FormGetQueryDto, FormIndexQueryDto } from "./dto/form-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { Form } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { FormFactory, FormQuestionFactory, FormSectionFactory } from "@terramatch-microservices/database/factories";
import { StoreFormAttributes } from "./dto/form.dto";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";

describe("FormsController", () => {
  let controller: FormsController;
  let service: DeepMocked<FormsService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FormsController],
      providers: [
        { provide: FormsService, useValue: (service = createMock<FormsService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() }
      ]
    }).compile();

    controller = module.get(FormsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("index", () => {
    it("calls addIndex on the service", async () => {
      const query: FormIndexQueryDto = { search: "foo", type: "nursery" };
      await controller.index(query);
      expect(service.addIndex).toHaveBeenCalledWith(expect.any(DocumentBuilder), query);
    });
  });

  describe("get", () => {
    it("pulls the form instance and builds the full DTO", async () => {
      const form = {} as Form;
      const query: FormGetQueryDto = { translated: false };
      service.findOne.mockResolvedValue(form);
      await controller.get("fake-uuid", query);
      expect(service.findOne).toHaveBeenCalledWith("fake-uuid");
      expect(service.addFullDto).toHaveBeenCalledWith(expect.any(DocumentBuilder), form, false);
    });
  });

  describe("delete", () => {
    beforeEach(() => {
      policyService.getPermissions.mockResolvedValue(["custom-forms_manage"]);
    });

    it("throws if the form is published", async () => {
      service.findOne.mockResolvedValue({ published: true } as Form);
      await expect(controller.delete("fake-uuid")).rejects.toThrow(BadRequestException);
    });

    it("Destroys the form and all questions", async () => {
      const form = await FormFactory.create({ published: false });
      const sections = await FormSectionFactory.createMany(2, { formId: form.uuid });
      const questions = [
        ...(await FormQuestionFactory.createMany(3, { formSectionId: sections[0].id })),
        ...(await FormQuestionFactory.createMany(2, { formSectionId: sections[1].id }))
      ];
      service.findOne.mockResolvedValue(form);
      await controller.delete(form.uuid);

      await form.reload({ paranoid: false });
      await Promise.all(sections.map(section => section.reload({ paranoid: false })));
      await Promise.all(questions.map(question => question.reload({ paranoid: false })));
      expect(form.deletedAt).not.toBeNull();
      for (const section of sections) {
        expect(section.deletedAt).not.toBeNull();
      }
      for (const question of questions) {
        expect(question.deletedAt).not.toBeNull();
      }
    });
  });

  describe("create", () => {
    it("calls store on the service", async () => {
      const form = {} as Form;
      service.store.mockResolvedValue(form);
      const attributes: StoreFormAttributes = {
        title: "",
        submissionMessage: "",
        published: false
      };
      await controller.create({ data: { type: "forms", attributes } });
      expect(service.store).toHaveBeenCalledWith(attributes);
      expect(service.addFullDto).toHaveBeenCalledWith(expect.any(DocumentBuilder), form, false);
    });
  });

  describe("update", () => {
    it("calls store on the service", async () => {
      const form = {} as Form;
      service.findOne.mockResolvedValue(form);
      const attributes: StoreFormAttributes = {
        title: "",
        submissionMessage: "",
        published: false
      };
      await controller.update("fake-uuid", { data: { id: "fake-uuid", type: "forms", attributes } });
      expect(service.findOne).toHaveBeenCalledWith("fake-uuid");
      expect(service.store).toHaveBeenCalledWith(attributes, form);
      expect(service.addFullDto).toHaveBeenCalledWith(expect.any(DocumentBuilder), form, false);
    });
  });
});
