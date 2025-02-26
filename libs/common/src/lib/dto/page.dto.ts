import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional } from "class-validator";

class Page {
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
}

export class CursorPage extends Page {
  @ApiProperty({
    name: "page[after]",
    required: false,
    description:
      "The last record before the page being requested. The value is a UUID. " +
      "If neither page[after] nor page[number] is provided, the first page is returned."
  })
  @IsOptional()
  after?: string;
}

export class NumberPage extends Page {
  @ApiProperty({
    name: "page[number]",
    required: false,
    description:
      "The page number to return. If neither page[after] nor page[number] is provided, the first " +
      "page is returned. If page[number] is provided, page[size] is required."
  })
  @IsOptional()
  number?: number;
}
