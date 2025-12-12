import { Controller, Get, NotFoundException, Param, Query, UnauthorizedException } from "@nestjs/common";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { FundingProgramme, Organisation, User } from "@terramatch-microservices/database/entities";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { FundingProgrammeDto } from "./dto/funding-programme.dto";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { FundingProgrammeQueryDto } from "./dto/funding-programme-query.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { FormDataService } from "../entities/form-data.service";
import { uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { literal, Op } from "sequelize";

@Controller("fundingProgrammes/v3")
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
  async indexFundingProgrammes(@Query() query: FundingProgrammeQueryDto) {
    const permissions = await this.policyService.getPermissions();
    let fundingProgrammes: FundingProgramme[];
    if (permissions.find(p => p.startsWith("framework-")) == null) {
      // non-admins only have access to FPs that match their org types
      const orgUuids = await User.orgUuids(authenticatedUserId());
      const types =
        orgUuids.length === 0
          ? []
          : uniq(
              (
                await Organisation.findAll({
                  where: { uuid: orgUuids },
                  attributes: ["type"]
                })
              ).map(({ type }) => type)
            ).filter(isNotNull);
      fundingProgrammes =
        types.length === 0
          ? []
          : await FundingProgramme.findAll({
              // It's unclear why, but sequelize is failing to generate an appropriate like query here
              where: { [Op.or]: types.map(type => literal(`organisation_types like '%"${type}"%'`)) }
            });
    } else {
      // admins have access to everything
      fundingProgrammes = await FundingProgramme.findAll();
    }

    const locale = query.translated === false ? undefined : await User.findLocale(authenticatedUserId());
    await this.policyService.authorize("read", fundingProgrammes);
    const document = buildJsonApi(FundingProgrammeDto, { forceDataArray: true }).addIndex({
      requestPath: `/fundingProgrammes/v3${getStableRequestQuery(query)}`
    });
    return await this.formDataService.addFundingProgrammeDtos(document, fundingProgrammes, locale);
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
