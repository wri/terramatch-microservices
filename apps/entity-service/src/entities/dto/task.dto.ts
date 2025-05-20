import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { Task } from "@terramatch-microservices/database/entities";
import { HybridSupportDto, HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

@JsonApiDto({ type: "tasks" })
export class TaskLightDto extends HybridSupportDto {
  constructor(task?: Task) {
    super();
    if (task != null) {
      populateDto<TaskLightDto, Task>(this, task, { lightResource: true });
    }
  }

  @ApiProperty()
  uuid: string;

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

export class TaskFullDto extends TaskLightDto {
  constructor(task: Task, props: HybridSupportProps<TaskFullDto, Task>) {
    super();
    populateDto<TaskFullDto, Task>(this, task, { lightResource: false, ...props });
  }

  @ApiProperty()
  treesPlantedCount: number;
}
