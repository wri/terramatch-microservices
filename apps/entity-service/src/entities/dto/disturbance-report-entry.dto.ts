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

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  inputType: string;

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: String })
  subtitle: string | null;

  @ApiProperty({ nullable: true, type: String })
  value: string | null;
}
