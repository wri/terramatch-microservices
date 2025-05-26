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
    await this.redis.set(key, value);
  }

  async get(key: string) {
    const data = await this.redis.get(key);
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  }

  async del(key: string) {
    return this.redis.del(key);
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
    if (typeof programmes === "string") {
      return (programmes = [programmes]);
    }

    return programmes.length === 0 ? "" : programmes.sort().join(",");
  }

  getCacheParameterForLandscapes(landscapes: string[]) {
    if (typeof landscapes === "string") {
      return (landscapes = [landscapes]);
    }

    return landscapes.length === 0 ? "" : landscapes.sort().join(",");
  }

  getCacheParameterForCountry(country: string) {
    return country ?? "";
  }

  getCacheParameterForOrganisationType(organisationType: string[]) {
    if (typeof organisationType === "string") {
      return (organisationType = [organisationType]);
    }

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

  getCacheParameterForCohort(cohort: string) {
    return cohort ?? "";
  }

  getCacheParameterForProjectUudid(projectUuid: string) {
    return projectUuid ?? "";
  }
}
