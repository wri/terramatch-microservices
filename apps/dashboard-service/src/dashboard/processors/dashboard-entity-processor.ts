import { Type } from "@nestjs/common";
import { DashboardQueryDto } from "../dto/dashboard-query.dto";
import { CacheService } from "../dto/cache.service";
import { PolicyService } from "@terramatch-microservices/common";

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

  async findManyWithPagination(
    query: DashboardQueryDto
  ): Promise<{ data: ModelType[]; paginationTotal: number; pageNumber: number }> {
    const data = await this.findMany(query);
    return {
      data,
      paginationTotal: data.length,
      pageNumber: query.number ?? 1
    };
  }

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
