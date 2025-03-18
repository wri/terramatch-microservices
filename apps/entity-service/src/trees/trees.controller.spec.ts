import { TreesController } from "./trees.controller";
import { TreeService } from "./tree.service";
import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { Resource } from "@terramatch-microservices/common/util";
import { PolicyService } from "@terramatch-microservices/common";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

describe("TreesController", () => {
  let controller: TreesController;
  let treeService: DeepMocked<TreeService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TreesController],
      providers: [
        { provide: TreeService, useValue: (treeService = createMock<TreeService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    })
      .setLogger(new TMLogger())
      .compile();

    controller = module.get(TreesController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("searchScientificName", () => {
    it("should throw if the search param is missing", async () => {
      await expect(controller.searchScientificNames("")).rejects.toThrow(BadRequestException);
      await expect(controller.searchScientificNames(null)).rejects.toThrow(BadRequestException);
    });

    it("should return the tree species from the service in order", async () => {
      treeService.searchScientificNames.mockResolvedValue([
        { taxonId: "wfo-0000002583", scientificName: "Cirsium carolinianum" },
        { taxonId: "wfo-0000003963", scientificName: "Cirsium carniolicum" }
      ]);
      const result = await controller.searchScientificNames("cirs");
      expect(treeService.searchScientificNames).toHaveBeenCalledWith("cirs");
      const data = result.data as Resource[];
      expect(data.length).toBe(2);
      expect(data[0].id).toBe("wfo-0000002583");
      expect(data[0].attributes.scientificName).toBe("Cirsium carolinianum");
      expect(data[1].id).toBe("wfo-0000003963");
      expect(data[1].attributes.scientificName).toBe("Cirsium carniolicum");
    });
  });

  describe("getEstablishmentData", () => {
    it("should throw if the user doesn't have access to the base entity", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.getEstablishmentData({ entity: "siteReports", uuid: "fakeuuid" })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should return establishment data", async () => {
      const stubData = {
        "non-tree": {
          Coffee: { amount: 123 },
          Banana: { amount: 75, taxonId: "wfo-faketaxonid" }
        }
      };
      treeService.getEstablishmentTrees.mockResolvedValue({ "non-tree": ["Coffee", "Banana"] });
      treeService.getPreviousPlanting.mockResolvedValue(stubData);
      const result = await controller.getEstablishmentData({ entity: "siteReports", uuid: "fakeuuid" });
      expect(treeService.getEstablishmentTrees).toHaveBeenCalledWith("siteReports", "fakeuuid");
      expect(treeService.getPreviousPlanting).toHaveBeenCalledWith("siteReports", "fakeuuid");
      const resource = result.data as Resource;
      expect(resource.id).toBe("siteReports|fakeuuid");
      expect(resource.attributes.establishmentTrees).toMatchObject({ "non-tree": ["Coffee", "Banana"] });
      expect(resource.attributes.previousPlantingCounts).toMatchObject(stubData);
    });
  });

  describe("getReportCounts", () => {
    it("should throw if the user doesn't have access to the base entity", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.getReportCounts({ entity: "siteReports", uuid: "fakeuuid" })).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should return associated report data", async () => {
      const stubData = {
        "non-tree": {
          Coffee: { amount: 123 },
          Banana: { amount: 75, taxonId: "wfo-faketaxonid" }
        }
      };
      treeService.getEstablishmentTrees.mockResolvedValue({ "non-tree": ["Coffee", "Banana"] });
      treeService.getAssociatedReportCounts.mockResolvedValue(stubData);
      const result = await controller.getReportCounts({ entity: "sites", uuid: "fakeuuid" });
      expect(treeService.getEstablishmentTrees).toHaveBeenCalledWith("sites", "fakeuuid");
      expect(treeService.getAssociatedReportCounts).toHaveBeenCalledWith("sites", "fakeuuid");
      const resource = result.data as Resource;
      expect(resource.id).toBe("sites|fakeuuid");
      expect(resource.attributes.establishmentTrees).toMatchObject({ "non-tree": ["Coffee", "Banana"] });
      expect(resource.attributes.reportCounts).toMatchObject(stubData);
    });

    it("should skip establishment for a non-establishment type", async () => {
      treeService.getAssociatedReportCounts.mockResolvedValue({ "tree-planted": { Acacia: { amount: 123 } } });
      const result = await controller.getReportCounts({ entity: "projects", uuid: "fakeuuid" });
      expect(treeService.getEstablishmentTrees).not.toHaveBeenCalled();
      expect((result.data as Resource).attributes.establishmentTrees).toBeNull();
    });

    it("should skip report counts for a non-report-counts type", async () => {
      treeService.getEstablishmentTrees.mockResolvedValue({ "tree-planted": ["Acacia"] });
      const result = await controller.getReportCounts({ entity: "siteReports", uuid: "fakeuuid" });
      expect(treeService.getAssociatedReportCounts).not.toHaveBeenCalled();
      expect((result.data as Resource).attributes.reportCounts).toBeNull();
    });
  });
});
