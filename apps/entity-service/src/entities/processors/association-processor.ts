import { Model } from "sequelize-typescript";
import { NotFoundException, Type } from "@nestjs/common";
import { AssociationDto } from "../dto/association.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { EntityClass, EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";

export abstract class AssociationProcessor<M extends Model<M>, D extends AssociationDto<D>, E extends EntityModel> {
  abstract readonly DTO: Type<D>;

  constructor(
    protected readonly entityType: EntityType,
    protected readonly entityUuid: string,
    protected readonly entityModelClass: EntityClass<E>
  ) {}

  private _baseEntity: E;
  async getBaseEntity(): Promise<E> {
    if (this._baseEntity != null) return this._baseEntity;

    this._baseEntity = (await this.entityModelClass.findOne({
      where: { uuid: this.entityUuid },
      // Only pull the attributes that are needed by the entity policies.
      attributes: ["id", "frameworkKey"]
    })) as E;
    if (this._baseEntity == null) {
      throw new NotFoundException(`Base entity not found: [${this.entityModelClass.name}, ${this.entityUuid}]`);
    }

    return this._baseEntity;
  }

  abstract addDtos(document: DocumentBuilder): Promise<void>;
}
