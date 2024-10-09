/**
 * A simple class to make it easy to create a typed attributes DTO with new()
 *
 * See users.controller.ts findOne and user.dto.ts for a complex example.
 * See auth.controller.ts login for a simple example.
 */
export class JsonApiAttributes<DTO> {
  constructor(props: Omit<DTO, "type">) {
    Object.assign(this, props);
  }
}
