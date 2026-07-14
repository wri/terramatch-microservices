import { BadRequestException, Injectable } from "@nestjs/common";
import { AboutSection, AboutSectionType } from "@terramatch-microservices/database/entities/about-section.entity";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { cast, col, fn } from "sequelize";
import { Link } from "@terramatch-microservices/database/entities";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { AboutSectionDto, LinkDto } from "./dto/about-section.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

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

  async getDto(section: AboutSection) {
    const links = await Link.for(section).findAll();
    const i18nIds = [
      section.headerId,
      section.titleId,
      section.descriptionId,
      section.contactSupportMessageId,
      section.contactSupportSubjectId,
      ...links.map(({ titleId }) => titleId)
    ].filter(isNotNull);
    const translations = await this.localizationService.translateIds(i18nIds, this.userLocale);

    return new AboutSectionDto(section, {
      header: translations[section.headerId] as string,
      title: section.titleId == null ? null : translations[section.titleId],
      description: translations[section.descriptionId] as string,
      contactSupportMessage: translations[section.contactSupportMessageId] as string,
      contactSupportSubject: translations[section.contactSupportSubjectId] as string,
      links: links.map(link =>
        populateDto<LinkDto>(new LinkDto(), {
          title: translations[link.titleId] as string,
          url: link.url
        })
      )
    });
  }
}
