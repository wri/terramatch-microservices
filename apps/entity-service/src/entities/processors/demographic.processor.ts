import { AssociationProcessor } from "./association-processor";
import { Demographic } from "@terramatch-microservices/database/entities";
import { DemographicDto } from "../dto/demographic.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { EntityModel } from "@terramatch-microservices/database/constants/entities";
import { DemographicType } from "@terramatch-microservices/database/types/demographic";
import { BadRequestException } from "@nestjs/common";

const ensureDemographic =
  (demographicalType: string, type: DemographicType) => (demographics: Demographic[], collection: string) => {
    const existing = demographics.find(
      demographic => demographic.type === type && demographic.collection === collection
    );
    if (existing != null) return demographics;

    // We magic up a UUID here because the API DTO needs it (and the FE too). This association is read-only
    // (it only gets updated via forms), but even if we did support updating demographics directly via API,
    // this should be OK since UUIDs are expected to be unique.
    return [...demographics, new Demographic({ uuid: crypto.randomUUID(), demographicalType, type, collection })];
  };

export class DemographicProcessor<EntityModelType extends EntityModel> extends AssociationProcessor<
  Demographic,
  DemographicDto,
  EntityModelType
> {
  readonly DTO = DemographicDto;

  async addDtos(document: DocumentBuilder) {
    const demographicalType = this.entityModelClass.LARAVEL_TYPE;
    const expectedCollections = Object.entries(Demographic.COLLECTION_MAPPING[demographicalType] ?? {});
    if (expectedCollections.length === 0) {
      throw new BadRequestException(
        `This entity type doesn't have any demographic associations [${this.entityModelClass.name}]`
      );
    }

    const { id: demographicalId } = await this.getBaseEntity();
    const demographics = await Demographic.findAll({
      where: {
        demographicalType,
        demographicalId,
        hidden: false
      },
      include: [{ association: "entries" }]
    });

    // For demographics, we want to send down a stubbed model for types / collections that don't
    // actually exist in the DB so that the FE can be assured that they will all be included with
    // their mapped collection title.
    const demographicsWithStubs = expectedCollections.reduce(
      (allDemographics, [demographicType, collectionMap]) =>
        Object.keys(collectionMap).reduce(
          ensureDemographic(demographicalType, demographicType as DemographicType),
          allDemographics
        ),
      demographics
    );

    const additionalProps = { entityType: this.entityType, entityUuid: this.entityUuid };
    for (const demographic of demographicsWithStubs) {
      document.addData(
        demographic.uuid,
        new DemographicDto(demographic, { ...additionalProps, collectionTitle: demographic.collectionTitle })
      );
    }
  }
}
