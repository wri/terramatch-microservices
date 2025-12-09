import { ApiProperty } from "@nestjs/swagger";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { IsOptional } from "class-validator";
import { FormSubmissionStatus } from "@terramatch-microservices/database/constants/status";

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
  currentSubmissionStatus?: FormSubmissionStatus;
}
