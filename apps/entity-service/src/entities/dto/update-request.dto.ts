import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { UPDATE_REQUEST_STATUSES, UpdateRequestStatus } from "@terramatch-microservices/database/constants/status";
import { ApiProperty } from "@nestjs/swagger";

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
