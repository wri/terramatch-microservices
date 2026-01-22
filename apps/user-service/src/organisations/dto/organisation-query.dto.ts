import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class OrganisationIndexQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  fundingProgrammeUuid?: string;
}
