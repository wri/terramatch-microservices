import { BadRequestException, Injectable } from "@nestjs/common";
import { AboutSection, AboutSectionType } from "@terramatch-microservices/database/entities/about-section.entity";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { LocalizationService, Translations } from "@terramatch-microservices/common/localization/localization.service";
import { cast, col, fn } from "sequelize";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { AboutSectionDto, LinkDto } from "./dto/about-section.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { AboutSectionIndexQueryDto } from "./dto/about-section-index-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { groupBy, uniq } from "lodash";
import { Link } from "@terramatch-microservices/database/entities";

@Injectable()
export class AboutSectionsService {
  constructor(private readonly localizationService: LocalizationService) {}

  private get userLocale() {
    const locale = UserContext.userLocale;
    if (locale == null) throw new BadRequestException("Locale is required");

    return locale;
  }

  async findOne(type: AboutSectionType, framework: FrameworkKey) {
    const aboutSection = await AboutSection.findOne({
      where: [{ type }, fn("JSON_CONTAINS", col("frameworks"), cast(`"${framework}"`, "CHAR"))]
    });

    return aboutSection ?? (await AboutSection.findOne({ where: { type, frameworks: null } }));
  }

  async addIndex(document: DocumentBuilder, query: AboutSectionIndexQueryDto, translate = true) {
    if (query.framework != null) {
      if (query.type == null) throw new BadRequestException("Type is required when framework is specified");
      if ((query.page?.number ?? 1) !== 1)
        throw new BadRequestException("Only the first page is available when framework is specified");

      const section = await this.findOne(query.type, query.framework);
      if (section != null) await this.addDto(document, section, translate);

      return document.addIndex({
        requestPath: `/aboutSections/v3/aboutSections${getStableRequestQuery(query)}`,
        total: section == null ? 0 : 1,
        pageNumber: 1
      });
    }

    const builder = PaginatedQueryBuilder.forNumberPage(AboutSection, query.page);
    if (query.type != null) builder.where({ type: query.type });
    const sections = await builder.execute();
    const links = sections.length === 0 ? {} : groupBy(await Link.for(sections).findAll(), "linkableId");

    const i18nIds: number[] = [];
    for (const section of sections) {
      section.links = links[section.id] ?? [];
      i18nIds.push(...(await this.getI18nIds(section)));
    }
    const translations = await this.localizationService.translateIds(
      uniq(i18nIds),
      translate ? this.userLocale : undefined
    );

    for (const section of sections) {
      await this.addDtoWithTranslations(document, section, translations);
    }

    return document.addIndex({
      requestPath: `/aboutSections/v3/aboutSections${getStableRequestQuery(query)}`,
      total: await builder.paginationTotal(),
      pageNumber: query.page?.number ?? 1
    });
  }

  async addDto(document: DocumentBuilder, section: AboutSection, translate = true) {
    section.links ??= await section.$get("links");
    const i18nIds = await this.getI18nIds(section);
    const translations = await this.localizationService.translateIds(i18nIds, translate ? this.userLocale : undefined);
    return this.addDtoWithTranslations(document, section, translations);
  }

  async getI18nIds(section: AboutSection) {
    section.links ??= await section.$get("links");
    return [
      section.headerId,
      section.titleId,
      section.descriptionId,
      section.contactSupportMessageId,
      section.contactSupportSubjectId,
      ...section.links.map(({ titleId }) => titleId)
    ].filter(isNotNull);
  }

  async pushTranslations(section: AboutSection) {
    const i18nIds = await this.getI18nIds(section);
    await this.localizationService.pushTranslationsForEntity(section.uuid, i18nIds);
  }

  private async addDtoWithTranslations(document: DocumentBuilder, section: AboutSection, translations: Translations) {
    // This should already be loaded, but best to cover our bases
    section.links ??= await section.$get("links");
    document.addData(
      section.uuid,
      new AboutSectionDto(section, {
        id: section.uuid,
        header: translations[section.headerId] ?? "",
        title: section.titleId == null ? null : translations[section.titleId],
        description: translations[section.descriptionId] ?? "",
        contactSupportMessage: translations[section.contactSupportMessageId] ?? "",
        contactSupportSubject: translations[section.contactSupportSubjectId] ?? "",
        links: section.links.map(link =>
          populateDto<LinkDto>(new LinkDto(), {
            id: link.uuid,
            title: translations[link.titleId] ?? "",
            url: link.url
          })
        )
      })
    );

    return document;
  }
}
