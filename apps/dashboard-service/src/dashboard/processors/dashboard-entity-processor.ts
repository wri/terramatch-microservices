import { Type } from "@nestjs/common";
import { DashboardQueryDto, SideloadType } from "../dto/dashboard-query.dto";
import { CacheService } from "../dto/cache.service";
import { PolicyService } from "@terramatch-microservices/common";
import { DocumentBuilder } from "@terramatch-microservices/common/util/json-api-builder";

export type DtoResult<DtoType> = {
  id: string;
  dto: DtoType;
};

export abstract class DashboardEntityProcessor<ModelType, LightDto, FullDto> {
  abstract readonly LIGHT_DTO: Type<LightDto>;
  abstract readonly FULL_DTO: Type<FullDto>;

  constructor(protected readonly cacheService: CacheService, protected readonly policyService: PolicyService) {}

  abstract findOne(uuid: string): Promise<ModelType | null>;

  abstract findMany(query: DashboardQueryDto): Promise<ModelType[]>;

  abstract getLightDto(model: ModelType): Promise<DtoResult<LightDto>>;

  abstract getFullDto(model: ModelType): Promise<DtoResult<FullDto>>;

  async getLightDtos(models: ModelType[]): Promise<DtoResult<LightDto>[]> {
    const results: DtoResult<LightDto>[] = [];
    for (const model of models) {
      results.push(await this.getLightDto(model));
    }
    return results;
  }

  async getFullDtos(models: ModelType[]): Promise<DtoResult<FullDto>[]> {
    const results: DtoResult<FullDto>[] = [];
    for (const model of models) {
      results.push(await this.getFullDto(model));
    }
    return results;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async processSideload(
    document: DocumentBuilder,
    model: ModelType,
    entity: SideloadType,
    pageSize: number
  ): Promise<void> {
    throw new Error("This entity does not support sideloading");
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  protected getCacheService(): CacheService {
    return this.cacheService;
  }
}
