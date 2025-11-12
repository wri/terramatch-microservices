import { FormModel, FormModelType } from "@terramatch-microservices/database/constants/entities";
import {
  LinkedField,
  LinkedFieldResource,
  LinkedFile,
  LinkedRelation
} from "@terramatch-microservices/database/constants/linked-fields";
import { Dictionary } from "lodash";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { LoggerService } from "@nestjs/common";
import { fieldCollector } from "./field.collector";
import { fileCollector } from "./file.collector";
import { demographicsCollector } from "./demographics.collector";
import { treeSpeciesCollector } from "./tree-species.collector";
import { disturbancesCollector } from "./disturbances.collector";
import { invasivesCollector } from "./invasives.collector";
import { seedingsCollector } from "./seedings.collector";
import { stratasCollector } from "./stratas.collector";
import { ownershipStakeCollector } from "./ownership-stake.collector";
import { leadershipsCollector } from "./leaderships.collector";
import { fundingTypesCollector } from "./funding-types.collector";
import { financialIndicatorsCollector } from "./financial-indicators.collector";
import { disturbanceReportEntriesCollector } from "./disturbance-report-entries.collector";

export type FormTypeMap<T> = Partial<Record<FormModelType, T>>;
export type FormModels = FormTypeMap<FormModel>;

export type ResourceCollector<TField extends LinkedField | LinkedFile | LinkedRelation> = {
  /**
   * Gather information about which fields / models this collector will need to pull data from
   */
  addField(field: TField, modelType: FormModelType, questionUuid: string): void;

  /**
   * Execute as few queries as possible to satisfy all current answer data for this form.
   */
  collect(answers: Dictionary<unknown>, models: FormModels): Promise<void>;

  /**
   * Syncs the answers from a form for this relation type. May NOOP if this is not a relation collector.
   */
  syncRelation(
    model: FormModel,
    field: LinkedRelation,
    answer: object[] | null | undefined,
    hidden: boolean
  ): Promise<void>;
};

export class LinkedAnswerCollector {
  public fields = fieldCollector(this.logger);
  public files = fileCollector(this.logger, this.mediaService);

  private relationCollectors = {} as Partial<Record<LinkedFieldResource, ResourceCollector<LinkedRelation>>>;

  constructor(private readonly logger: LoggerService, private readonly mediaService: MediaService) {}

  get demographics() {
    return this.getCollector("demographics", () => demographicsCollector(this.logger));
  }
  get treeSpecies() {
    return this.getCollector("treeSpecies", () => treeSpeciesCollector(this.logger));
  }
  get disturbances() {
    return this.getCollector("disturbances", () => disturbancesCollector(this.logger));
  }
  get invasives() {
    return this.getCollector("invasives", () => invasivesCollector(this.logger));
  }
  get seedings() {
    return this.getCollector("seedings", () => seedingsCollector(this.logger));
  }
  get stratas() {
    return this.getCollector("stratas", () => stratasCollector(this.logger));
  }
  get ownershipStake() {
    return this.getCollector("ownershipStake", () => ownershipStakeCollector(this.logger));
  }
  get leaderships() {
    return this.getCollector("leaderships", () => leadershipsCollector(this.logger));
  }
  get fundingTypes() {
    return this.getCollector("fundingTypes", () => fundingTypesCollector(this.logger));
  }
  get financialIndicators() {
    return this.getCollector("financialIndicators", () => financialIndicatorsCollector(this.logger));
  }
  get disturbanceReportEntries() {
    return this.getCollector("disturbanceReportEntries", () => disturbanceReportEntriesCollector(this.logger));
  }

  async collect(answers: Dictionary<unknown>, models: FormModels) {
    await Promise.all(
      [this.fields, this.files, ...Object.values(this.relationCollectors)].map(collector =>
        collector.collect(answers, models)
      )
    );
  }

  private getCollector(resource: LinkedFieldResource, factory: () => ResourceCollector<LinkedRelation>) {
    return this.relationCollectors[resource] ?? (this.relationCollectors[resource] = factory());
  }
}
