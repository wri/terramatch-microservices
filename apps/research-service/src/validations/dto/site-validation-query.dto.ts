import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, ValidateNested } from "class-validator";
import { CursorPage, NumberPage, Page } from "@terramatch-microservices/common/dto/page.dto";
import { Type, TypeHelpOptions } from "class-transformer";

export class SiteValidationQueryDto {
  @ValidateNested()
  @Type(({ object } = {} as TypeHelpOptions) => {
    const keys = Object.keys(object.page ?? {});
    if (keys.includes("after")) return CursorPage;
    if (keys.includes("number")) return NumberPage;
    return Page;
  })
  @IsOptional()
  @ApiProperty({ type: NumberPage })
  page?: CursorPage | NumberPage;
}
