import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsUUID } from "class-validator";

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
}

export class CursorPage extends Page {
  @ApiProperty({
    name: "page[after]",
    required: false,
    description:
      "The last record before the page being requested. The value is a UUID. " +
      "If page[after] is not provided, the first page is returned."
  })
  @IsOptional()
  @IsUUID()
  after?: string;
}

export class NumberPage extends Page {
  @ApiProperty({
    name: "page[number]",
    required: false,
    description: "The page number to return. If page[number] is not provided, the first page is returned."
  })
  @IsOptional()
  @IsInt()
  number?: number;
}

export const isCursorPage = (page?: CursorPage | NumberPage): page is CursorPage =>
  page != null && (page as CursorPage).after != null;
export const isNumberPage = (page?: CursorPage | NumberPage): page is NumberPage =>
  page != null && (page as NumberPage).number != null;
