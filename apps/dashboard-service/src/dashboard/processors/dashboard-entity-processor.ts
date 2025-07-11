import { Type } from "@nestjs/common";
import { DashboardQueryDto } from "../dto/dashboard-query.dto";
import { CacheService } from "../dto/cache.service";

export type DtoResult<DtoType> = {
  id: string;
  dto: DtoType;
};

export abstract class DashboardEntityProcessor<ModelType, LightDto, FullDto> {
  abstract readonly LIGHT_DTO: Type<LightDto>;
  abstract readonly FULL_DTO: Type<FullDto>;

  constructor(protected readonly cacheService: CacheService) {}

  /**
   * Used for GET /dashboard/v3/{entity}/{uuid} endpoints
   */
  abstract findOne(uuid: string): Promise<ModelType | null>;

  /**
   * Used for GET /dashboard/v3/{entity} endpoints
   */
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

  protected getCacheService(): CacheService {
    return this.cacheService;
  }
}
