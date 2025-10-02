import { FormsService } from "./forms.service";
import { Test } from "@nestjs/testing";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { NotFoundException } from "@nestjs/common";
import { FormFactory, MediaFactory } from "@terramatch-microservices/database/factories";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { Form, FormQuestion, FormSection } from "@terramatch-microservices/database/entities";
import { buildJsonApi, Resource } from "@terramatch-microservices/common/util";
import { FormLightDto } from "./dto/form.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { pick } from "lodash";

describe("FormsService", () => {
  let service: FormsService;
  let mediaService: DeepMocked<MediaService>;
  let localizationService: DeepMocked<LocalizationService>;

  beforeEach(async () => {
    await Form.truncate();
    await FormSection.truncate();
    await FormQuestion.truncate();

    const module = await Test.createTestingModule({
      providers: [
        { provide: LocalizationService, useValue: (localizationService = createMock<LocalizationService>()) },
        { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) },
        FormsService
      ]
    }).compile();

    service = await module.resolve(FormsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findOne", () => {
    it("throws not found if the uuid is invalid", async () => {
      await expect(service.findOne("foo")).rejects.toThrow(NotFoundException);
    });

    it("returns the form for the UUID", async () => {
      const { uuid } = await FormFactory.create();
      const form = await service.findOne(uuid);
      expect(form.uuid).toBe(uuid);
    });
  });

  describe("findMany", () => {
    it("throws if the sort field is invalid", async () => {
      await expect(service.findMany({ sort: { field: "foo" } })).rejects.toThrow(BadRequestException);
    });

    it("sorts", async () => {
      await FormFactory.create({ title: "Zoological Reports" });
      await FormFactory.create({ title: "Ancient Egyptian Reports" });
      await FormFactory.create({ title: "Mayan Temple Reports" });
      let result = await service.findMany({ sort: { field: "title" } });
      expect(result.forms.map(({ title }) => title)).toEqual([
        "Ancient Egyptian Reports",
        "Mayan Temple Reports",
        "Zoological Reports"
      ]);
      result = await service.findMany({ sort: { field: "title", direction: "DESC" } });
      expect(result.forms.map(({ title }) => title)).toEqual([
        "Zoological Reports",
        "Mayan Temple Reports",
        "Ancient Egyptian Reports"
      ]);
    });

    it("filters", async () => {
      await FormFactory.create({ type: "application" });
      await FormFactory.create({ type: "project" });
      const result = await service.findMany({ type: "project" });
      expect(result.forms.length).toBe(1);
      expect(result.forms[0].type).toBe("project");
    });

    it("searches", async () => {
      await FormFactory.create({ title: "Zoological Reports" });
      await FormFactory.create({ title: "Mayan Temple Reports" });
      const result = await service.findMany({ search: "logical" });
      expect(result.forms.length).toBe(1);
      expect(result.forms[0].title).toBe("Zoological Reports");
    });
  });

  describe("addIndex", () => {
    it("adds the light DTOs", async () => {
      mediaService.getUrl.mockReturnValue("fake-url");
      const forms = [...(await FormFactory.createMany(2)), await FormFactory.create({ published: false })];
      await MediaFactory.forForm.create({ modelId: forms[0].id, collectionName: "banner" });
      const document = serialize(await service.addIndex(buildJsonApi<FormLightDto>(FormLightDto), {}));
      const dtos = document.data as Resource[];
      expect(dtos.length).toBe(forms.length);
      expect(dtos[0].attributes).toEqual({
        ...pick(forms[0], "uuid", "title", "type", "published"),
        bannerUrl: "fake-url",
        lightResource: true
      });
      expect(dtos[1].attributes).toEqual({
        ...pick(forms[1], "uuid", "title", "type", "published"),
        bannerUrl: null,
        lightResource: true
      });
      expect(dtos[2].attributes).toEqual({
        ...pick(forms[2], "uuid", "title", "type", "published"),
        bannerUrl: null,
        lightResource: true
      });
    });
  });

  // describe("addFullDto", () => {
  //   it("returns the full DTO", async () => {
  //     mediaService.getUrl.mockReturnValue("fake-url");
  //
  //     const translations = {
  //       1: "First Translation",
  //       2: "Second Translation",
  //       3: "Third Translation",
  //       4: "Fourth Translation"
  //     };
  //
  //     const form = await FormFactory.create({ titleId: 1 });
  //     await MediaFactory.forForm.create({ modelId: form.id, collectionName: "banner" });
  //     const sections = await FormSectionFactory.createMany(2, { titleId: 2, formId: form.uuid });
  //
  //     // one text question in the first section
  //     const textQuestion = await FormQuestionFactory.create({
  //       labelId: 3,
  //       formSectionId: sections[0].id,
  //       validation: { required: true }
  //     });
  //     const textQuestionMatch = {
  //       ...pick(textQuestion, "inputType", "placeholder", "description", "validation"),
  //       name: textQuestion.uuid,
  //       label: "Third Translation"
  //     };
  //
  //     // one select question in the first section
  //     const selectQuestion = await FormQuestionFactory.create({
  //       descriptionId: 4,
  //       formSectionId: sections[0].id,
  //       inputType: "select",
  //       multiChoice: true
  //     });
  //     const options = [
  //       await FormQuestionOptionFactory.create({ order: 1, labelId: 2, formQuestionId: selectQuestion.id }),
  //       await FormQuestionOptionFactory.create({ order: 0, formQuestionId: selectQuestion.id })
  //     ];
  //     // one media for the first form option. remember fake-url
  //     const selectQuestionMatch = {
  //       ...pick(selectQuestion, "inputType", "label", "placeholder"),
  //       description: "Fourth Translation",
  //       options: [{}]
  //     };
  //
  //     // one condition question in the second section
  //     const conditionQuestion = await FormQuestionFactory.create({
  //       placeholderId: 1,
  //       formSectionId: sections[0].id,
  //       inputType: "conditional"
  //     });
  //     // one table input question in the second section
  //     const tableQuestion = await FormQuestionFactory.create({
  //       formSectionId: sections[1].id,
  //       inputType: "tableInput"
  //     });
  //   });
  // });
});
