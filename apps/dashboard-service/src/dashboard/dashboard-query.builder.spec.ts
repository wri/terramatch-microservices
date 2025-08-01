import { Op } from "sequelize";
import { DashboardProjectsQueryBuilder } from "./dashboard-query.builder";
import { Project } from "@terramatch-microservices/database/entities";
import { ModelCtor } from "sequelize-typescript";

type MockSequelize = {
  escape: jest.Mock<string, [string]>;
};

type MockModel = {
  findAll: jest.Mock;
  count: jest.Mock;
  sum: jest.Mock;
  sequelize: MockSequelize | null;
};

describe("DashboardProjectsQueryBuilder", () => {
  let builder: DashboardProjectsQueryBuilder;
  let mockModel: MockModel = {
    findAll: jest.fn(),
    count: jest.fn(),
    sum: jest.fn(),
    sequelize: null
  };

  beforeEach(() => {
    mockModel = {
      findAll: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(42),
      sum: jest.fn().mockResolvedValue(100),
      sequelize: {
        escape: jest.fn((val: string) => `'${val.replace(/'/g, "''")}'`)
      }
    };
    builder = new DashboardProjectsQueryBuilder(mockModel as unknown as ModelCtor<Project>);
  });

  it("should set order in findOptions", () => {
    builder.order(["name", "ASC"]);
    expect(builder["findOptions"].order).toEqual([["name", "ASC"]]);
  });

  it("should call findAll with selected attributes", async () => {
    mockModel.findAll.mockResolvedValueOnce(["result"]);
    const res = await builder.select(["id"]);
    expect(mockModel.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: ["id"]
      })
    );
    expect(res).toEqual(["result"]);
  });

  it("should add where condition correctly", () => {
    builder.where({ status: "approved" });
    expect(builder["findOptions"].where).toEqual({ status: "approved" });
  });

  it("should handle queryFilters with partial filters", () => {
    builder.queryFilters({ country: "MX" });
    const where = builder["findOptions"].where as { [Op.and]?: unknown[] };
    expect(where[Op.and]).toBeDefined();
    expect(where[Op.and]?.[0]).toMatchObject({ country: "MX" });
    expect(builder["findOptions"].include).toBeDefined();
  });

  it("should combine where clauses using Op.and", () => {
    const combined = builder["combineWheresWithAnd"]({ [Op.and]: [{ a: 1 }] }, { [Op.and]: [{ b: 2 }] });
    expect(combined).toEqual({ [Op.and]: [{ a: 1 }, { b: 2 }] });
  });

  it("should apply query filters correctly with valid input", () => {
    builder.queryFilters({
      country: "Kenya",
      programmes: ["terrafund"],
      cohort: ["2023"],
      organisationType: ["non-profit-organization"],
      projectUuid: "uuid1"
    });
    const where = builder["findOptions"].where as { [Op.and]?: unknown[] };
    expect(where[Op.and]).toBeDefined();
    expect(where[Op.and]?.[0]).toMatchObject({ country: "Kenya" });
    expect(where[Op.and]?.[1]).toMatchObject({ val: expect.stringContaining("JSON_CONTAINS(cohort") });
    expect(builder["findOptions"].include?.[0]).toHaveProperty("association", "organisation");
  });

  it("should execute findAll with current findOptions", async () => {
    await builder.execute();
    expect(mockModel.findAll).toHaveBeenCalledWith(builder["findOptions"]);
  });

  it("should count distinct records", async () => {
    const count = await builder.count();
    expect(count).toBe(42);
    expect(mockModel.count).toHaveBeenCalledWith(expect.objectContaining({ distinct: true }));
  });

  it("should sum a field correctly", async () => {
    const sum = await builder.sum("goalTreesRestoredAnr");
    expect(sum).toBe(100);
  });

  it("should pluck ids correctly from results", async () => {
    mockModel.findAll.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    const ids = await builder.pluckIds();
    expect(ids).toEqual([1, 2]);
  });

  it("should combine two where clauses using Op.and", () => {
    const whereA = { [Op.and]: [{ status: "approved" }] };
    const whereB = { [Op.and]: [{ country: "XX" }] };
    const result = builder["combineWheresWithAnd"](whereA, whereB);
    expect(result).toEqual({ [Op.and]: [{ status: "approved" }, { country: "XX" }] });
  });

  it("should set include options in constructor when provided", () => {
    const includeOptions = [{ association: "organisation", attributes: ["uuid", "name"] }];
    const builderWithInclude = new DashboardProjectsQueryBuilder(
      mockModel as unknown as ModelCtor<Project>,
      includeOptions
    );

    expect(builderWithInclude["findOptions"].include).toEqual(includeOptions);
  });

  it("should handle landscapes filter correctly", () => {
    builder.queryFilters({ landscapes: ["gcb", "grv"] });
    const where = builder["findOptions"].where as { [Op.and]?: unknown[] };

    expect(where[Op.and]).toBeDefined();
    expect(where[Op.and]?.[0]).toHaveProperty("landscape");
  });

  it("should handle project UUID filter as string", () => {
    builder.queryFilters({ projectUuid: "test-uuid-123" });
    const where = builder["findOptions"].where as { [Op.and]?: unknown[] };

    expect(where[Op.and]).toBeDefined();
    expect(where[Op.and]?.[0]).toHaveProperty("uuid", "test-uuid-123");
  });
});
