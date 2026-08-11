import { OptionLabelModel, OptionLabelsController } from "./option-labels.controller";
import { Test } from "@nestjs/testing";
import { FormOptionList, FormOptionListOption, FormQuestion } from "@terramatch-microservices/database/entities";
import {
  FormOptionListFactory,
  FormOptionListOptionFactory,
  FormQuestionOptionFactory
} from "@terramatch-microservices/database/factories";
import { faker } from "@faker-js/faker";
import { mockUserContext, serialize } from "@terramatch-microservices/common/util/testing";
import { NotFoundException } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { createMock } from "@golevelup/ts-jest";
import { ConfigService } from "@nestjs/config";
import { TransifexApiService } from "@terramatch-microservices/transifex-api";

describe("OptionsLabelsController", () => {
  let controller: OptionLabelsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OptionLabelsController],
      providers: [
        LocalizationService,
        { provide: ConfigService, useValue: createMock<ConfigService>() },
        { provide: TransifexApiService, useValue: createMock<TransifexApiService>() }
      ]
    }).compile();

    controller = module.get(OptionLabelsController);

    jest.spyOn(controller["localizationService"], "localizeText").mockImplementation(async (text: string) => text);

    await FormOptionListOption.truncate();
    await FormQuestion.truncate();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("optionLabelsIndex", () => {
    it("should throw an error if ids is empty", async () => {
      mockUserContext({ userId: 123 });
      await expect(controller.optionLabelsIndex([])).rejects.toThrow("Set of ids is required");
    });

    it("should throw if no locale is found", async () => {
      mockUserContext({ userId: -1, locale: null });
      await expect(controller.optionLabelsIndex(["1"])).rejects.toThrow("Locale is required");
    });

    it("should return list option labels", async () => {
      const options = [await FormOptionListOptionFactory.create()];
      options.push(await FormOptionListOptionFactory.create({ imageUrl: faker.internet.url() }));
      await FormOptionListOptionFactory.create();

      mockUserContext({ userId: 123, locale: "en-US" });
      const document = serialize(await controller.optionLabelsIndex(options.map(({ slug }) => slug) as string[]));
      expect(document.data).toHaveLength(options.length);
      for (const { slug, label, imageUrl } of options) {
        expect(document.data).toContainEqual({
          id: slug,
          type: "optionLabels",
          attributes: { slug, label, imageUrl: imageUrl ?? null, altValue: null }
        });
      }
    });

    it("should supplement with form question labels", async () => {
      const options = [(await FormOptionListOptionFactory.create()) as OptionLabelModel];
      options.push((await FormOptionListOptionFactory.create({ imageUrl: faker.internet.url() })) as OptionLabelModel);
      await FormOptionListOptionFactory.create();
      options.push((await FormQuestionOptionFactory.forQuestion().create()) as OptionLabelModel);

      mockUserContext({ userId: 123, locale: "en-US" });
      const document = serialize(await controller.optionLabelsIndex(options.map(({ slug }) => slug) as string[]));
      expect(document.data).toHaveLength(options.length);
      for (const { slug, label, imageUrl } of options) {
        expect(document.data).toContainEqual({
          id: slug,
          type: "optionLabels",
          attributes: { slug, label, imageUrl: imageUrl ?? null, altValue: null }
        });
      }
    });

    it("should throw an error if no ids are found", async () => {
      mockUserContext({ userId: 123, locale: "en-US" });
      await expect(controller.optionLabelsIndex(["1", "2"])).rejects.toThrow("No records matching the given ids exist");
    });

    it("should translate", async () => {
      const listOption = await FormOptionListOptionFactory.create({ label: "Hello" });
      const questionOption = await FormQuestionOptionFactory.forQuestion().create({ label: "World" });
      const options = [listOption, questionOption];

      jest
        .spyOn(controller["localizationService"], "localizeText")
        .mockImplementation(async (text: string) => `translated:${text}`);

      mockUserContext({ userId: 123, locale: "es-MX" });
      const document = serialize(await controller.optionLabelsIndex(options.map(({ slug }) => slug) as string[]));
      expect(document.data).toHaveLength(options.length);
      for (const { slug, label, imageUrl } of options) {
        expect(document.data).toContainEqual({
          id: slug,
          type: "optionLabels",
          attributes: {
            slug,
            imageUrl: imageUrl ?? null,
            label: `translated:${label}`,
            altValue: null
          }
        });
      }
    });
  });

  describe("findList", () => {
    beforeEach(async () => {
      await FormOptionListOption.truncate();
      await FormOptionList.truncate();
    });

    it("should throw an error if listKey does not exist", async () => {
      mockUserContext({ userId: 123 });
      await expect(controller.findList("fake-list-key")).rejects.toThrow(NotFoundException);
    });

    it("should throw an error if the listKey has no associated options", async () => {
      const { key } = await FormOptionListFactory.create();
      mockUserContext({ userId: 123 });
      await expect(controller.findList(key)).rejects.toThrow(NotFoundException);
    });

    it("should throw if no locale is found", async () => {
      mockUserContext({ userId: -1, locale: null });
      await expect(controller.findList("fake-list-key")).rejects.toThrow("Locale is required");
    });

    it("should return the options associated with the listKey", async () => {
      const { key, id } = await FormOptionListFactory.create();
      const options = await FormOptionListOptionFactory.createMany(5, { formOptionListId: id });
      mockUserContext({ userId: 123 });
      const document = serialize(await controller.findList(key));
      expect(document.data).toHaveLength(options.length);
      for (const { slug, label, imageUrl } of options) {
        expect(document.data).toContainEqual({
          id: slug,
          type: "optionLabels",
          attributes: { slug, label, imageUrl: imageUrl ?? null, altValue: null }
        });
      }
    });
  });
});
