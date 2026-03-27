import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { FORM_SUBMISSION_STATUSES, FormSubmissionStatus } from "@terramatch-microservices/database/constants/status";

export class SubmissionExportQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  fundingProgrammeUuid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  organisationUuid?: string;

  @ApiProperty({ required: false, enum: FORM_SUBMISSION_STATUSES })
  @IsOptional()
  @IsIn(FORM_SUBMISSION_STATUSES)
  status?: FormSubmissionStatus;
}
