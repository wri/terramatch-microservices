import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { DashboardQueryDto } from "./dashboard-query.dto";

import Redis from "ioredis";
import Cache from "ioredis-cache";
import { InjectRedis } from "@nestjs-modules/ioredis";

@Injectable()
export class CacheService {
  private cache: Cache;

  constructor(
    @InjectQueue("dashboard") private readonly dashboardQueue: Queue,
    @InjectRedis() private readonly redis: Redis
  ) {
    this.cache = new Cache(this.redis);
  }

  async getTimestampForTotalSectionHeader(cacheParameter: string) {
    const timestampKey = `dashboard:total-section-header|${cacheParameter}:timestamp`;
    return this.redis.get(timestampKey);
  }

  async getTotalSectionHeader(cacheKey: string, query: DashboardQueryDto, delayedJobId: number) {
    return await this.dashboardQueue.add("totalSectionHeader", { ...query, cacheKey, delayedJobId });
  }

  async set(key: string, value: string | number | Buffer<ArrayBufferLike>) {
    return this.cache.redis.set(key, value);
  }

  async get(key: string) {
    return this.cache.redis.get(key);
  }

  async del(key: string) {
    return this.cache.redis.del(key);
  }

  getCacheKeyFromQuery(query: DashboardQueryDto) {
    const frameworkValue = this.getCacheParameterForProgrammes(query.programmes ?? []);
    const landscapeValue = this.getCacheParameterForLandscapes(query.landscapes ?? []);
    const countryValue = this.getCacheParameterForCountry(query.country ?? "");
    const organisationValue = this.getCacheParameterForOrganisationType(query.organisationType ?? []);
    const cohortValue = this.getCacheParameterForCohort(query.cohort ?? "");
    const projectUuidValue = this.getCacheParameterForProjectUudid(query.projectUuid ?? "");

    return `${frameworkValue}|${landscapeValue}|${countryValue}|${organisationValue}|${cohortValue}|${projectUuidValue}`;
  }

  getCacheParameterForProgrammes(programmes: string[]) {
    if (programmes == null || programmes.length === 0) {
      return "";
    }
    const sortedProgrammes = programmes.sort();
    return sortedProgrammes.join(",");
  }

  getCacheParameterForLandscapes(landscapes: string[]) {
    if (landscapes && typeof landscapes === "object" && !Array.isArray(landscapes)) {
      landscapes = Object.values(landscapes);
    }

    if (typeof landscapes === "string") {
      landscapes = [landscapes];
    }

    if (landscapes == null || landscapes.length === 0) {
      return "";
    }
    const sortedLandscapes = landscapes.sort();
    return sortedLandscapes.join(",");
  }

  getCacheParameterForCountry(country: string) {
    return country ?? "";
  }

  getCacheParameterForOrganisationType(organisationType: string[]) {
    if (organisationType && typeof organisationType === "object" && !Array.isArray(organisationType)) {
      organisationType = Object.values(organisationType);
    }

    if (typeof organisationType === "string") {
      organisationType = [organisationType];
    }

    if (organisationType == null || organisationType.length === 0) {
      return "all-orgs";
    }
    const sortedOrganisations = organisationType.sort();
    const callOrgTypes = ["for-profit-organization", "non-profit-organization"];
    if (sortedOrganisations.join(",") === callOrgTypes.join(",")) {
      return "all-orgs";
    }
    return sortedOrganisations.join(",");
  }

  getCacheParameterForCohort(cohort: string) {
    return cohort ?? "";
  }

  getCacheParameterForProjectUudid(projectUuid: string) {
    return projectUuid ?? "";
  }
}
