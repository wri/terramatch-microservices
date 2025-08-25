import { Controller, Get, NotFoundException, Query, Request } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { OptionLabelDto } from "./dto/option-label.dto";
import { isEmpty, uniqBy } from "lodash";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { FormOptionListOption, User } from "@terramatch-microservices/database/entities";
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
      attributes: ["slug", "label", "imageUrl"],
      include: [{ association: "labelTranslated", attributes: ["id"] }]
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
    return await Promise.all(
      listOptions.map(async listOption => {
        if (listOption.labelTranslated == null) return populateDto(new OptionLabelDto(), listOption);

        const translation = await listOption.labelTranslated.$get("i18nTranslations", {
          where: { language: locale },
          attributes: ["shortValue", "longValue"]
        });
        return populateDto(new OptionLabelDto(), {
          slug: listOption.slug,
          imageUrl: listOption.imageUrl,
          label: translation?.[0]?.shortValue ?? translation?.[0]?.longValue ?? listOption.label
        });
      })
    );
  }
}
