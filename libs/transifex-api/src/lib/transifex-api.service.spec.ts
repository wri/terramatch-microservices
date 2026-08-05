import { Test } from "@nestjs/testing";
import { createMock, DeepMocked, PartialFuncReturn } from "@golevelup/ts-jest";
import { TransifexApiService } from "./transifex-api.service";
import { ConfigService } from "@nestjs/config";
import fetchMock from "jest-fetch-mock";
import { InternalServerErrorException } from "@nestjs/common";

describe("TransifexApiService", () => {
  let service: TransifexApiService;
  let config: DeepMocked<ConfigService>;

  const token = "test-transifex-token";
  const expectedHeaders = {
    Accept: "application/vnd.api+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/vnd.api+json"
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TransifexApiService,
        {
          provide: ConfigService,
          useValue: (config = createMock<ConfigService>({
            get: (key: string): PartialFuncReturn<unknown> => {
              if (key === "TRANSIFEX_API_TOKEN") return token;
              return "";
            }
          }))
        }
      ]
    }).compile();

    service = module.get(TransifexApiService);
    fetchMock.enableMocks();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    fetchMock.resetMocks();
  });

  it("should throw if TRANSIFEX_API_TOKEN is not configured", async () => {
    config.get.mockReturnValue(null);
    await expect(service.getResourceString("abc")).rejects.toThrow(InternalServerErrorException);
  });

  it("should get a resource string by key", async () => {
    const mockData = { data: [{ id: "resource-string-1", attributes: { string_hash: "hash1" } }] };
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(mockData)
    } as Response);

    const result = await service.getResourceString("some-key");
    expect(result).toEqual(mockData);

    const params = new URLSearchParams({
      "filter[resource]": "o:WRI:p:terramatch-version-2:r:terramatch-version-2",
      "filter[key]": "some-key"
    });
    expect(fetch).toHaveBeenCalledWith(`https://rest.api.transifex.com/resource_strings?${params.toString()}`, {
      headers: expectedHeaders,
      method: "GET"
    });
  });

  it("should update a resource string", async () => {
    const mockData = { data: { id: "updated" } };
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(mockData)
    } as Response);

    const result = await service.updateResourceString("string-hash", "Original text");
    expect(result).toEqual(mockData);

    const resourceStringId = "o:WRI:p:terramatch-version-2:r:terramatch-version-2:s:string-hash";
    expect(fetch).toHaveBeenCalledWith(`https://rest.api.transifex.com/resource_strings/${resourceStringId}`, {
      method: "PATCH",
      headers: expectedHeaders,
      body: JSON.stringify({
        data: {
          id: resourceStringId,
          type: "resource_strings",
          attributes: {
            strings: {
              other: "Original text"
            }
          }
        }
      })
    });
  });

  it("should create a resource string", async () => {
    const mockData = { data: { id: "created", attributes: { string_hash: "hash1" } } };
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(mockData)
    } as Response);

    const result = await service.createResourceString("some-key", "Original text");
    expect(result).toEqual(mockData);

    expect(fetch).toHaveBeenCalledWith("https://rest.api.transifex.com/resource_strings", {
      method: "POST",
      headers: expectedHeaders,
      body: JSON.stringify({
        data: {
          type: "resource_strings",
          attributes: {
            key: "some-key",
            context: "",
            strings: {
              other: "Original text"
            }
          },
          relationships: {
            resource: {
              data: {
                type: "resources",
                id: "o:WRI:p:terramatch-version-2:r:terramatch-version-2"
              }
            }
          }
        }
      })
    });
  });

  it("should get a translation", async () => {
    const mockData = { data: { attributes: { strings: { other: "Hola" } } } };
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(mockData)
    } as Response);

    const result = await service.getTranslation("string-hash", "es_MX");
    expect(result).toEqual(mockData);

    const translationId = "o:WRI:p:terramatch-version-2:r:terramatch-version-2:s:string-hash:l:es_MX";
    expect(fetch).toHaveBeenCalledWith(
      `https://rest.api.transifex.com/resource_translations/${encodeURIComponent(translationId)}`,
      {
        headers: expectedHeaders,
        method: "GET"
      }
    );
  });

  it("should update a translation", async () => {
    const mockData = { data: { id: "updated-translation" } };
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve(mockData)
    } as Response);

    const result = await service.updateTranslation("string-hash", "es_MX", "Hola mundo");
    expect(result).toEqual(mockData);

    const translationId = "o:WRI:p:terramatch-version-2:r:terramatch-version-2:s:string-hash:l:es_MX";
    expect(fetch).toHaveBeenCalledWith(
      `https://rest.api.transifex.com/resource_translations/${encodeURIComponent(translationId)}`,
      {
        headers: expectedHeaders,
        method: "PATCH",
        body: JSON.stringify({
          data: {
            id: translationId,
            type: "resource_translations",
            attributes: {
              reviewed: true,
              strings: {
                other: "Hola mundo"
              }
            }
          }
        })
      }
    );
  });

  it("should throw when the Transifex API returns an error", async () => {
    fetchMock.mockResolvedValue({
      status: 404,
      ok: false,
      statusText: "Not Found",
      text: () => Promise.resolve("missing")
    } as Response);

    await expect(service.getTranslation("missing", "es_MX")).rejects.toThrow(InternalServerErrorException);
  });
});
