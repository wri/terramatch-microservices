import { ModelPropertiesAccessor } from "@nestjs/swagger/dist/services/model-properties-accessor";
import { pick } from "lodash";
import { Type } from "@nestjs/common";

// Some type shenanigans to represent a type that _only_ includes properties defined in the
// included union type. This implementation was difficult to track down and get working. Found
// explanation here: https://nabeelvalley.co.za/blog/2022/08-07/common-object-type/
type CommonKeys<T, R = object> = R extends T ? keyof T & CommonKeys<Exclude<T, R>> : keyof T;
type Common<T> = Pick<T, CommonKeys<T>>;

/**
 * Returns an object with only the properties from source that are marked with @ApiProperty in the DTO.
 *
 * The return object will include all properties that exist on the source object and are defined
 * in the DTO. However, the return type will only indicate that the properties that are common between
 * the types passed in are present. This is useful to make sure that all properties that are expected
 * are included in a given API response.
 *
 * This utility will also pull values from getters on objects as well as defined properties.
 *
 * Example from user.dto.ts:
 *   constructor(user: User, frameworks: Framework[]) {
 *     super({
 *       ...pickApiProperties(user as Omit<User, "uuid" | "frameworks">, UserDto),
 *       uuid: user.uuid ?? "",
 *       frameworks: frameworks.map(({ name, slug }) => ({ name, slug }))
 *     });
 *   }
 *
 *   In the example above, the type passed to pickApiProperties removes "uuid" and "frameworks" from
 *   the source type passed in, requiring that they be implemented in the full object that gets passed
 *   to super.
 *
 * Example from site-polygon.dto.ts:
 *   constructor(sitePolygon: SitePolygon, indicators: IndicatorDto[]) {
 *     super({
 *       ...pickApiProperties(sitePolygon, SitePolygonDto),
 *       name: sitePolygon.polyName,
 *       siteId: sitePolygon.siteUuid,
 *       indicators,
 *       establishmentTreeSpecies: [],
 *       reportingPeriods: []
 *     });
 *   }
 *
 *   In this example, the additional properties added are ones that exist on the DTO definition but
 *   not on the SitePolygon entity class. Since the super() call requires all the properties that
 *   are defined in the DTO, this structure will fail to compile if any of the additional props are
 *   missing.
 *
 *   Note that if ...sitePolygon were used instead of ...pickApiProperties(sitePolygon, SitePolygonDto),
 *   we would fail to include properties that are accessed via getters (which turns out to include all
 *   data values on Sequelize objects), and would include anything extra is defined on sitePolygon.
 */
export function pickApiProperties<Source, DTO>(source: Source, dtoClass: Type<DTO>) {
  const accessor = new ModelPropertiesAccessor();
  const fields = accessor.getModelProperties(dtoClass.prototype);
  return pick(source, fields) as Common<Source | DTO>;
}

/**
 * A simple class to make it easy to create a typed attributes DTO with new()
 *
 * See users.controller.ts findOne and user.dto.ts for a complex example.
 * See auth.controller.ts login for a simple example.
 */
export class JsonApiAttributes<DTO> {
  constructor(source: Omit<DTO, "type">) {
    Object.assign(this, pickApiProperties(source, this.constructor as Type<DTO>));
  }
}
