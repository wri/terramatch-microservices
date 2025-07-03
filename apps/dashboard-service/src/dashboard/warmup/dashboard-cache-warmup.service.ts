import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CacheService } from "../dto/cache.service";
import { TotalSectionHeaderService } from "../dto/total-section-header.service";
import { TreeRestorationGoalService } from "../dto/tree-restoration-goal.service";
import { DashboardQueryDto } from "../dto/dashboard-query.dto";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

@Injectable()
export class DashboardCacheWarmupService {
  private readonly logger = new TMLogger(DashboardCacheWarmupService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly totalSectionHeaderService: TotalSectionHeaderService,
    private readonly treeRestorationGoalService: TreeRestorationGoalService,
    @InjectRedis() private readonly redis: Redis
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async warmup() {
    this.logger.log("Starting dashboard cache warmup...");

    try {
      this.logger.log("Cleaning up dashboard keys...");
      await this.cleanupDashboardKeys();
      this.logger.log("Dashboard keys cleaned");

      const landscapesList = ["gcb", "grv", "ikr"] as const;
      const organisationTypesList = ["non-profit-organization", "for-profit-organization"] as const;
      const cohortsList = ["terrafund", "terrafund-landscapes"] as const;

      const generateCombinations = <T>(items: readonly T[]): T[][] => {
        const combos: T[][] = [];
        const count = items.length;
        combos.push([]);
        for (let i = 1; i < 1 << count; i++) {
          const combo: T[] = [];
          for (let j = 0; j < count; j++) {
            if ((i & (1 << j)) !== 0) combo.push(items[j]);
          }
          combos.push(combo);
        }
        return combos;
      };

      const landscapeCombos = generateCombinations(landscapesList);
      const orgCombos = generateCombinations(organisationTypesList);
      const cohortCombos = generateCombinations(cohortsList);

      let processed = 0;
      const totalCombos = landscapeCombos.length * orgCombos.length * cohortCombos.length;

      for (const landscapes of landscapeCombos) {
        for (const organisationType of orgCombos) {
          for (const cohort of cohortCombos) {
            const query: DashboardQueryDto = {
              landscapes: landscapes.length > 0 ? [...landscapes] : undefined,
              organisationType: organisationType.length > 0 ? [...organisationType] : undefined,
              cohort: cohort.length > 0 ? [...cohort] : undefined
            };

            const cacheParameter = this.cacheService.getCacheKeyFromQuery(query);

            // Total Section Header
            const totalHeaderKey = `dashboard:total-section-header|${cacheParameter}`;
            const totalHeaderResult = await this.totalSectionHeaderService.getTotalSectionHeader(query);
            await this.cacheService.set(totalHeaderKey, JSON.stringify(totalHeaderResult));

            // Tree Restoration Goal
            const trgKey = `dashboard:tree-restoration-goal|${cacheParameter}`;
            const trgTimestampKey = `${trgKey}:timestamp`;
            const trgResult = await this.treeRestorationGoalService.getTreeRestorationGoal(query);
            await this.cacheService.set(trgKey, JSON.stringify(trgResult));
            await this.cacheService.set(trgTimestampKey, new Date().toISOString());

            processed++;
            if (processed % 10 === 0 || processed === totalCombos) {
              this.logger.log(`Processed ${processed}/${totalCombos} combinations`);
            }
          }
        }
      }

      this.logger.log(`Finished warming up ${totalCombos} combinations`);
    } catch (error) {
      this.logger.error(`Error during cache warmup: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async cleanupDashboardKeys() {
    const stream = this.redis.scanStream({ match: "dashboard:*", count: 100 });
    for await (const keys of stream) {
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}
