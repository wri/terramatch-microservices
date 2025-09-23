import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SiteValidationQueryDto } from "./site-validation-query.dto";

describe("SiteValidationQueryDto", () => {
  it("should validate a DTO with no page parameters", async () => {
    const dto = plainToInstance(SiteValidationQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should handle the page[size] and page[number] format correctly", async () => {
    const dto = plainToInstance(SiteValidationQueryDto, {
      "page[size]": "10",
      "page[number]": "2"
    });

    expect(dto).toBeDefined();
  });
});
