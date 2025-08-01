import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { DashboardQueryDto } from "./dashboard-query.dto";

import Redis from "ioredis";
import { InjectRedis } from "@nestjs-modules/ioredis";

@Injectable()
export class CacheService {
  constructor(
    @InjectQueue("dashboard") private readonly dashboardQueue: Queue,
    @InjectRedis() private readonly redis: Redis
  ) {}

  async getTimestampForTotalSectionHeader(cacheParameter: string) {
    const timestampKey = `dashboard:total-section-header|${cacheParameter}:timestamp`;
    return this.redis.get(timestampKey);
  }

  async getTotalSectionHeader(cacheKey: string, query: DashboardQueryDto, delayedJobId: number) {
    return await this.dashboardQueue.add("totalSectionHeader", { ...query, cacheKey, delayedJobId });
  }

  async set(key: string, value: string) {
    const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;
    await this.redis.set(key, value, "EX", SEVEN_DAYS_IN_SECONDS);
  }

  async get(key: string, factory?: () => Promise<string | object>) {
    const data = await this.redis.get(key);
    if (data !== null) {
      if (typeof data === "string") {
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      }
      return data;
    }

    if (factory != null) {
      const result = await factory();
      const valueToStore = typeof result === "string" ? result : JSON.stringify(result);
      const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;
      await this.redis.set(key, valueToStore, "EX", SEVEN_DAYS_IN_SECONDS);
      return result;
    }

    return null;
  }

  async del(key: string) {
    return this.redis.del(key);
  }

  getCacheKeyFromQuery(query: DashboardQueryDto) {
    const frameworkValue = this.getCacheParameterForProgrammes(query.programmes ?? []);
    const landscapeValue = this.getCacheParameterForLandscapes(query.landscapes ?? []);
    const countryValue = this.getCacheParameterForCountry(query.country ?? "");
    const organisationValue = this.getCacheParameterForOrganisationType(query.organisationType ?? []);
    const cohortValue = this.getCacheParameterForCohort(query.cohort ?? []);
    const projectUuidValue = this.getCacheParameterForProjectUudid(query.projectUuid ?? "");

    return `${frameworkValue}|${landscapeValue}|${countryValue}|${organisationValue}|${cohortValue}|${projectUuidValue}`;
  }

  getCacheParameterForProgrammes(programmes: string[]) {
    return programmes.length === 0 ? "" : programmes.sort().join(",");
  }

  getCacheParameterForLandscapes(landscapes: string[]) {
    return landscapes.length === 0 ? "" : landscapes.sort().join(",");
  }

  getCacheParameterForCountry(country: string) {
    return country ?? "";
  }

  getCacheParameterForOrganisationType(organisationType: string[]) {
    if (organisationType.length === 0) {
      return "all-orgs";
    }

    const sortedOrganisations = organisationType.sort();
    const callOrgTypes = ["for-profit-organization", "non-profit-organization"];

    if (sortedOrganisations.join(",") === callOrgTypes.join(",")) {
      return "all-orgs";
    }

    return sortedOrganisations.join(",");
  }

  getCacheParameterForCohort(cohort: string[]) {
    return cohort.length === 0 ? "" : cohort.sort().join(",");
  }

  getCacheParameterForProjectUudid(projectUuid: string) {
    return projectUuid ?? "";
  }
}
