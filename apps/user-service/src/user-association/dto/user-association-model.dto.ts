import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { AssociableModel, USER_ASSOCIATION_MODELS } from "../user-association.service";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";

export class UserAssociationModelParamDto extends SingleResourceDto {
  @IsIn(USER_ASSOCIATION_MODELS)
  @ApiProperty({
    description: "The model type to associate users with",
    enum: USER_ASSOCIATION_MODELS
  })
  model: AssociableModel;
}
