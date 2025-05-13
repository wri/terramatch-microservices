import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";
import { Strata } from "@terramatch-microservices/database/entities/stratas.entity";
import { AllowNull, Column } from "sequelize-typescript";
import { INTEGER, STRING } from "sequelize";

@JsonApiDto({ type: "stratas" })
export class StrataDto extends AssociationDto {
  constructor(strata: Strata, additional: AssociationDtoAdditionalProps) {
    super();
    populateDto<StrataDto, Strata>(this, strata, additional);
  }

  @AllowNull
  @Column(STRING)
  description: string | null;

  @AllowNull
  @Column(INTEGER)
  extent: string | null;
}
