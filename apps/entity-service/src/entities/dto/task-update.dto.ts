import { IsIn, IsOptional } from "class-validator";
import { TASK_STATUSES, TaskStatus } from "@terramatch-microservices/database/constants/status";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";

class TaskUpdateAttributes {
  @IsOptional()
  @IsIn(TASK_STATUSES)
  @ApiProperty({
    description: "Request to change to the status of the given entity",
    nullable: true,
    enum: TASK_STATUSES
  })
  status?: TaskStatus | null;
}

export class TaskUpdateBody extends JsonApiBodyDto(
  class TaskData extends JsonApiDataDto({ type: "tasks" }, TaskUpdateAttributes) {}
) {}
