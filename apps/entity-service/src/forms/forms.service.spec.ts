/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { FormsService } from "./forms.service";
import { faker } from "@faker-js/faker";
import { Test } from "@nestjs/testing";
import { LocalizationService, Translations } from "@terramatch-microservices/common/localization/localization.service";
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
import {
  Form,
  FormQuestion,
  FormQuestionOption,
  FormSection,
  FormTableHeader
} from "@terramatch-microservices/database/entities";
import { buildJsonApi, Resource } from "@terramatch-microservices/common/util";
import { FormFullDto, FormLightDto, StoreFormAttributes } from "./dto/form.dto";
import { mockUserId, serialize } from "@terramatch-microservices/common/util/testing";
import { pick } from "lodash";
import { Attributes, Model } from "sequelize";

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
      await MediaFactory.forForm(forms[0]).create({ collectionName: "banner" });
      const document = serialize(await service.addIndex(buildJsonApi<FormLightDto>(FormLightDto), {}));
      const dtos = document.data as Resource[];
      expect(dtos.length).toBe(forms.length);
      expect(dtos[0].attributes).toEqual({
        ...pick(forms[0], "uuid", "title", "type", "published"),
        banner: expect.objectContaining({ url: "fake-url" }),
        lightResource: true
      });
      expect(dtos[1].attributes).toEqual({
        ...pick(forms[1], "uuid", "title", "type", "published"),
        banner: null,
        lightResource: true
      });
      expect(dtos[2].attributes).toEqual({
        ...pick(forms[2], "uuid", "title", "type", "published"),
        banner: null,
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
      // Copied from the original service.
      localizationService.translateFields.mockImplementation(
        <M extends Model, K extends (keyof Attributes<M>)[]>(translations: Translations, model: M, fields: K) =>
          fields.reduce(
            (translated, field) => ({
              ...translated,
              [field]: translations[model[`${String(field)}Id` as Attributes<M>[number]] ?? -1] ?? model[field]
            }),
            {} as Record<(typeof fields)[number], string>
          )
      );

      const form = await FormFactory.create({ titleId: 1 });
      await MediaFactory.forForm(form).create({ collectionName: "banner" });
      const sections = [
        await FormSectionFactory.form(form).create({ order: 1, titleId: 2 }),
        await FormSectionFactory.form(form).create({ order: 0 })
      ];

      // one text question in the first section
      const textQuestion = await FormQuestionFactory.section(sections[0]).create({
        order: 0,
        labelId: 3,
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
      const selectQuestion = await FormQuestionFactory.section(sections[0]).create({
        order: 1,
        descriptionId: 4,
        formSectionId: sections[0].id,
        inputType: "select",
        multiChoice: true
      });
      const options = [
        await FormQuestionOptionFactory.forQuestion(selectQuestion).create({ order: 1, labelId: 2 }),
        await FormQuestionOptionFactory.forQuestion(selectQuestion).create({ order: 0 })
      ];
      await MediaFactory.forFormQuestionOption(options[1]).create({ collectionName: "image" });
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
      const conditionQuestion = await FormQuestionFactory.section(sections[1]).create({
        order: 1,
        placeholderId: 1,
        formSectionId: sections[1].id,
        inputType: "conditional"
      });
      const conditionChild = await FormQuestionFactory.section(sections[1]).create({
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
      const tableQuestion = await FormQuestionFactory.section(sections[1]).create({
        order: 0,
        formSectionId: sections[1].id,
        inputType: "tableInput"
      });
      const headers = [
        await FormTableHeaderFactory.forQuestion(tableQuestion).create({ order: 1, labelId: 3 }),
        await FormTableHeaderFactory.forQuestion(tableQuestion).create({ order: 0 })
      ];
      const tableChild = await FormQuestionFactory.section(sections[1]).create({
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
        banner: expect.objectContaining({ url: "fake-url" }),
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

  describe("store", () => {
    beforeEach(() => {
      mockUserId(123);
      localizationService.generateI18nId.mockResolvedValue(1);
    });

    it("creates a form from the attributes", async () => {
      const attributes: StoreFormAttributes = {
        title: faker.lorem.sentence(),
        frameworkKey: "ppc",
        type: "project",
        submissionMessage: faker.lorem.paragraph(),
        deadlineAt: faker.date.soon(),
        published: false,
        sections: [
          {
            title: faker.lorem.sentence(),
            description: faker.lorem.paragraph(),
            questions: [
              {
                linkedFieldKey: faker.lorem.slug(),
                inputType: "conditional",
                label: faker.lorem.slug(),
                validation: { required: true },
                children: [
                  {
                    inputType: "select",
                    label: faker.lorem.slug(),
                    options: [
                      {
                        slug: faker.lorem.slug(),
                        label: faker.lorem.slug()
                      },
                      {
                        slug: faker.lorem.slug(),
                        label: faker.lorem.slug(),
                        imageUrl: faker.image.url()
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            title: faker.lorem.sentence(),
            questions: [
              {
                inputType: "tableInput",
                label: faker.lorem.slug(),
                tableHeaders: [faker.lorem.slug(), faker.lorem.slug()]
              }
            ]
          }
        ]
      };

      const form = await service.store(attributes);
      expect(form.updatedBy).toBe("123");
      expect(form.published).toBe(false);
      expect(form.title).toBe(attributes.title);
      expect(form.frameworkKey).toBe(attributes.frameworkKey);
      expect(form.type).toBe(attributes.type);
      expect(form.submissionMessage).toBe(attributes.submissionMessage);
      expect(form.deadlineAt).toEqual(attributes.deadlineAt);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.title, undefined);

      const sections = await FormSection.findAll({ where: { formId: form.uuid }, order: ["order"] });
      expect(sections).toHaveLength(2);
      expect(sections[0].order).toBe(0);
      expect(sections[0].title).toBe(attributes.sections![0].title);
      expect(sections[0].description).toBe(attributes.sections![0].description);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.sections![0].title, undefined);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.sections![0].description, undefined);
      expect(sections[1].order).toBe(1);
      expect(sections[1].title).toBe(attributes.sections![1].title);
      expect(sections[1].description).toBeNull();
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(attributes.sections![1].title, undefined);

      const section0Questions = await FormQuestion.findAll({
        where: { formSectionId: sections[0].id },
        order: ["order"]
      });
      expect(section0Questions).toHaveLength(2);
      const conditional = section0Questions.find(({ parentId }) => parentId == null)!;
      const section0QuestionAttributes = attributes.sections![0].questions!;
      expect(conditional.order).toBe(0);
      expect(conditional.linkedFieldKey).toBe(section0QuestionAttributes[0].linkedFieldKey);
      expect(conditional.inputType).toBe("conditional");
      expect(conditional.label).toBe(section0QuestionAttributes[0].label);
      // @ts-expect-error untyped validation object
      expect(conditional.validation?.required).toBe(true);
      const select = section0Questions.find(({ parentId }) => parentId != null)!;
      expect(select.order).toBe(0);
      expect(select.inputType).toBe("select");
      expect(select.label).toBe(section0QuestionAttributes[0].children![0].label);
      const options = await FormQuestionOption.findAll({ where: { formQuestionId: select.id }, order: ["order"] });
      const optionsAttributes = section0QuestionAttributes[0].children![0].options!;
      expect(options).toHaveLength(2);
      expect(options[0].order).toBe(0);
      expect(options[0].slug).toBe(optionsAttributes[0].slug);
      expect(options[0].label).toBe(optionsAttributes[0].label);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(optionsAttributes[0].label, undefined);
      expect(options[1].order).toBe(1);
      expect(options[1].slug).toBe(optionsAttributes[1].slug);
      expect(options[1].label).toBe(optionsAttributes[1].label);
      expect(options[1].imageUrl).toBe(optionsAttributes[1].imageUrl);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(optionsAttributes[1].label, undefined);

      const section1Questions = await FormQuestion.findAll({
        where: { formSectionId: sections[1].id },
        order: ["order"]
      });
      expect(section1Questions).toHaveLength(1);
      const tableInput = section1Questions[0];
      const section1QuestionAttributes = attributes.sections![1].questions!;
      expect(tableInput.order).toBe(0);
      expect(tableInput.label).toBe(section1QuestionAttributes[0].label);
      expect(tableInput.inputType).toBe("tableInput");
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(section1QuestionAttributes[0].label, undefined);
      const headers = await FormTableHeader.findAll({ where: { formQuestionId: tableInput.id }, order: ["order"] });
      expect(headers).toHaveLength(2);
      expect(headers[0].label).toBe(section1QuestionAttributes[0].tableHeaders![0]);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(
        section1QuestionAttributes[0].tableHeaders![0],
        undefined
      );
      expect(headers[1].label).toBe(section1QuestionAttributes[0].tableHeaders![1]);
      expect(localizationService.generateI18nId).toHaveBeenCalledWith(
        section1QuestionAttributes[0].tableHeaders![1],
        undefined
      );
    });

    it("sets accept additional props on file inputs", async () => {
      const attributes: StoreFormAttributes = {
        title: faker.lorem.sentence(),
        frameworkKey: "ppc",
        type: "site",
        submissionMessage: faker.lorem.paragraph(),
        deadlineAt: faker.date.soon(),
        published: false,
        sections: [
          {
            title: faker.lorem.sentence(),
            description: faker.lorem.paragraph(),
            questions: [
              {
                label: faker.lorem.slug(),
                linkedFieldKey: "site-col-photos",
                inputType: "file",
                additionalProps: { with_private_checkbox: true }
              },
              {
                label: faker.lorem.slug(),
                linkedFieldKey: "invalid-linked-field",
                inputType: "file",
                additionalProps: { with_private_checkbox: false }
              }
            ]
          }
        ]
      };

      const form = await service.store(attributes);
      const sections = await FormSection.findAll({ where: { formId: form.uuid }, order: ["order"] });
      const questions = await FormQuestion.findAll({
        where: { formSectionId: sections[0].id },
        order: ["order"]
      });
      expect(questions).toHaveLength(2);
      expect(questions[0].additionalProps).toEqual({
        with_private_checkbox: true,
        accept: ["image/jpeg", "image/png", "video/mp4"]
      });
      expect(questions[1].additionalProps).toEqual({
        with_private_checkbox: false
      });
    });

    it("updates or creates table headers as needed", async () => {
      const form = await FormFactory.create();
      const section = await FormSectionFactory.form(form).create();
      const question = await FormQuestionFactory.section(section).create({ inputType: "tableInput" });
      const headers = await Promise.all(
        [0, 1].map(order => FormTableHeaderFactory.forQuestion(question).create({ order }))
      );
      const attributes: StoreFormAttributes = {
        title: form.title,
        frameworkKey: form.frameworkKey ?? undefined,
        type: form.type,
        submissionMessage: form.submissionMessage!,
        deadlineAt: faker.date.soon(),
        published: false,
        sections: [
          {
            id: section.uuid,
            title: section.title,
            description: section.description,
            questions: [
              {
                name: question.uuid,
                inputType: question.inputType,
                label: question.label,
                tableHeaders: [headers[1].label!, faker.lorem.word()]
              }
            ]
          }
        ]
      };

      await service.store(attributes, form);
      const updateHeaders = await FormTableHeader.findAll({ where: { formQuestionId: question.id }, order: ["order"] });
      expect(updateHeaders).toHaveLength(2);
      expect(updateHeaders[0].label).toBe(headers[1].label);
      expect(updateHeaders[1].label).toBe(attributes.sections![0].questions![0].tableHeaders![1]);
    });

    it("updates or creates options as needed", async () => {
      const form = await FormFactory.create();
      const section = await FormSectionFactory.form(form).create();
      const question = await FormQuestionFactory.section(section).create({ inputType: "select" });
      const options = await Promise.all(
        [0, 1, 2].map(order => FormQuestionOptionFactory.forQuestion(question).create({ order }))
      );
      const attributes: StoreFormAttributes = {
        title: form.title,
        frameworkKey: form.frameworkKey ?? undefined,
        type: form.type,
        submissionMessage: form.submissionMessage!,
        deadlineAt: faker.date.soon(),
        published: false,
        sections: [
          {
            id: section.uuid,
            title: section.title,
            description: section.description,
            questions: [
              {
                name: question.uuid,
                inputType: question.inputType,
                label: question.label,
                options: [
                  // result is new options at order 0 and 3, previous 0 should now be 1 and 2 is the same.
                  { slug: faker.lorem.slug(), label: faker.lorem.word() },
                  { slug: options[0].slug!, label: options[0].label },
                  { slug: options[2].slug!, label: options[2].label },
                  { slug: faker.lorem.slug(), label: faker.lorem.word() }
                ]
              }
            ]
          }
        ]
      };

      await service.store(attributes, form);
      const updateOptions = await FormQuestionOption.findAll({
        where: { formQuestionId: question.id },
        order: ["order"]
      });
      const attrOptions = attributes.sections![0].questions![0].options!;
      expect(updateOptions).toHaveLength(4);
      expect(updateOptions[0].dataValues).toMatchObject(attrOptions[0]);
      expect(updateOptions[1].dataValues).toMatchObject(attrOptions[1]);
      expect(updateOptions[2].dataValues).toMatchObject(attrOptions[2]);
      expect(updateOptions[3].dataValues).toMatchObject(attrOptions[3]);
    });

    it("removes questions that aren't included in the attributes", async () => {
      const form = await FormFactory.create();
      const section = await FormSectionFactory.form(form).create();
      const questions = [
        await FormQuestionFactory.section(section).create({ order: 0 }),
        await FormQuestionFactory.section(section).create({ order: 1 }),
        await FormQuestionFactory.section(section).create({ order: 2 })
      ];
      const attributes: StoreFormAttributes = {
        title: form.title,
        frameworkKey: form.frameworkKey ?? undefined,
        type: form.type,
        submissionMessage: form.submissionMessage!,
        deadlineAt: faker.date.soon(),
        published: false,
        sections: [
          {
            id: section.uuid,
            title: section.title,
            description: section.description,
            questions: [
              // scramble order and drop question 1,
              { name: questions[2].uuid, inputType: questions[2].inputType, label: questions[2].label },
              { name: questions[0].uuid, inputType: questions[0].inputType, label: questions[0].label }
            ]
          }
        ]
      };

      await service.store(attributes, form);
      const updateQuestions = await FormQuestion.findAll({ where: { formSectionId: section.id }, order: ["order"] });
      expect(updateQuestions).toHaveLength(2);
      expect(updateQuestions.map(({ uuid }) => uuid)).toEqual([questions[2].uuid, questions[0].uuid]);
    });

    it("removes sections that aren't included in the attributes", async () => {
      const form = await FormFactory.create();
      const sections = [
        await FormSectionFactory.form(form).create({ order: 0 }),
        await FormSectionFactory.form(form).create({ order: 1 }),
        await FormSectionFactory.form(form).create({ order: 2 })
      ];
      const questions = await Promise.all(sections.map(section => FormQuestionFactory.section(section).create()));
      const attributes: StoreFormAttributes = {
        title: form.title,
        frameworkKey: form.frameworkKey ?? undefined,
        type: form.type,
        submissionMessage: form.submissionMessage!,
        deadlineAt: faker.date.soon(),
        published: false,
        sections: [
          // scramble order and drop section 1
          {
            id: sections[2].uuid,
            title: sections[2].title,
            description: sections[2].description,
            questions: [{ name: questions[2].uuid, inputType: questions[2].inputType, label: questions[2].label }]
          },
          {
            id: sections[0].uuid,
            title: sections[0].title,
            description: sections[0].description,
            questions: [{ name: questions[0].uuid, inputType: questions[0].inputType, label: questions[0].label }]
          }
        ]
      };

      await service.store(attributes, form);
      const updateSections = await FormSection.findAll({ where: { formId: form.uuid }, order: ["order"] });
      expect(updateSections).toHaveLength(2);
      expect(updateSections.map(({ uuid }) => uuid)).toEqual([sections[2].uuid, sections[0].uuid]);
      // make sure questions in the removed section are almost gone.
      expect(await FormQuestion.count({ where: { formSectionId: sections[1].id } })).toBe(0);
    });
  });
});
