import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";

@JsonApiDto({ type: "forms" })
export class FormDto {
  @ApiProperty()
  uuid: string;

  @ApiProperty({ description: "Translated form title" })
  title: string;

  @ApiProperty({ nullable: true, type: String, description: "Translated form subtitle" })
  subtitle: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Translated form description" })
  description: string | null;

  @ApiProperty({ nullable: true, enum: FRAMEWORK_KEYS })
  frameworkKey: FrameworkKey;

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty({ nullable: true, type: String })
  documentation: string | null;

  @ApiProperty({ nullable: true, type: String })
  documentationLabel: string | null;

  @ApiProperty({ nullable: true, type: Date })
  deadlineAt: Date | null;

  @ApiProperty({ nullable: true, type: String, description: "Translated submission message" })
  submissionMessage: string | null;

  @ApiProperty()
  published: boolean;

  @ApiProperty({ nullable: true, type: String })
  stageId: string | null;

  @ApiProperty({ nullable: true, type: String })
  fundingProgrammeId: string | null;
}
