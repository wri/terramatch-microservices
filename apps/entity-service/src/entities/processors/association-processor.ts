import { InternalServerErrorException, NotFoundException, Type } from "@nestjs/common";
import { AssociationDto } from "../dto/association.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { EntityClass, EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";
import { intersection } from "lodash";
import { UuidModel } from "@terramatch-microservices/database/types/util";

export abstract class AssociationProcessor<M extends UuidModel<M>, D extends AssociationDto<D>, E extends EntityModel> {
  abstract readonly DTO: Type<D>;

  constructor(
    protected readonly entityType: EntityType,
    protected readonly entityUuid: string,
    protected readonly entityModelClass: EntityClass<E>
  ) {}

  private _baseEntity: E;
  async getBaseEntity(): Promise<E> {
    if (this._baseEntity != null) return this._baseEntity;

    // Only pull the attributes that are needed by the entity policies.
    const attributes = intersection(
      ["id", "frameworkKey", "projectId", "siteId"],
      Object.keys(this.entityModelClass.getAttributes())
    );

    this._baseEntity = (await this.entityModelClass.findOne({ where: { uuid: this.entityUuid }, attributes })) as E;
    if (this._baseEntity == null) {
      throw new NotFoundException(`Base entity not found: [${this.entityModelClass.name}, ${this.entityUuid}]`);
    }

    return this._baseEntity;
  }

  async addDtos(document: DocumentBuilder): Promise<void> {
    const associations = await this.getAssociations(await this.getBaseEntity());

    const additionalProps = { entityType: this.entityType, entityUuid: this.entityUuid };
    for (const association of associations) {
      document.addData(association.uuid, new this.DTO(association, additionalProps));
    }
  }

  async getAssociations(baseEntity: E): Promise<M[]> {
    throw new InternalServerErrorException(`getAssociations not implemented [${this.DTO.name}, ${baseEntity.uuid}]`);
  }
}
