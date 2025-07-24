import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardEntityProcessor } from "./dashboard-entity-processor";
import { CacheService } from "../dto/cache.service";
import { PolicyService } from "@terramatch-microservices/common";

interface TestModel {
  uuid: string;
}

class MockLightDto {}
class MockFullDto {}

class TestProcessor extends DashboardEntityProcessor<TestModel, MockLightDto, MockFullDto> {
  readonly LIGHT_DTO = MockLightDto;
  readonly FULL_DTO = MockFullDto;

  async findOne(uuid: string): Promise<TestModel | null> {
    return { uuid };
  }

  async findMany(): Promise<TestModel[]> {
    return [];
  }

  async getLightDto(model: TestModel): Promise<{ id: string; dto: MockLightDto }> {
    return { id: model.uuid, dto: new this.LIGHT_DTO() };
  }

  async getFullDto(model: TestModel): Promise<{ id: string; dto: MockFullDto }> {
    return { id: model.uuid, dto: new this.FULL_DTO() };
  }
}

describe("DashboardEntityProcessor", () => {
  let processor: TestProcessor;
  let cacheService: DeepMocked<CacheService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    cacheService = createMock<CacheService>();
    policyService = createMock<PolicyService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TestProcessor,
          useFactory: () => new TestProcessor(cacheService, policyService)
        }
      ]
    }).compile();

    processor = module.get<TestProcessor>(TestProcessor);
  });

  it("should return cache service", () => {
    const result = processor["getCacheService"]();
    expect(result).toBe(cacheService);
  });

  it("should process multiple models into light DTOs", async () => {
    const models: TestModel[] = [{ uuid: "uuid-1" }, { uuid: "uuid-2" }];

    const result = await processor.getLightDtos(models);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("uuid-1");
    expect(result[0].dto).toBeInstanceOf(MockLightDto);
    expect(result[1].id).toBe("uuid-2");
    expect(result[1].dto).toBeInstanceOf(MockLightDto);
  });

  it("should process multiple models into full DTOs", async () => {
    const models: TestModel[] = [{ uuid: "uuid-1" }, { uuid: "uuid-2" }];

    const result = await processor.getFullDtos(models);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("uuid-1");
    expect(result[0].dto).toBeInstanceOf(MockFullDto);
    expect(result[1].id).toBe("uuid-2");
    expect(result[1].dto).toBeInstanceOf(MockFullDto);
  });
});
