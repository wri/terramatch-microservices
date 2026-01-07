import { AssociationDto } from "./association.dto";
import { Demographic, DemographicEntry } from "@terramatch-microservices/database/entities";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import { AdditionalProps, populateDto } from "./json-api-attributes";
import { JsonApiDto } from "../decorators";
import {
  ALL_BENEFICIARIES_PROJECT_COLLECTIONS,
  CONVERGENCE,
  DIRECT,
  DIRECT_OTHER,
  JOBS_PROJECT_COLLECTIONS,
  PAID_OTHER,
  RESTORATION_PARTNERS_PROJECT_COLLECTIONS,
  TRAINING_BENEFICIARIES_PROJECT_COLLECTIONS,
  VOLUNTEERS_PROJECT_COLLECTIONS,
  WORKDAYS_PROJECT_COLLECTIONS,
  WORKDAYS_SITE_COLLECTIONS
} from "@terramatch-microservices/database/constants/demographic-collections";
import { JsonApiConstants } from "../decorators/json-api-constants.decorator";
import { without } from "lodash";

@JsonApiConstants
export class DemographicCollections {
  @ApiProperty({ example: WORKDAYS_PROJECT_COLLECTIONS })
  WORKDAYS_PROJECT: string[];

  @ApiProperty({ example: without(WORKDAYS_PROJECT_COLLECTIONS, DIRECT, CONVERGENCE) })
  WORKDAYS_PROJECT_PPC: string[];

  @ApiProperty({ example: PAID_OTHER })
  WORKDAYS_PROJECT_OTHER: string;

  @ApiProperty({ example: WORKDAYS_SITE_COLLECTIONS })
  WORKDAYS_SITE: string[];

  @ApiProperty({ example: PAID_OTHER })
  WORKDAYS_SITE_OTHER: string;

  @ApiProperty({ example: RESTORATION_PARTNERS_PROJECT_COLLECTIONS })
  RESTORATION_PARTNERS_PROJECT: string[];

  @ApiProperty({ example: DIRECT_OTHER })
  RESTORATION_PARTNERS_PROJECT_OTHER: string;

  @ApiProperty({ example: JOBS_PROJECT_COLLECTIONS })
  JOBS_PROJECT: string[];

  @ApiProperty({ example: VOLUNTEERS_PROJECT_COLLECTIONS })
  VOLUNTEERS_PROJECT: string[];

  @ApiProperty({ example: ALL_BENEFICIARIES_PROJECT_COLLECTIONS })
  BENEFICIARIES_PROJECT_ALL: string[];

  @ApiProperty({ example: TRAINING_BENEFICIARIES_PROJECT_COLLECTIONS })
  BENEFICIARIES_PROJECT_TRAINING: string[];
}

export class DemographicEntryDto {
  constructor(entry: DemographicEntry) {
    populateDto<DemographicEntryDto>(this, entry);
  }

  @ApiProperty()
  type: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  subtype?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  name?: string | null;

  @ApiProperty()
  amount: number;
}

@JsonApiDto({ type: "demographics" })
export class DemographicDto extends AssociationDto {
  constructor(demographic?: Demographic, additional?: AdditionalProps<DemographicDto, Demographic>) {
    super();
    if (demographic != null && additional != null) {
      populateDto<DemographicDto, Omit<Demographic, "entries">>(this, demographic, {
        ...additional,
        entries: demographic.entries?.map(entry => new DemographicEntryDto(entry)) ?? []
      });
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ enum: Demographic.VALID_TYPES })
  type: string;

  @ApiProperty()
  collection: string;

  @ApiProperty({ type: () => DemographicEntryDto, isArray: true })
  entries: DemographicEntryDto[];
}

export class EmbeddedDemographicDto extends OmitType(DemographicDto, ["entityType", "entityUuid"]) {
  constructor(demographic: Demographic) {
    super();
    populateDto<EmbeddedDemographicDto, Demographic>(this, demographic, {
      entries: demographic.entries?.map(entry => new DemographicEntryDto(entry)) ?? []
    });
  }
}
