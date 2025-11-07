import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import { AssociationDto } from "./association.dto";
import { FinancialIndicator } from "@terramatch-microservices/database/entities";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { MediaDto } from "./media.dto";

@JsonApiDto({ type: "financialIndicators" })
export class FinancialIndicatorDto extends AssociationDto {
  constructor(
    financialIndicator?: FinancialIndicator,
    props?: HybridSupportProps<FinancialIndicatorDto, FinancialIndicator>
  ) {
    super();
    if (financialIndicator != null && props != null) {
      populateDto<FinancialIndicatorDto, FinancialIndicator>(this, financialIndicator, props);
    }
  }

  @ApiProperty({ nullable: true, type: String })
  collection: string | null;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: Number })
  amount: number | null;

  @ApiProperty({ nullable: true, type: Number })
  exchangeRate: number | null;

  @ApiProperty({ nullable: true, type: Number })
  year: number | null;

  @ApiProperty({ type: () => MediaDto, isArray: true, nullable: true })
  documentation: MediaDto[] | null;
}

export type FinancialIndicatorMedia = Pick<FinancialIndicatorDto, keyof typeof FinancialIndicator.MEDIA>;

export class EmbeddedFinancialIndicatorDto extends OmitType(FinancialIndicatorDto, [
  "entityType",
  "entityUuid",
  "documentation"
]) {
  constructor(
    financialIndicator: FinancialIndicator,
    additionalProps: AdditionalProps<EmbeddedFinancialIndicatorDto, FinancialIndicator>
  ) {
    super();
    populateDto<EmbeddedFinancialIndicatorDto, FinancialIndicator>(this, financialIndicator, additionalProps);
  }

  @ApiProperty({ nullable: true, type: Number })
  startMonth: number | null;

  @ApiProperty({ nullable: true, type: String })
  currency: string | null;
}
