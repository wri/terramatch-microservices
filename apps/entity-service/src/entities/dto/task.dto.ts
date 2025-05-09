import { JsonApiAttributes, pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { Task } from "@terramatch-microservices/database/entities";

@JsonApiDto({ type: "tasks" })
export class TaskDto extends JsonApiAttributes<TaskDto> {
  constructor(task: Task) {
    super({
      ...pickApiProperties(task, TaskDto),
      updatedAt: task.updatedAt as Date
    });
  }

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  organisationName: string;

  @ApiProperty()
  frameworkKey: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  dueAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
