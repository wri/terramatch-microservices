import { AssociationDto } from "./association.dto";
import { Tracking, TrackingEntry } from "@terramatch-microservices/database/entities";
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

export class TrackingEntryDto {
  constructor(entry: TrackingEntry) {
    populateDto<TrackingEntryDto>(this, entry);
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

@JsonApiDto({ type: "trackings" })
export class TrackingDto extends AssociationDto {
  constructor(demographic?: Tracking, additional?: AdditionalProps<TrackingDto, Tracking>) {
    super();
    if (demographic != null && additional != null) {
      populateDto<TrackingDto, Omit<Tracking, "entries">>(this, demographic, {
        ...additional,
        entries: demographic.entries?.map(entry => new TrackingEntryDto(entry)) ?? []
      });
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ enum: Tracking.DOMAINS })
  domain: string;

  @ApiProperty({ enum: Tracking.VALID_TYPES })
  type: string;

  @ApiProperty()
  collection: string;

  @ApiProperty({ type: () => TrackingEntryDto, isArray: true })
  entries: TrackingEntryDto[];
}

export class EmbeddedTrackingDto extends OmitType(TrackingDto, ["entityType", "entityUuid"]) {
  constructor(tracking: Tracking) {
    super();
    populateDto<EmbeddedTrackingDto, Tracking>(this, tracking, {
      entries: tracking.entries?.map(entry => new TrackingEntryDto(entry)) ?? []
    });
  }
}
