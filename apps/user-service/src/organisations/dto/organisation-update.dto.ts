import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { ORGANISATION_STATUSES, OrganisationStatus } from "@terramatch-microservices/database/constants/status";

/**
 * Organisation profile fields are updated through the organisation wizard form
 * (PUT /entities/v3/organisations/:uuid/formData). This endpoint only handles fields that are not
 * part of the form.
 */
export class OrganisationUpdateAttributes {
  @IsOptional()
  @IsEnum(ORGANISATION_STATUSES)
  @ApiProperty({ enum: ORGANISATION_STATUSES, required: false })
  status?: OrganisationStatus;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ description: "Update the isTest flag.", required: false })
  isTest?: boolean;
}

export class OrganisationUpdateBody extends JsonApiBodyDto(
  class OrganisationUpdateData extends JsonApiDataDto({ type: "organisations" }, OrganisationUpdateAttributes) {}
) {}
