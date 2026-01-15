import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

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
}
