import { Controller, Get, NotFoundException, Query, Request } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { OptionLabelDto } from "./dto/option-label.dto";
import { filter, groupBy, isEmpty, uniqBy } from "lodash";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import {
  FormOptionListOption,
  FormQuestionOption,
  I18nTranslation,
  User
} from "@terramatch-microservices/database/entities";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";

export type OptionLabelModel = { slug: string; label: string | null; labelId: number | null; imageUrl: string | null };

@Controller("forms/v3/optionLabels")
export class OptionLabelsController {
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
      attributes: ["slug", "label", "labelId", "imageUrl"]
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
    const document = buildJsonApi<OptionLabelDto>(OptionLabelDto, { forceDataArray: true });
    for (const dto of await this.getOptionLabelDtos(options, locale)) {
      document.addData(dto.slug, dto);
    }

    return document.addIndex({ requestPath: `/forms/v3/optionLabels${getStableRequestQuery({ ids })}` }).serialize();
  }

  private async getOptionLabelDtos(listOptions: OptionLabelModel[], locale: ValidLocale) {
    const i18nItemIds = filter(listOptions.map(({ labelId }) => labelId)) as number[];
    // Pull all translations at once and group them by i18nItemId
    const translations =
      i18nItemIds.length === 0
        ? {}
        : groupBy(
            await I18nTranslation.findAll({
              where: { language: locale, i18nItemId: i18nItemIds },
              attributes: ["i18nItemId", "shortValue", "longValue"]
            }),
            "i18nItemId"
          );

    return listOptions.map(labelModel =>
      populateDto<OptionLabelDto>(new OptionLabelDto(), {
        slug: labelModel.slug,
        imageUrl: labelModel.imageUrl,
        label:
          translations[labelModel.labelId ?? ""]?.[0]?.shortValue ??
          translations[labelModel.labelId ?? ""]?.[0]?.longValue ??
          labelModel.label ??
          ""
      })
    );
  }
}
