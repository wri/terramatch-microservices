import { ApiProperty } from "@nestjs/swagger";

export class ProjectPitchParamDto {
  @ApiProperty({ description: "Entity UUID for association" })
  uuid: string;
}
