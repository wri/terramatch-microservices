import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SingleResourceDto {
  @IsUUID()
  @ApiProperty({ description: "UUID of the resource." })
  uuid: string;
}
