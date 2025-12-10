import { ApiProperty } from "@nestjs/swagger";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { IsOptional } from "class-validator";
import { FORM_SUBMISSION_STATUSES, FormSubmissionStatus } from "@terramatch-microservices/database/constants/status";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

const APPLICATION_SIDELOADS = ["currentSubmission", "fundingProgramme"] as const;
type ApplicationSideload = (typeof APPLICATION_SIDELOADS)[number];

export class ApplicationGetQueryDto {
  @ApiProperty({
    required: false,
    isArray: true,
    type: String,
    enum: APPLICATION_SIDELOADS,
    description: "sideloads to include"
  })
  sideloads?: ApplicationSideload[];

  @ApiProperty({ required: false, default: true })
  @TransformBooleanString({ optional: true })
  translated?: boolean;
}

export class ApplicationIndexQueryDto extends IndexQueryDto {
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
  currentSubmissionStatus?: FormSubmissionStatus;
}
