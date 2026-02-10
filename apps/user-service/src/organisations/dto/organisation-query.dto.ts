import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { IsOptional, IsString, ValidateNested } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

class OrganisationFilterDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  hqCountry?: string;
}

export class OrganisationIndexQueryDto extends IndexQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  fundingProgrammeUuid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, type: OrganisationFilterDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrganisationFilterDto)
  filter?: OrganisationFilterDto;
}
