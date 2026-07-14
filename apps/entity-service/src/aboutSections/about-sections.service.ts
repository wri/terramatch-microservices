import { BadRequestException, Injectable } from "@nestjs/common";
import { AboutSection, AboutSectionType } from "@terramatch-microservices/database/entities/about-section.entity";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { cast, col, fn } from "sequelize";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { AboutSectionDto, LinkDto } from "./dto/about-section.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { DocumentBuilder } from "@terramatch-microservices/common/util";

@Injectable()
export class AboutSectionsService {
  constructor(private readonly localizationService: LocalizationService) {}

  private get userLocale() {
    const locale = UserContext.userLocale;
    if (locale == null) throw new BadRequestException("Locale is required");

    return locale;
  }

  async findOne(type: AboutSectionType, framework?: FrameworkKey) {
    if (framework != null) {
      const aboutSection = await AboutSection.findOne({
        where: [{ type }, fn("JSON_CONTAINS", col("frameworks"), cast(`"${framework}"`, "CHAR"))]
      });
      if (aboutSection != null) return aboutSection;
    }

    return await AboutSection.findOne({ where: { type, frameworks: null } });
  }

  async addDto(document: DocumentBuilder, section: AboutSection) {
    section.links ??= await section.$get("links");
    const i18nIds = await this.getI18nIds(section);
    const translations = await this.localizationService.translateIds(i18nIds, this.userLocale);

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
}
