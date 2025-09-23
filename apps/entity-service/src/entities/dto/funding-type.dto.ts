import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { AssociationDto } from "./association.dto";
import { FundingType } from "@terramatch-microservices/database/entities";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

@JsonApiDto({ type: "fundingTypes" })
export class FundingTypeDto extends AssociationDto {
  constructor(fundingType: FundingType, props?: HybridSupportProps<FundingTypeDto, FundingType>) {
    super();
    if (fundingType != null && props != null) {
      populateDto<FundingTypeDto, FundingType>(this, fundingType, props);
    }
  }

  @ApiProperty({ nullable: true, type: String })
  source: string | null;

  @ApiProperty({ nullable: true, type: Number })
  amount: number | null;

  @ApiProperty({ nullable: true, type: Number })
  year: number | null;

  @ApiProperty({ nullable: true, type: String })
  type: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: Number })
  financialReportId: string | null;
}
