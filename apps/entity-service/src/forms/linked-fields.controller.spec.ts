import { Test } from "@nestjs/testing";
import { LinkedFieldsController } from "./linked-fields.controller";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { FORM_MODEL_TYPES } from "@terramatch-microservices/common/linkedFields";
import { Resource } from "@terramatch-microservices/common/util";
import { uniq } from "lodash";

describe("LinkedFieldsController", () => {
  let controller: LinkedFieldsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [LinkedFieldsController]
    }).compile();

    controller = module.get(LinkedFieldsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("linkedFieldsIndex", () => {
    it("should return only the types requested", async () => {
      const document = serialize(await controller.linkedFieldsIndex({ formModelTypes: ["projects", "sites"] }));
      const resultTypes = uniq((document.data as Resource[]).map(({ attributes }) => attributes.formModelType));
      expect(resultTypes).toEqual(["projects", "sites"]);
    });

    it("should return all types if no types are requested", async () => {
      const document = serialize(await controller.linkedFieldsIndex({}));
      const resultTypes = uniq((document.data as Resource[]).map(({ attributes }) => attributes.formModelType)).sort();
      expect(resultTypes).toEqual((FORM_MODEL_TYPES as unknown as string[]).sort());
    });
  });
});
