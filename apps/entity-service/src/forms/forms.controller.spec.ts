import { Response } from "express";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { Test } from "@nestjs/testing";
import { FormGetQueryDto, FormIndexQueryDto } from "./dto/form-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { Form } from "@terramatch-microservices/database/entities";
import { PolicyService } from "@terramatch-microservices/common";
import { FormFactory, FormQuestionFactory, FormSectionFactory } from "@terramatch-microservices/database/factories";
import { StoreFormAttributes } from "./dto/form.dto";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { mockRequestContext } from "@terramatch-microservices/common/util/testing";

describe("FormsController", () => {
  let controller: FormsController;
  let service: DeepMocked<FormsService>;
  let policyService: PolicyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FormsController],
      providers: [
        PolicyService,
        { provide: FormsService, useValue: (service = createMock<FormsService>()) },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() }
      ]
    }).compile();

    policyService = module.get(PolicyService);
    controller = module.get(FormsController);

    mockRequestContext({ userId: 123, permissions: ["custom-forms-manage", "framework-ppc"] });
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
    it("deletes a published form", async () => {
      const form = await FormFactory.create({ published: true });
      service.findOne.mockResolvedValue(form);
      await controller.delete(form.uuid);
      await form.reload({ paranoid: false });
      expect(form.deletedAt).not.toBeNull();
    });

    it("Destroys the form and all questions", async () => {
      const form = await FormFactory.create({ published: false });
      const sections = await FormSectionFactory.form(form).createMany(2);
      const questions = [
        ...(await FormQuestionFactory.section(sections[0]).createMany(3)),
        ...(await FormQuestionFactory.section(sections[1]).createMany(2))
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
        submissionMessage: ""
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
      jest.spyOn(policyService, "authorize").mockResolvedValue();
      const attributes: StoreFormAttributes = {
        title: "",
        submissionMessage: ""
      };
      await controller.update("fake-uuid", { data: { id: "fake-uuid", type: "forms", attributes } });
      expect(service.findOne).toHaveBeenCalledWith("fake-uuid");
      expect(service.store).toHaveBeenCalledWith(attributes, form);
      expect(service.addFullDto).toHaveBeenCalledWith(expect.any(DocumentBuilder), form, false);
    });
  });

  describe("exportSubmissionCsv", () => {
    it("calls exportAllSubmissions on the service", async () => {
      const response = {} as Response;
      await controller.exportSubmissionsCsv("fake-uuid", response);
      expect(service.exportSubmissions).toHaveBeenCalledWith("fake-uuid", response);
    });
  });
});
