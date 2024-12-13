import { TreesController } from "./trees.controller";
import { TreeService } from "./tree.service";
import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException } from "@nestjs/common";
import { Resource } from "@terramatch-microservices/common/util";

describe("TreesController", () => {
  let controller: TreesController;
  let treeService: DeepMocked<TreeService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TreesController],
      providers: [{ provide: TreeService, useValue: (treeService = createMock<TreeService>()) }]
    }).compile();

    controller = module.get(TreesController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it("should return establishment data", async () => {
    treeService.getEstablishmentTrees.mockResolvedValue(["Coffee", "Banana"]);
    treeService.getPreviousPlanting.mockResolvedValue({ Coffee: 123, Banana: 75 });
    const result = await controller.getEstablishmentData({ entity: "site-reports", uuid: "fakeuuid" });
    expect(treeService.getEstablishmentTrees).toHaveBeenCalledWith("site-reports", "fakeuuid");
    expect(treeService.getPreviousPlanting).toHaveBeenCalledWith("site-reports", "fakeuuid");
    const resource = result.data as Resource;
    expect(resource.id).toBe("site-reports|fakeuuid");
    expect(resource.attributes.establishmentTrees).toMatchObject(["Coffee", "Banana"]);
    expect(resource.attributes.previousPlantingCounts).toMatchObject({ Coffee: 123, Banana: 75 });
  });
});
