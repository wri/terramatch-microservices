import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { Dictionary } from "lodash";

export class BulkUploadWarning {
  constructor(
    message: string,
    code: string,
    { row, variables }: { row?: number; variables?: Dictionary<string | number> } = {}
  ) {
    this.message = message;
    this.row = row;
    this.code = code;
    this.variables = variables;
  }

  @ApiProperty({ description: "If relevant, the row the warning occurred on", type: Number })
  row?: number;

  @ApiProperty({ description: "The warning message" })
  message: string;

  @ApiProperty({ description: "The translation code" })
  code: string;

  @ApiProperty({ description: "The translation variables", required: false, type: Object })
  variables?: Dictionary<string | number>;
}

@JsonApiDto({ type: "treeBulkUploads" })
export class TreeBulkUploadDto {
  constructor(warnings: BulkUploadWarning[]) {
    this.warnings = warnings;
  }

  @ApiProperty({
    description: "Warnings that occurred during the import of the tree data for site reports.",
    isArray: true,
    type: BulkUploadWarning
  })
  warnings: BulkUploadWarning[];
}

export class TreeBulkUploadBody extends JsonApiBodyDto(
  class TreeBulkUploadData extends CreateDataDto("treeBulkUploads", class TreeBulkUploadAttributes {}) {}
) {}
