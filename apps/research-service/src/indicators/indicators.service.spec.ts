import { Test, TestingModule } from "@nestjs/testing";
import { IndicatorsService } from "./indicators.service";
import { DataApiService } from "@terramatch-microservices/data-api";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { Polygon } from "geojson";

describe("IndicatorsService", () => {
  let service: IndicatorsService;

  const mockDataApiService = {
    getIndicatorsDataset: jest.fn().mockResolvedValue([])
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndicatorsService,
        {
          provide: DataApiService,
          useValue: mockDataApiService
        }
      ]
    }).compile();

    service = module.get<IndicatorsService>(IndicatorsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should throw an error if the indicator slug is invalid", async () => {
    await expect(service.process("invalid" as IndicatorSlug, ["polygon-1", "polygon-2"])).rejects.toThrow(
      BadRequestException
    );
    expect(mockDataApiService.getIndicatorsDataset).not.toHaveBeenCalled();
  });

  it("should throw an error if the polygon is not found", async () => {
    jest.spyOn(PolygonGeometry, "getGeoJSONParsed").mockResolvedValue(undefined);
    await expect(service.process("treeCoverLoss", ["polygon-1", "polygon-2"])).rejects.toThrow(NotFoundException);
    expect(mockDataApiService.getIndicatorsDataset).not.toHaveBeenCalled();
  });

  it("should process the indicators", async () => {
    jest.spyOn(SitePolygon, "findOne").mockResolvedValue({
      id: 1,
      calcArea: 100
    } as unknown as SitePolygon);
    jest.spyOn(PolygonGeometry, "getGeoJSONParsed").mockResolvedValue({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0]
        ]
      ]
    } as unknown as Polygon);
    const result = await service.process("treeCoverLoss", ["polygon-1", "polygon-2"]);
    expect(result).not.toBeNull();
  });
});
