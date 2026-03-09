import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsUUID } from "class-validator";
import { AssociableModel, USER_ASSOCIATION_MODELS } from "../user-association.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";

export class UserAssociationUpdateParamDto extends SingleResourceDto {
  @IsIn(USER_ASSOCIATION_MODELS)
  @ApiProperty({
    description: "The model type to associate users with",
    enum: USER_ASSOCIATION_MODELS
  })
  model: AssociableModel;

  @IsUUID()
  @ApiProperty({
    description: "UUID of the user whose association is being updated",
    example: "123e4567-e89b-12d3-a456-426614174000"
  })
  userUuid: string;
}
