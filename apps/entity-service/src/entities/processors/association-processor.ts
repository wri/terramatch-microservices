import { NotFoundException, Type } from "@nestjs/common";
import { AssociationDto } from "../dto/association.dto";
import { DocumentBuilder, getDtoType } from "@terramatch-microservices/common/util";
import { EntityClass, EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";
import { intersection } from "lodash";
import { UuidModel } from "@terramatch-microservices/database/types/util";

export abstract class AssociationProcessor<M extends UuidModel, D extends AssociationDto<D>> {
  abstract readonly DTO: Type<D>;

  constructor(
    protected readonly entityType: EntityType,
    protected readonly entityUuid: string,
    protected readonly entityModelClass: EntityClass<EntityModel>
  ) {}

  /**
   * The AssociationProcessor base class may be extended for more complicated cases, but many of our associations
   * are simple enough that providing a reference to the DTO class, and a getter of associations based on the
   * base entity is enough.
   */
  static buildSimpleProcessor<M extends UuidModel, D extends AssociationDto<D>>(
    dtoClass: Type<D>,
    associationGetter: (entity: EntityModel, entityLaravelType: string) => Promise<M[]>
  ) {
    class SimpleProcessor extends AssociationProcessor<M, D> {
      readonly DTO = dtoClass;

      async getAssociations(entity: EntityModel) {
        return await associationGetter(entity, this.entityModelClass.LARAVEL_TYPE);
      }
    }
    return SimpleProcessor;
  }

  protected abstract getAssociations(baseEntity: EntityModel): Promise<M[]>;

  private _baseEntity: EntityModel;
  async getBaseEntity(): Promise<EntityModel> {
    if (this._baseEntity != null) return this._baseEntity;

    // Only pull the attributes that are needed by the entity policies.
    const attributes = intersection(
      ["id", "frameworkKey", "projectId", "siteId", "nurseryId"],
      Object.keys(this.entityModelClass.getAttributes())
    );

    this._baseEntity = await this.entityModelClass.findOne({ where: { uuid: this.entityUuid }, attributes });
    if (this._baseEntity == null) {
      throw new NotFoundException(`Base entity not found: [${this.entityModelClass.name}, ${this.entityUuid}]`);
    }

    return this._baseEntity;
  }

  async addDtos(document: DocumentBuilder): Promise<void> {
    const associations = await this.getAssociations(await this.getBaseEntity());

    const additionalProps = { entityType: this.entityType, entityUuid: this.entityUuid };
    const indexIds: string[] = [];
    for (const association of associations) {
      indexIds.push(association.uuid);
      document.addData(association.uuid, new this.DTO(association, additionalProps));
    }

    const resource = getDtoType(this.DTO);
    document.addIndexData({
      resource,
      requestPath: `/entities/v3/${this.entityType}/${this.entityUuid}/${resource}`,
      ids: indexIds
    });
  }
}
