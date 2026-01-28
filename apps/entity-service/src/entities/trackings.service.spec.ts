import { Test } from "@nestjs/testing";
import { Tracking } from "@terramatch-microservices/database/entities";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { TrackingsService } from "./trackings.service";
import { TrackingsQueryDto } from "./dto/trackings-query.dto";
import { TrackingFactory } from "@terramatch-microservices/database/factories";

function getDefaultPagination() {
  const params = new TrackingsQueryDto();
  params.page = new NumberPage();
  params.page.number = 1;
  params.page.size = 10;
  return params;
}

describe("TrackingsService", () => {
  let service: TrackingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TrackingsService]
    }).compile();

    service = module.get(TrackingsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Get Trackings", () => {
    it("returns paginated trackings", async () => {
      const trackings = await TrackingFactory.projectReport().createMany(2);
      jest.spyOn(Tracking, "findAll").mockImplementation(() => Promise.resolve(trackings));

      const params = getDefaultPagination();

      const result = await service.getTrackings(params);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].uuid).toBe(trackings[0].uuid);
      expect(result.data[1].uuid).toBe(trackings[1].uuid);
      expect(result.pageNumber).toBe(1);
    });

    it("deny unexpected filter", async () => {
      const trackings = [await TrackingFactory.projectReport().create()];
      jest.spyOn(Tracking, "findAll").mockImplementation(() => Promise.resolve(trackings));

      const params = getDefaultPagination();
      params["unexpectedFilter"] = ["value1", "value2"];

      await expect(service.getTrackings(params)).rejects.toThrow("Invalid filter key: unexpectedFilter");
    });

    it("applies projectUuid filter", async () => {
      const trackings = [await TrackingFactory.projectReport().create()];
      jest.spyOn(Tracking, "findAll").mockImplementation(() => Promise.resolve(trackings));

      const params = getDefaultPagination();
      params.projectReportUuid = ["uuid10", "uid20"];

      const result = await service.getTrackings(params);
      expect(result.data).toHaveLength(1);
    });

    it("applies projectReportUuid filter", async () => {
      const trackings = [await TrackingFactory.projectReport().create()];
      jest.spyOn(Tracking, "findAll").mockImplementation(() => Promise.resolve(trackings));

      const params = getDefaultPagination();
      params.projectReportUuid = ["uuid1", "uid2"];

      const result = await service.getTrackings(params);
      expect(result.data).toHaveLength(1);
    });

    it("applies siteReportUuid filter", async () => {
      const trackings = [await TrackingFactory.projectReport().create()];
      jest.spyOn(Tracking, "findAll").mockImplementation(() => Promise.resolve(trackings));

      const params = getDefaultPagination();
      params.projectReportUuid = ["uuid44", "uid45"];

      const result = await service.getTrackings(params);
      expect(result.data).toHaveLength(1);
    });

    it("deny orders fields", async () => {
      const trackings = [await TrackingFactory.projectReport().create()];
      jest.spyOn(Tracking, "findAll").mockImplementation(() => Promise.resolve(trackings));

      const params = getDefaultPagination();
      params.sort = { field: "no_exist_column", direction: "ASC" };

      await expect(service.getTrackings(params)).rejects.toThrow("Invalid sort field: no_exist_column");
    });

    it("applies order correctly", async () => {
      const trackings = [await TrackingFactory.projectReport().create()];
      jest.spyOn(Tracking, "findAll").mockImplementation(() => Promise.resolve(trackings));

      const params = getDefaultPagination();
      params.sort = { field: "type", direction: "ASC" };

      const result = await service.getTrackings(params);
      expect(result.data).toHaveLength(1);
    });
  });
});
