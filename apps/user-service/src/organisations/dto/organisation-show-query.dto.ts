import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional } from "class-validator";

const ORGANISATION_SIDELOADS = ["financialCollection", "financialReport", "cover", "fundingTypes"] as const;
type OrganisationSideload = (typeof ORGANISATION_SIDELOADS)[number];

export class OrganisationShowQueryDto {
  @ApiProperty({
    required: false,
    isArray: true,
    type: String,
    enum: ORGANISATION_SIDELOADS,
    description: "sideloads to include"
  })
  @IsOptional()
  @IsArray()
  @IsIn(ORGANISATION_SIDELOADS, { each: true })
  sideloads?: OrganisationSideload[];
}
