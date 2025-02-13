import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional } from "class-validator";

export class Page {
  @ApiProperty({
    name: "page[size]",
    description: "The size of page being requested",
    minimum: 1,
    maximum: 100,
    default: 100,
    required: false
  })
  @IsOptional()
  @IsInt()
  size?: number;

  @ApiProperty({
    name: "page[after]",
    required: false,
    description:
      "The last record before the page being requested. The value is a polygon UUID. If not provided, the first page is returned."
  })
  @IsOptional()
  after?: string;
}
