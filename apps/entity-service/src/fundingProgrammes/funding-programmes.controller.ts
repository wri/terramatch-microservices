import { Controller, Get, NotFoundException, Param, Query, UnauthorizedException } from "@nestjs/common";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { Form, FundingProgramme, Media, Stage, User } from "@terramatch-microservices/database/entities";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { FundingProgrammeDto, StageDto } from "./dto/funding-programme.dto";
import { buildJsonApi, DocumentBuilder } from "@terramatch-microservices/common/util";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { FundingProgrammeQueryDto } from "./dto/funding-programme-query.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { flatten, uniq } from "lodash";
import { EmbeddedMediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@Controller("fundingProgrammes/v3/fundingProgrammes")
export class FundingProgrammesController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly mediaService: MediaService,
    private readonly localizationService: LocalizationService
  ) {}

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
    return await this.addDtos(buildJsonApi(FundingProgrammeDto, { forceDataArray: true }), fundingProgrammes, locale);
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

    return await this.addDtos(buildJsonApi(FundingProgrammeDto), [fundingProgramme], locale);
  }

  private async addDtos(document: DocumentBuilder, fundingProgrammes: FundingProgramme[], locale?: ValidLocale) {
    const translationIds = uniq(
      flatten(
        fundingProgrammes.map(({ nameId, descriptionId, locationId }) => [nameId, descriptionId, locationId])
      ).filter(isNotNull)
    );
    const translations = locale == null ? {} : await this.localizationService.translateIds(translationIds, locale);
    const coverMedias = await Media.for(fundingProgrammes).findAll({
      where: { collectionName: "cover" },
      order: [["createdAt", "DESC"]]
    });

    const allStages = await Stage.findAll({
      where: { fundingProgrammeId: fundingProgrammes.map(({ uuid }) => uuid) },
      attributes: ["uuid", "fundingProgrammeId", "name", "deadlineAt"],
      order: [["order", "ASC"]]
    });
    const stageForms = await Form.findAll({
      where: { stageId: allStages.map(({ uuid }) => uuid) },
      attributes: ["uuid", "stageId"]
    });

    for (const fundingProgramme of fundingProgrammes) {
      const stages = allStages
        .filter(({ fundingProgrammeId }) => fundingProgrammeId === fundingProgramme.uuid)
        .map(({ name, deadlineAt, uuid }) =>
          populateDto(new StageDto(), {
            name,
            deadlineAt,
            formUuid: stageForms.find(({ stageId }) => stageId === uuid)?.uuid ?? null
          })
        );
      const coverMedia = coverMedias.find(({ modelId }) => modelId === fundingProgramme.id);
      document.addData(
        fundingProgramme.uuid,
        new FundingProgrammeDto(fundingProgramme, {
          ...this.localizationService.translateFields(translations, fundingProgramme, [
            "name",
            "description",
            "location"
          ]),
          cover:
            coverMedia == null
              ? null
              : new EmbeddedMediaDto(coverMedia, {
                  url: this.mediaService.getUrl(coverMedia),
                  thumbUrl: this.mediaService.getUrl(coverMedia, "thumbnail")
                }),
          stages
        })
      );
    }

    return document;
  }
}
