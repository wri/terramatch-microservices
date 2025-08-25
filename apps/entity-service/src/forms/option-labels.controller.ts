import { Controller, Get, NotFoundException, Query, Request } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { OptionLabelDto } from "./dto/option-label.dto";
import { filter, groupBy, isEmpty, uniqBy } from "lodash";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { FormOptionListOption, I18nTranslation, User } from "@terramatch-microservices/database/entities";
import { buildJsonApi, getDtoType, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";

@Controller("forms/v3/optionLabels")
export class OptionLabelsController {
  @Get()
  @ApiOperation({ operationId: "optionLabelsIndex" })
  @JsonApiResponse({ data: OptionLabelDto, hasMany: true })
  @ExceptionResponse(BadRequestException, { description: "Set of slugs is required" })
  @ExceptionResponse(NotFoundException, { description: "No records matching the given slugs exist" })
  async optionLabelsIndex(@Query("slugs") slugs: string[], @Request() { authenticatedUserId }) {
    if (isEmpty(slugs)) throw new BadRequestException("Set of slugs is required");
    const locale = (await User.findOne({ where: { id: authenticatedUserId }, attributes: ["locale"] }))?.locale;
    if (locale == null) throw new BadRequestException("Locale is required");

    const listOptions = await FormOptionListOption.findAll({
      where: { slug: slugs },
      attributes: ["slug", "label", "labelId", "imageUrl"]
    });
    if (listOptions.length === 0) throw new NotFoundException("No records matching the given slugs exist");

    const document = buildJsonApi<OptionLabelDto>(OptionLabelDto, { forceDataArray: true });
    const indexIds: string[] = [];
    for (const dto of await this.getOptionLabelDtos(uniqBy(listOptions, "slug"), locale)) {
      indexIds.push(dto.slug);
      document.addData(dto.slug, dto);
    }

    document.addIndexData({
      resource: getDtoType(OptionLabelDto),
      requestPath: `/forms/v3/optionLabels${getStableRequestQuery({ slugs })}`,
      ids: indexIds
    });

    return document.serialize();
  }

  private async getOptionLabelDtos(listOptions: FormOptionListOption[], locale: ValidLocale) {
    const i18nItemIds = filter(listOptions.map(({ labelId }) => labelId));
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

    return listOptions.map(listOption =>
      populateDto(new OptionLabelDto(), {
        slug: listOption.slug,
        imageUrl: listOption.imageUrl,
        label:
          translations[listOption.labelId]?.[0]?.shortValue ??
          translations[listOption.labelId]?.[0]?.longValue ??
          listOption.label
      })
    );
  }
}
