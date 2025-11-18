import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import Redis from "ioredis";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { ConfigService } from "@nestjs/config";

const KEY_NAMESPACE = "data-api:";

const DATA_API_DATASET = "https://data-api.globalforestwatch.org/dataset";
const GADM_QUERY = "/gadm_administrative_boundaries/v4.1.85/query";
const GADM_CACHE_DURATION = 60 * 60 * 3; // keep GADM definitions in redis for 3 hours.

const gadmLevel0 = () => `
  SELECT country AS name, gid_0 AS iso
  FROM gadm_administrative_boundaries
  WHERE adm_level = '0'
    AND gid_0 NOT IN ('Z01', 'Z02', 'Z03', 'Z04', 'Z05', 'Z06', 'Z07', 'Z08', 'Z09', 'TWN', 'XCA', 'ESH', 'XSP')
`;

const gadmLevel1 = (level0: string) => `
  SELECT name_1 AS name, gid_1 AS id
  FROM gadm_administrative_boundaries
  WHERE adm_level='1'
    AND gid_0 = '${level0}'
`;

// Exported for testing only
export const gadmLevel2 = (level1: string) => `
  SELECT gid_2 as id, name_2 as name
  FROM gadm_administrative_boundaries
  WHERE gid_1 = '${level1}'
    AND adm_level='2'
    AND type_2 NOT IN ('Waterbody', 'Water body', 'Water Body')
`;

export const gadmCountryEnvelope = (country: string) => `
  SELECT ST_AsGeoJSON(ST_Envelope(geom)) as envelope
  FROM gadm_administrative_boundaries
  WHERE adm_level='0' AND gid_0='${country}'
`;

type GadmCountry = {
  name: string;
  iso: string;
};

type GadmLevelCode = {
  name: string;
  id: string;
};

/**
 * A service for accessing, and in some cases caching, data from the Data API. It's not super
 * clear how this service will expand in the future, so for now it's not trying to be too
 * clever about how it presents the APIs that it supports.
 */
@Injectable()
export class DataApiService {
  private readonly logger = new TMLogger(DataApiService.name);

  constructor(@InjectRedis() private readonly redis: Redis, private readonly configService: ConfigService) {}

  async gadmLevel0(): Promise<GadmCountry[]> {
    return await this.getDataset("gadm-level-0", GADM_QUERY, gadmLevel0(), GADM_CACHE_DURATION);
  }

  async gadmLevel1(level0: string): Promise<GadmLevelCode[]> {
    return await this.getDataset(`gadm-level-1:${level0}`, GADM_QUERY, gadmLevel1(level0), GADM_CACHE_DURATION);
  }

  async gadmLevel2(level1: string): Promise<GadmLevelCode[]> {
    return await this.getDataset(`gadm-level-2:${level1}`, GADM_QUERY, gadmLevel2(level1), GADM_CACHE_DURATION);
  }

  async getCountryEnvelope(country: string): Promise<{ envelope: string }[]> {
    return await this.getDataset(
      `country-envelope:${country}`,
      GADM_QUERY,
      gadmCountryEnvelope(country),
      GADM_CACHE_DURATION
    );
  }

  async getIndicatorsDataset(indicatorDataset: any, sql: any, geometry: any) {
    const url = `${DATA_API_DATASET}/${indicatorDataset}/latest/query`;

    const appFrontend = this.configService.get("APP_FRONT_END");
    const dataApiKey = this.configService.get("DATA_API_KEY");
    if (appFrontend == null || dataApiKey == null) {
      throw new InternalServerErrorException("APP_FRONT_END and DATA_API_KEY are required");
    }

    this.logger.debug(`body: ${JSON.stringify({ sql, geometry })}`);
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ sql, geometry }),
      headers: {
        Origin: new URL(appFrontend).hostname,
        "Content-Type": "application/json",
        "x-api-key": dataApiKey
      }
    });

    this.logger.debug(`Response: ${JSON.stringify(response)}`);
    if (response.status !== 200) {
      throw new InternalServerErrorException(response.statusText);
    }

    const json = (await response.json()) as { data: never };

    return json.data;
  }

  private async getDataset(key: string, queryPath: string, query: string, cacheDuration: number) {
    const current = await this.redis.get(`${KEY_NAMESPACE}${key}`);
    if (current != null) return JSON.parse(current);

    const appFrontend = this.configService.get("APP_FRONT_END");
    const dataApiKey = this.configService.get("DATA_API_KEY");
    if (appFrontend == null || dataApiKey == null) {
      throw new InternalServerErrorException("APP_FRONT_END and DATA_API_KEY are required");
    }

    this.logger.log(`Cache miss, running query for ${key}`);
    const params = new URLSearchParams();
    params.append("sql", query);
    const response = await fetch(`${DATA_API_DATASET}${queryPath}?${params}`, {
      headers: {
        Origin: new URL(appFrontend).hostname,
        "x-api-key": dataApiKey
      }
    });

    if (response.status !== 200) {
      throw new InternalServerErrorException(response.statusText);
    }

    const json = (await response.json()) as { data: never };
    await this.redis.set(`${KEY_NAMESPACE}${key}`, JSON.stringify(json.data), "EX", cacheDuration);

    return json.data;
  }
}
