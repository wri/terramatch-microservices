import { Test } from "@nestjs/testing";
import { LinkedFieldsController } from "./linked-fields.controller";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { uniq } from "lodash";
import { FORM_MODEL_TYPES } from "@terramatch-microservices/database/constants/entities";

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

    it("includes established tree species fields for sites and site reports", async () => {
      const document = serialize(await controller.linkedFieldsIndex({ formModelTypes: ["sites", "siteReports"] }));
      const fields = document.data as Resource[];
      const siteField = fields.find(({ id }) => id === "site-rel-established-tree-species");
      const reportField = fields.find(({ id }) => id === "site-rep-rel-established-tree-species");

      expect(siteField?.attributes).toMatchObject({
        collection: "established",
        formModelType: "sites",
        inputType: "treeSpecies",
        label: "Established Species",
        name: "Established Species (Site)"
      });
      expect(reportField?.attributes).toMatchObject({
        collection: "established",
        formModelType: "siteReports",
        inputType: "treeSpecies",
        label: "Established Species",
        name: "Established Species (Site Report)"
      });
    });
  });
});
