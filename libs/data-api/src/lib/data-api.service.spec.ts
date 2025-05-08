import { Test } from "@nestjs/testing";
import { createMock, DeepMocked, PartialFuncReturn } from "@golevelup/ts-jest";
import { DataApiService, gadmLevel2 } from "./data-api.service";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import fetchMock from "jest-fetch-mock";
import { InternalServerErrorException } from "@nestjs/common";

describe("DataApiService", () => {
  let service: DataApiService;
  let redis: DeepMocked<Redis>;
  let config: DeepMocked<ConfigService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DataApiService,
        {
          provide: ConfigService,
          useValue: (config = createMock<ConfigService>({
            get: (key: string): PartialFuncReturn<unknown> => {
              if (key === "APP_FRONT_END") return "https://unittests.terramatch.org";
              if (key === "DATA_API_KEY") return "test-api-key";
              return "";
            }
          }))
        },
        {
          provide: getRedisConnectionToken("default"),
          useValue: (redis = createMock<Redis>({ get: () => Promise.resolve(null) }))
        }
      ]
    }).compile();

    service = module.get(DataApiService);
    fetchMock.enableMocks();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    fetchMock.resetMocks();
  });

  it("should check the redis cache first", async () => {
    redis.get.mockResolvedValue(JSON.stringify({ cached: "foo" }));
    const result = await service.gadmLevel0();
    expect(result).toEqual({ cached: "foo" });
    expect(redis.get).toHaveBeenCalledWith("data-api:gadm-level-0");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should throw if the environment is not configured correctly", async () => {
    config.get.mockReturnValue(null);
    await expect(service.gadmLevel0()).rejects.toThrow(InternalServerErrorException);
  });

  it("should throw an error if an error is returned from the data api", async () => {
    fetchMock.mockResolvedValue({ status: 404 } as Response);
    await expect(service.gadmLevel1("ESP")).rejects.toThrow(InternalServerErrorException);
  });

  it("should return and cache the dataset", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ data: { foo: "mocked data" } })
    } as Response);
    const result = await service.gadmLevel2("USA.CA");
    expect(result).toEqual({ foo: "mocked data" });

    const params = new URLSearchParams();
    params.append("sql", gadmLevel2("USA.CA"));
    expect(fetch).toHaveBeenCalledWith(
      `https://data-api.globalforestwatch.org/dataset/gadm_administrative_boundaries/v4.1.85/query?${params}`,
      expect.objectContaining({
        headers: {
          Origin: "unittests.terramatch.org",
          "x-api-key": "test-api-key"
        }
      })
    );
    expect(redis.set).toHaveBeenCalledWith(
      "data-api:gadm-level-2:USA.CA",
      JSON.stringify({ foo: "mocked data" }),
      "EX",
      60 * 60 * 3
    );
  });
});
