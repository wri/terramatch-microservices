import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { Task } from "@terramatch-microservices/database/entities";
import { HybridSupportDto } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { AdditionalProps } from "./entity.dto";

@JsonApiDto({ type: "tasks" })
export class TaskLightDto extends HybridSupportDto {
  constructor(task?: Task) {
    super();
    if (task != null) {
      this.populate(TaskLightDto, {
        ...pickApiProperties(task, TaskLightDto),
        lightResource: true,
        updatedAt: task.updatedAt as Date
      });
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

type AdditionalTaskFullProps = AdditionalProps<TaskFullDto, TaskLightDto>;

export class TaskFullDto extends TaskLightDto {
  constructor(task: Task, props: AdditionalTaskFullProps) {
    super();
    this.populate(TaskFullDto, {
      ...pickApiProperties(task, TaskFullDto),
      lightResource: false,
      updatedAt: task.updatedAt as Date,
      ...props
    });
  }

  @ApiProperty()
  treesPlantedCount: number;
}
