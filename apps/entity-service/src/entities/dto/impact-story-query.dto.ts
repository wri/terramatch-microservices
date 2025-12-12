import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional } from "class-validator";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { ORGANISATION_TYPES, OrganisationType } from "@terramatch-microservices/database/constants";

export class ImpactStoryQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  country?: string;

  @ApiProperty({
    enum: ORGANISATION_TYPES,
    isArray: true,
    required: false,
    name: "organisationType[]",
    description: "Filter results by organisationType"
  })
  @IsOptional()
  @IsArray()
  organisationType?: OrganisationType[];

  @ApiProperty({ required: false })
  @IsOptional()
  projectUuid?: string;

  @ApiProperty({ required: false, isArray: true })
  @IsOptional()
  @IsArray()
  category?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  createdAt?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  organisationUuid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  uuid?: string;
}
