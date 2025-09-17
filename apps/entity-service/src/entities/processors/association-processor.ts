import { NotFoundException, Type } from "@nestjs/common";
import { AssociationDto } from "../dto/association.dto";
import { DocumentBuilder, getDtoType } from "@terramatch-microservices/common/util";
import { EntityClass, EntityModel, EntityType } from "@terramatch-microservices/database/constants/entities";
import { intersection } from "lodash";
import { UuidModel } from "@terramatch-microservices/database/types/util";
import { MediaQueryDto } from "../dto/media-query.dto";
import { EntitiesService } from "../entities.service";

export abstract class AssociationProcessor<M extends UuidModel, D extends AssociationDto> {
  abstract readonly DTO: Type<D>;

  constructor(
    protected readonly entityType: EntityType,
    protected readonly entityUuid: string,
    protected readonly entityModelClass: EntityClass<EntityModel>,
    protected readonly entitiesService: EntitiesService,
    protected readonly query?: MediaQueryDto
  ) {}

  /**
   * The AssociationProcessor base class may be extended for more complicated cases, but many of our associations
   * are simple enough that providing a reference to the DTO class, and a getter of associations based on the
   * base entity is enough.
   */
  static buildSimpleProcessor<M extends UuidModel, D extends AssociationDto>(
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

  /**
   * Returns all attributes that should be loaded on the base model load.
   *
   * Note: The code that uses this attribute will perform an intersection between this list and the available
   * attributes on the model class so it's OK to include attributes here that are not available on all Entity
   * classes.
   */
  get baseModelAttributes() {
    // Only pull the attributes that are needed by the entity policies.
    return ["id", "frameworkKey", "projectId", "siteId", "nurseryId"];
  }

  private _baseEntity: EntityModel;
  async getBaseEntity(): Promise<EntityModel> {
    if (this._baseEntity != null) return this._baseEntity;

    // Only pull the attributes that are needed by the entity policies.
    const attributes = intersection(this.baseModelAttributes, Object.keys(this.entityModelClass.getAttributes()));

    const baseEntity = await this.entityModelClass.findOne({ where: { uuid: this.entityUuid }, attributes });
    if (baseEntity == null) {
      throw new NotFoundException(`Base entity not found: [${this.entityModelClass.name}, ${this.entityUuid}]`);
    }

    return (this._baseEntity = baseEntity);
  }

  async addDtos(document: DocumentBuilder) {
    const associations = await this.getAssociations(await this.getBaseEntity());

    const additionalProps = { entityType: this.entityType, entityUuid: this.entityUuid };
    const indexIds: string[] = [];
    for (const association of associations) {
      indexIds.push(association.uuid);
      document.addData(association.uuid, new this.DTO(association, additionalProps));
    }

    const resource = getDtoType(this.DTO);
    document.addIndex({
      resource,
      requestPath: `/entities/v3/${this.entityType}/${this.entityUuid}/${resource}`,
      ids: indexIds
    });
  }
}
