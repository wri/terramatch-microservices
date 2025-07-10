import { Test } from "@nestjs/testing";
import { Disturbance, SiteReport } from "@terramatch-microservices/database/entities";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { DisturbanceService } from "./disturbance.service";
import { DisturbanceQueryDto } from "./dto/disturbance-query.dto";

function getDefaultPagination() {
  const params = new DisturbanceQueryDto();
  params.page = new NumberPage();
  params.page.number = 1;
  params.page.size = 10;
  return params;
}

describe("DisturbanceService", () => {
  let service: DisturbanceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DisturbanceService]
    }).compile();

    service = module.get(DisturbanceService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Get Disturbances", () => {
    it("returns paginated disturbances", async () => {
      const disturbances = [
        new Disturbance({ uuid: "uuid y", type: "type 1" } as Disturbance),
        new Disturbance({ uuid: "uuid x", type: "type 2" } as Disturbance)
      ];
      jest.spyOn(Disturbance, "findAll").mockImplementation(() => Promise.resolve(disturbances));

      const params = getDefaultPagination();

      const result = await service.getDisturbances(params);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].uuid).toBe("uuid y");
      expect(result.data[1].uuid).toBe("uuid x");
      expect(result.pageNumber).toBe(1);
    });

    it("deny unexpected filter", async () => {
      const disturbances = [new Disturbance({ uuid: "uuid10", type: "Filtered" } as Disturbance)];
      jest.spyOn(Disturbance, "findAll").mockImplementation(() => Promise.resolve(disturbances));

      const params = getDefaultPagination();
      params["unexpectedFilter"] = ["value1", "value2"];

      await expect(service.getDisturbances(params)).rejects.toThrow("Invalid filter key: unexpectedFilter");
    });

    it("applies siteReportUuid filter with no coincidences", async () => {
      const disturbances = [new Disturbance({ uuid: "uuid44", type: "Filtered" } as Disturbance)];
      jest.spyOn(Disturbance, "findAll").mockImplementation(() => Promise.resolve(disturbances));

      const params = getDefaultPagination();
      params.siteReportUuid = ["uuid44", "uid45"];

      const result = await service.getDisturbances(params);
      expect(result.data).toHaveLength(0);
    });

    it("applies siteReportUuid filter", async () => {
      const disturbances = [new Disturbance({ uuid: "uuid44", type: "Filtered" } as Disturbance)];
      const siteReport = new SiteReport({ uuid: "uuid44" } as SiteReport);
      jest.spyOn(SiteReport, "findAll").mockImplementation(() => Promise.resolve([siteReport]));
      jest.spyOn(Disturbance, "findAll").mockImplementation(() => Promise.resolve(disturbances));

      const params = getDefaultPagination();
      params.siteReportUuid = ["uuid44", "uid45"];

      const result = await service.getDisturbances(params);
      expect(result.data).toHaveLength(1);
    });

    it("deny orders fields", async () => {
      const disturbances = [new Disturbance({ uuid: "uuid1", type: "Filtered" } as Disturbance)];
      jest.spyOn(Disturbance, "findAll").mockImplementation(() => Promise.resolve(disturbances));

      const params = getDefaultPagination();
      params.sort = { field: "no_exist_column", direction: "ASC" };

      await expect(service.getDisturbances(params)).rejects.toThrow("Invalid sort field: no_exist_column");
    });

    it("applies order correctly", async () => {
      const disturbances = [new Disturbance({ uuid: "uuid1", type: "Filtered" } as Disturbance)];
      jest.spyOn(Disturbance, "findAll").mockImplementation(() => Promise.resolve(disturbances));

      const params = getDefaultPagination();
      params.sort = { field: "type", direction: "ASC" };

      const result = await service.getDisturbances(params);
      expect(result.data).toHaveLength(1);
    });
  });
});
