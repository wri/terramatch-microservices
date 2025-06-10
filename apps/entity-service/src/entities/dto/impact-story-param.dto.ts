import { ApiProperty } from "@nestjs/swagger";

export class ImpactStoryParamDto {
  @ApiProperty({ description: "Impact Story UUID" })
  uuid: string;
}
