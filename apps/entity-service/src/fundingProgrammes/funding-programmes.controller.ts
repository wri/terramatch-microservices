import { Controller, Get, NotFoundException, Param, Query, UnauthorizedException } from "@nestjs/common";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { FundingProgramme, User } from "@terramatch-microservices/database/entities";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { FundingProgrammeDto } from "./dto/funding-programme.dto";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { FundingProgrammeQueryDto } from "./dto/funding-programme-query.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { FormDataService } from "../entities/form-data.service";

@Controller("fundingProgrammes/v3/fundingProgrammes")
export class FundingProgrammesController {
  constructor(private readonly policyService: PolicyService, private readonly formDataService: FormDataService) {}

  @Get()
  @ApiOperation({
    operationId: "fundingProgrammesIndex",
    summary: "Get all funding programmes"
  })
  @JsonApiResponse({ data: FundingProgrammeDto, hasMany: true })
  @ExceptionResponse(UnauthorizedException, {
    description: "User is not authorized to access these funding programmes"
  })
  async indexFundingProgrammes(@Query() { translated }: FundingProgrammeQueryDto) {
    const fundingProgrammes = await FundingProgramme.findAll();
    const locale = translated === false ? undefined : await User.findLocale(authenticatedUserId());
    await this.policyService.authorize("read", fundingProgrammes);
    return await this.formDataService.addFundingProgrammeDtos(
      buildJsonApi(FundingProgrammeDto, { forceDataArray: true }),
      fundingProgrammes,
      locale
    );
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "fundingProgrammeGet",
    summary: "Get a single funding programme by UUID"
  })
  @JsonApiResponse(FundingProgrammeDto)
  @ExceptionResponse(NotFoundException, { description: "Funding programme not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this funding programme" })
  async getFundingProgramme(@Param() { uuid }: SingleResourceDto, @Query() { translated }: FundingProgrammeQueryDto) {
    const fundingProgramme = await FundingProgramme.findOne({ where: { uuid } });
    if (fundingProgramme == null) throw new NotFoundException("Funding programme not found");

    const locale = translated === false ? undefined : await User.findLocale(authenticatedUserId());
    await this.policyService.authorize("read", fundingProgramme);

    return await this.formDataService.addFundingProgrammeDtos(
      buildJsonApi(FundingProgrammeDto),
      [fundingProgramme],
      locale
    );
  }
}
