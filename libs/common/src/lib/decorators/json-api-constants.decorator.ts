import { applyDecorators } from "@nestjs/common";
import { ApiSchema } from "@nestjs/swagger";

/**
 * Decorator to indicate that this API schema is a set of constants that should be generated for use
 * in the front end as actual constant values, rather than just a type.
 *
 * Each member of the DTO should have @ApiProperty({ example }) specified. The example is turned into
 * a compile-time constant in the FE codebase.
 */
export const JsonApiConstants = applyDecorators(ApiSchema({ description: "CONSTANTS" }));
