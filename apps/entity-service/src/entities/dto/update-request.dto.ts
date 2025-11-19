import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { UPDATE_REQUEST_STATUSES, UpdateRequestStatus } from "@terramatch-microservices/database/constants/status";
import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { FeedbackFieldsAttributes } from "./entity-update.dto";

@JsonApiDto({ type: "updateRequests" })
export class UpdateRequestDto {
  @ApiProperty()
  formUuid: string;

  @ApiProperty({ enum: UPDATE_REQUEST_STATUSES })
  status: UpdateRequestStatus;

  @ApiProperty()
  entityAnswers: object;

  @ApiProperty()
  updateRequestAnswers: object;
}

export class UpdateRequestAttributes extends FeedbackFieldsAttributes {
  @IsOptional()
  @IsIn(UPDATE_REQUEST_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given entity",
    required: false,
    enum: UPDATE_REQUEST_STATUSES
  })
  status?: UpdateRequestStatus;
}

export class UpdateRequestUpdateBody extends JsonApiBodyDto(
  class UpdateRequestData extends JsonApiDataDto({ type: "updateRequests" }, UpdateRequestAttributes) {}
) {}
