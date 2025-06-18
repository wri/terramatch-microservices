import { IndexQueryDto } from "./index-query.dto";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class TaskQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  frameworkKey?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  projectUuid?: string;

  @ApiProperty({
    required: false,
    description:
      "Optional filter to retrieve reports with 'nothing to report' set to true; applied only when this filter is present"
  })
  @IsOptional()
  nothingToReportStatus?: boolean;
}

export class SingleTaskDto {
  @IsUUID()
  @ApiProperty({ description: "Task UUID for task to retrieve" })
  uuid: string;
}
