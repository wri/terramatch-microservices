import { DisturbanceReportEntry } from "@terramatch-microservices/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { AssociationDto } from "./association.dto";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "disturbanceReportEntries" })
export class DisturbanceReportEntryDto extends AssociationDto {
  constructor(
    entry: DisturbanceReportEntry,
    props?: HybridSupportProps<DisturbanceReportEntryDto, DisturbanceReportEntry>
  ) {
    super();
    if (entry != null && props != null) {
      populateDto<DisturbanceReportEntryDto, DisturbanceReportEntry>(this, entry, props);
    }
  }

  @ApiProperty()
  name: string;

  @ApiProperty()
  inputType: string;

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty({ nullable: true })
  subtitle: string | null;

  @ApiProperty({ nullable: true })
  value: string | null;
}
