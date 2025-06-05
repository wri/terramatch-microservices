import { Test } from "@nestjs/testing";
import { Demographic } from "@terramatch-microservices/database/entities";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { DemographicService } from "./demographic.service";
import { DemographicQueryDto } from "./dto/demographic-query.dto";

function getDefaultPagination() {
  const params = new DemographicQueryDto();
  params.page = new NumberPage();
  params.page.number = 1;
  params.page.size = 10;
  return params;
}

describe("DemographicService", () => {
  let service: DemographicService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DemographicService]
    }).compile();

    service = module.get(DemographicService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Get Demographics", () => {
    it("returns paginated demographics", async () => {
      const demographics = [
        new Demographic({ uuid: "uuid y", type: "type 1" } as Demographic),
        new Demographic({ uuid: "uuid x", type: "type 2" } as Demographic)
      ];
      jest.spyOn(Demographic, "findAll").mockImplementation(() => Promise.resolve(demographics));

      const params = getDefaultPagination();

      const result = await service.getDemographics(params);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].uuid).toBe("uuid y");
      expect(result.data[1].uuid).toBe("uuid x");
      expect(result.pageNumber).toBe(1);
    });

    it("deny unexpected filter", async () => {
      const demographics = [new Demographic({ uuid: "uuid10", type: "Filtered" } as Demographic)];
      jest.spyOn(Demographic, "findAll").mockImplementation(() => Promise.resolve(demographics));

      const params = getDefaultPagination();
      params["unexpectedFilter"] = ["value1", "value2"];

      await expect(service.getDemographics(params)).rejects.toThrow("Invalid filter key: unexpectedFilter");
    });

    it("applies projectUuid filter", async () => {
      const demographics = [new Demographic({ uuid: "uuid10", type: "Filtered" } as Demographic)];
      jest.spyOn(Demographic, "findAll").mockImplementation(() => Promise.resolve(demographics));

      const params = getDefaultPagination();
      params.projectReportUuid = ["uuid10", "uid20"];

      const result = await service.getDemographics(params);
      expect(result.data).toHaveLength(1);
    });

    it("applies projectReportUuid filter", async () => {
      const demographics = [new Demographic({ uuid: "uuid1", type: "Filtered" } as Demographic)];
      jest.spyOn(Demographic, "findAll").mockImplementation(() => Promise.resolve(demographics));

      const params = getDefaultPagination();
      params.projectReportUuid = ["uuid1", "uid2"];

      const result = await service.getDemographics(params);
      expect(result.data).toHaveLength(1);
    });

    it("applies siteReportUuid filter", async () => {
      const demographics = [new Demographic({ uuid: "uuid44", type: "Filtered" } as Demographic)];
      jest.spyOn(Demographic, "findAll").mockImplementation(() => Promise.resolve(demographics));

      const params = getDefaultPagination();
      params.projectReportUuid = ["uuid44", "uid45"];

      const result = await service.getDemographics(params);
      expect(result.data).toHaveLength(1);
    });

    it("deny orders fields", async () => {
      const demographics = [new Demographic({ uuid: "uuid1", type: "Filtered" } as Demographic)];
      jest.spyOn(Demographic, "findAll").mockImplementation(() => Promise.resolve(demographics));

      const params = getDefaultPagination();
      params.sort = { field: "no_exist_column", direction: "ASC" };

      await expect(service.getDemographics(params)).rejects.toThrow("Invalid sort field: no_exist_column");
    });

    it("applies order correctly", async () => {
      const demographics = [new Demographic({ uuid: "uuid1", type: "Filtered" } as Demographic)];
      jest.spyOn(Demographic, "findAll").mockImplementation(() => Promise.resolve(demographics));

      const params = getDefaultPagination();
      params.sort = { field: "type", direction: "ASC" };

      const result = await service.getDemographics(params);
      expect(result.data).toHaveLength(1);
    });
  });
});
