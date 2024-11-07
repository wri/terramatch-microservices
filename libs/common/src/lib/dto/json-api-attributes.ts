import { ModelPropertiesAccessor } from "@nestjs/swagger/dist/services/model-properties-accessor";
import { pick } from "lodash";

/**
 * A simple class to make it easy to create a typed attributes DTO with new()
 *
 * See users.controller.ts findOne and user.dto.ts for a complex example.
 * See auth.controller.ts login for a simple example.
 */
export class JsonApiAttributes<DTO> {
  constructor(source: Partial<Omit<DTO, "type">>, overrides?: Partial<Omit<DTO, "type">>) {
    // This assigns only the attributes from source that are defined as ApiProperty in this DTO.
    const accessor = new ModelPropertiesAccessor();
    Object.assign(this, pick(source, accessor.getModelProperties(this.constructor.prototype)));
    if (overrides != null) {
      Object.assign(this, pick(overrides, accessor.getModelProperties(this.constructor.prototype)));
    }
  }
}
