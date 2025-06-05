import { ApiProperty } from "@nestjs/swagger";

export class ImpactStoryParamDto {
  @ApiProperty({ description: "Entity UUID for association" })
  uuid: string;
}
