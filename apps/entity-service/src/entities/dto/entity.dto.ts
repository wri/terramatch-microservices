import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportDto } from "@terramatch-microservices/common/dto/hybrid-support.dto";

/**
 * A utility type for constructing the "extra props" type of a DTO based on what's in the dto, the
 * base type (e.g. the light DTO & base model for a full DTO)
 */
export type AdditionalProps<DTO, BaseType> = Pick<DTO, keyof Omit<DTO, keyof BaseType>>;

export abstract class EntityDto extends HybridSupportDto {
  /**
   * All EntityDtos must include UUID in the attributes for use in the react-admin pagination
   * code.
   */
  @ApiProperty()
  uuid: string;
}
