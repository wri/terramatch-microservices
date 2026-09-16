import { JsonApiDto } from "../decorators";
import { ApiProperty } from "@nestjs/swagger";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { TASK_STATUSES, TaskStatus } from "@terramatch-microservices/database/constants/status";
import { Task, UserTask } from "@terramatch-microservices/database/entities";
import { populateDto } from "./json-api-attributes";

type UserTaskWithUser = UserTask & {
  userUuid: string;
  firstName: string | null;
  lastName: string | null;
};

export class UserTaskAssociation {
  constructor(userTask: UserTask) {
    populateDto<UserTaskAssociation>(this, userTask as UserTaskWithUser);
  }

  @ApiProperty()
  userUuid: string;

  @ApiProperty({ type: String, nullable: true })
  firstName: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastName: string | null;

  @ApiProperty()
  assigned: boolean;

  @ApiProperty()
  read: boolean;
}

// This DTO should be kept to the minimum required to populate rows on the event center in the FE
@JsonApiDto({ type: "userTasks" })
export class UserTaskDto {
  constructor(task: Task, associations: UserTaskAssociation[]) {
    populateDto<UserTaskDto, Task>(this, task, { associations });
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  projectUuid?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  projectName?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  organisationUuid?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  organisationName?: string | null;

  @ApiProperty({ enum: FRAMEWORK_KEYS, required: false, nullable: true })
  frameworkKey?: FrameworkKey | null;

  @ApiProperty({ enum: TASK_STATUSES })
  status: TaskStatus;

  @ApiProperty({ type: Date, required: false, nullable: true })
  dueAt?: Date | null;

  @ApiProperty({ type: UserTaskAssociation, isArray: true })
  associations: UserTaskAssociation[];
}
