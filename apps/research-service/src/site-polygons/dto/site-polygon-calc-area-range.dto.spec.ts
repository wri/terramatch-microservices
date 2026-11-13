import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SitePolygonCalcAreaRangeDto } from "./site-polygon-calc-area-range.dto";
import { SitePolygonMapIndexQueryDto } from "./site-polygon-map-index-query.dto";
import { SitePolygonQueryDto } from "./site-polygon-query.dto";

const errorsFor = async (query: Record<string, string>, cls = SitePolygonCalcAreaRangeDto) =>
  (await validate(plainToInstance(cls, query, { enableImplicitConversion: true }))).map(({ property }) => property);

describe("SitePolygonCalcAreaRangeDto", () => {
  it("converts query strings to numbers", async () => {
    const dto = plainToInstance(
      SitePolygonCalcAreaRangeDto,
      { calcAreaMin: "5", calcAreaMax: "20.5" },
      { enableImplicitConversion: true }
    );
    expect(dto).toMatchObject({ calcAreaMin: 5, calcAreaMax: 20.5 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("accepts a single bound and an equal range", async () => {
    expect(await errorsFor({ calcAreaMin: "5" })).toEqual([]);
    expect(await errorsFor({ calcAreaMax: "5" })).toEqual([]);
    expect(await errorsFor({ calcAreaMin: "5", calcAreaMax: "5" })).toEqual([]);
  });

  it("rejects an inverted range", async () => {
    expect(await errorsFor({ calcAreaMin: "20", calcAreaMax: "5" })).toEqual(["calcAreaMax"]);
  });

  it("rejects non-numeric and negative values", async () => {
    expect(await errorsFor({ calcAreaMax: "abc" })).toEqual(["calcAreaMax"]);
    expect(await errorsFor({ calcAreaMin: "-1" })).toEqual(["calcAreaMin"]);
  });

  it("is inherited by the polygon index and map index query DTOs", async () => {
    expect(await errorsFor({ calcAreaMin: "20", calcAreaMax: "5" }, SitePolygonQueryDto)).toEqual(["calcAreaMax"]);
    expect(await errorsFor({ calcAreaMin: "20", calcAreaMax: "5" }, SitePolygonMapIndexQueryDto)).toEqual([
      "calcAreaMax"
    ]);
  });
});
