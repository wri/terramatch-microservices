import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsUUID } from "class-validator";
import { REPORT_COUNT_ENTITIES, ReportCountEntity } from "../tree.service";

export class TreeReportCountsParamsDto {
  @IsIn(REPORT_COUNT_ENTITIES)
  @ApiProperty({
    enum: REPORT_COUNT_ENTITIES,
    description: "Entity type for which to retrieve the associated report count data."
  })
  entity: ReportCountEntity;

  @IsUUID()
  @ApiProperty({ description: "Entity UUID for which to retrieve the associated report count data." })
  uuid: string;
}
