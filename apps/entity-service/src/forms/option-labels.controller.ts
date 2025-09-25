import { Controller, Get, NotFoundException, Param, Query, Request } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { OptionLabelDto } from "./dto/option-label.dto";
import { filter, isEmpty, uniqBy } from "lodash";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import {
  FormOptionList,
  FormOptionListOption,
  FormQuestionOption,
  User
} from "@terramatch-microservices/database/entities";
import { buildJsonApi, DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";

export type OptionLabelModel = {
  slug: string;
  label: string | null;
  labelId: number | null;
  imageUrl: string | null;
  altValue?: string | null;
};

@Controller("forms/v3/optionLabels")
export class OptionLabelsController {
  constructor(private readonly localizationService: LocalizationService) {}

  @Get()
  @ApiOperation({ operationId: "optionLabelsIndex" })
  @JsonApiResponse({ data: OptionLabelDto, hasMany: true })
  @ExceptionResponse(BadRequestException, { description: "Set of slugs is required" })
  @ExceptionResponse(NotFoundException, { description: "No records matching the given slugs exist" })
  async optionLabelsIndex(@Query("ids") ids: string[], @Request() { authenticatedUserId }) {
    if (isEmpty(ids)) throw new BadRequestException("Set of ids is required");
    const locale = (await User.findOne({ where: { id: authenticatedUserId }, attributes: ["locale"] }))?.locale;
    if (locale == null) throw new BadRequestException("Locale is required");

    const listOptions = (await FormOptionListOption.findAll({
      where: { slug: ids },
      attributes: ["slug", "label", "labelId", "imageUrl", "altValue"]
    })) as OptionLabelModel[];

    const missingSlugs = filter(ids, slug => !listOptions.some(option => option.slug === slug));
    const formQuestions =
      missingSlugs.length === 0
        ? []
        : ((await FormQuestionOption.findAll({
            where: { slug: missingSlugs },
            attributes: ["slug", "label", "labelId", "imageUrl"]
          })) as OptionLabelModel[]);

    if (listOptions.length === 0 && formQuestions.length === 0) {
      throw new NotFoundException("No records matching the given ids exist");
    }

    const options = uniqBy([...listOptions, ...formQuestions], "slug");
    return (
      await this.addOptionListDtos(
        buildJsonApi<OptionLabelDto>(OptionLabelDto, { forceDataArray: true }),
        options,
        locale
      )
    ).addIndex({ requestPath: `/forms/v3/optionLabels${getStableRequestQuery({ ids })}` });
  }

  @Get(":listKey")
  @ApiOperation({ operationId: "optionLabelsGetList", description: "Get a list of option labels by list key" })
  @ApiParam({ name: "listKey", type: "string", description: "The list key" })
  @ExceptionResponse(NotFoundException, { description: "List for listKey not found" })
  @JsonApiResponse({ data: OptionLabelDto, hasMany: true })
  async findList(@Param("listKey") listKey: string, @Request() { authenticatedUserId }) {
    const locale = (await User.findOne({ where: { id: authenticatedUserId }, attributes: ["locale"] }))?.locale;
    if (locale == null) throw new BadRequestException("Locale is required");

    const list = await FormOptionList.findOne({
      where: { key: listKey },
      include: [
        {
          association: "listOptions",
          attributes: ["slug", "label", "labelId", "imageUrl", "altValue"]
        }
      ]
    });
    if (list?.listOptions == null || list.listOptions.length === 0) throw new NotFoundException("List not found");

    const options = filter(uniqBy(list.listOptions, "slug"), ({ slug }) => slug != null) as OptionLabelModel[];
    return (
      await this.addOptionListDtos(
        buildJsonApi<OptionLabelDto>(OptionLabelDto, { forceDataArray: true }),
        options,
        locale
      )
    ).addIndex({ requestPath: `/forms/v3/optionLabels/${listKey}` });
  }

  private async addOptionListDtos(document: DocumentBuilder, listOptions: OptionLabelModel[], locale: ValidLocale) {
    const i18nItemIds = filter(listOptions.map(({ labelId }) => labelId)) as number[];
    const translations = await this.localizationService.translateIds(i18nItemIds, locale);
    listOptions.forEach(labelModel => {
      document.addData(
        labelModel.slug,
        populateDto<OptionLabelDto>(new OptionLabelDto(), {
          slug: labelModel.slug,
          imageUrl: labelModel.imageUrl,
          label: translations[labelModel.labelId ?? -1] ?? labelModel.label ?? "",
          altValue: labelModel.altValue ?? null
        })
      );
    });

    return document;
  }
}
