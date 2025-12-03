import { DisturbanceReportEntry } from "@terramatch-microservices/database/entities";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import { populateDto } from "./json-api-attributes";
import { HybridSupportProps } from "./hybrid-support.dto";
import { AssociationDto } from "./association.dto";
import { JsonApiDto } from "../decorators";

@JsonApiDto({ type: "disturbanceReportEntries" })
export class DisturbanceReportEntryDto extends AssociationDto {
  constructor(
    entry?: DisturbanceReportEntry,
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

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: String })
  subtitle: string | null;

  @ApiProperty({ nullable: true, type: String })
  value: string | null;
}

export class EmbeddedDisturbanceReportEntryDto extends OmitType(DisturbanceReportEntryDto, [
  "entityType",
  "entityUuid"
]) {
  constructor(entry: DisturbanceReportEntry) {
    super();
    populateDto<EmbeddedDisturbanceReportEntryDto>(this, entry);
  }

  @ApiProperty()
  uuid: string;
}
