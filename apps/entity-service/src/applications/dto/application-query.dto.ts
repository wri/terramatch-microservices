import { IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SingleApplicationDto {
  @IsUUID()
  @ApiProperty({ description: "UUID of the application." })
  uuid: string;
}
