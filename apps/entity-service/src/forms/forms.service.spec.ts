import { FormsService } from "./forms.service";
import { Test } from "@nestjs/testing";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { NotFoundException } from "@nestjs/common";
import {
  FormFactory,
  FormQuestionFactory,
  FormQuestionOptionFactory,
  FormSectionFactory,
  FormTableHeaderFactory,
  MediaFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { Form, FormQuestion, FormSection } from "@terramatch-microservices/database/entities";
import { buildJsonApi, Resource } from "@terramatch-microservices/common/util";
import { FormFullDto, FormLightDto } from "./dto/form.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { pick } from "lodash";
import { mockUserId } from "@terramatch-microservices/common/policies/policy.service.spec";

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

  describe("addFullDto", () => {
    const setupTestForm = async (translated: boolean) => {
      mockUserId((await UserFactory.create()).id);
      mediaService.getUrl.mockReturnValue("fake-url");
      localizationService.translateIds.mockResolvedValue({
        1: "First Translation",
        2: "Second Translation",
        3: "Third Translation",
        4: "Fourth Translation"
      });

      const form = await FormFactory.create({ titleId: 1 });
      await MediaFactory.forForm.create({ modelId: form.id, collectionName: "banner" });
      const sections = [
        await FormSectionFactory.create({ order: 1, titleId: 2, formId: form.uuid }),
        await FormSectionFactory.create({ order: 0, formId: form.uuid })
      ];

      // one text question in the first section
      const textQuestion = await FormQuestionFactory.create({
        order: 0,
        labelId: 3,
        formSectionId: sections[0].id,
        validation: { required: true }
      });
      const textQuestionMatch = {
        inputType: "text",
        placeholder: textQuestion.placeholder ?? null,
        description: textQuestion.description ?? null,
        validation: textQuestion.validation ?? null,
        name: textQuestion.uuid,
        label: translated ? "Third Translation" : textQuestion.label ?? null
      };

      // one select question in the first section
      const selectQuestion = await FormQuestionFactory.create({
        order: 1,
        descriptionId: 4,
        formSectionId: sections[0].id,
        inputType: "select",
        multiChoice: true
      });
      const options = [
        await FormQuestionOptionFactory.create({ order: 1, labelId: 2, formQuestionId: selectQuestion.id }),
        await FormQuestionOptionFactory.create({ order: 0, formQuestionId: selectQuestion.id })
      ];
      await MediaFactory.forFormQuestionOption.create({ modelId: options[1].id, collectionName: "image" });
      const selectQuestionMatch = {
        inputType: "select",
        label: selectQuestion.label ?? null,
        placeholder: selectQuestion.placeholder ?? null,
        description: translated ? "Fourth Translation" : selectQuestion.description ?? null,
        // The order should swap because of the `order` field
        options: [
          {
            slug: options[1].slug,
            label: options[1].label,
            // These indicate that the the associated media was found - the fake url comes from the
            // mocked media service.
            imageUrl: "fake-url",
            thumbUrl: "fake-url"
          },
          {
            slug: options[0].slug,
            label: translated ? "Second Translation" : options[0].label,
            imageUrl: options[0].imageUrl,
            thumbUrl: null
          }
        ]
      };

      // one condition question in the second section
      const conditionQuestion = await FormQuestionFactory.create({
        order: 1,
        placeholderId: 1,
        formSectionId: sections[1].id,
        inputType: "conditional"
      });
      const conditionChild = await FormQuestionFactory.create({
        formSectionId: sections[1].id,
        parentId: conditionQuestion.uuid
      });
      const conditionQuestionMatch = {
        inputType: "conditional",
        label: conditionQuestion.label ?? null,
        placeholder: translated ? "First Translation" : conditionQuestion.placeholder ?? null,
        name: conditionQuestion.uuid,
        children: [
          {
            inputType: "text",
            label: conditionChild.label ?? null,
            placeholder: conditionChild.placeholder ?? null,
            name: conditionChild.uuid
          }
        ]
      };

      // one table input question in the second section
      const tableQuestion = await FormQuestionFactory.create({
        order: 0,
        formSectionId: sections[1].id,
        inputType: "tableInput"
      });
      const headers = [
        await FormTableHeaderFactory.create({ order: 1, labelId: 3, formQuestionId: tableQuestion.id }),
        await FormTableHeaderFactory.create({ order: 0, formQuestionId: tableQuestion.id })
      ];
      const tableChild = await FormQuestionFactory.create({
        formSectionId: sections[1].id,
        parentId: tableQuestion.uuid
      });
      const tableQuestionMatch = {
        inputType: "tableInput",
        label: tableQuestion.label ?? null,
        name: tableQuestion.uuid,
        children: [
          {
            inputType: "text",
            label: tableChild.label ?? null,
            name: tableChild.uuid
          }
        ],
        tableHeaders: [headers[1].label, translated ? "Third Translation" : headers[0].label]
      };

      const formMatch = {
        ...pick(form, "subtitle", "description", "frameworkKey"),
        translated,
        title: translated ? "First Translation" : form.title ?? null,
        bannerUrl: "fake-url",
        sections: [
          {
            id: sections[1].uuid,
            description: sections[1].description,
            title: sections[1].title,
            questions: [tableQuestionMatch, conditionQuestionMatch]
          },
          {
            id: sections[0].uuid,
            description: sections[0].description,
            title: translated ? "Second Translation" : sections[0].title,
            questions: [textQuestionMatch, selectQuestionMatch]
          }
        ]
      };

      return { form, formMatch };
    };

    it("throws if the user ID is invalid", async () => {
      mockUserId(0);
      await expect(
        service.addFullDto(buildJsonApi<FormFullDto>(FormFullDto), await FormFactory.create(), true)
      ).rejects.toThrow(BadRequestException);
    });

    it("returns the full DTO", async () => {
      const { form, formMatch } = await setupTestForm(true);
      const document = serialize(await service.addFullDto(buildJsonApi<FormFullDto>(FormFullDto), form, true));
      const dto = (document.data as Resource).attributes;
      expect(dto).toMatchObject(formMatch);
    });

    it("avoids translations if translate is false", async () => {
      const { form, formMatch } = await setupTestForm(false);
      const document = serialize(await service.addFullDto(buildJsonApi<FormFullDto>(FormFullDto), form, false));
      const dto = (document.data as Resource).attributes;
      expect(dto).toMatchObject(formMatch);
    });
  });
});
