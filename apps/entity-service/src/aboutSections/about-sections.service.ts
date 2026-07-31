import { BadRequestException, Injectable } from "@nestjs/common";
import { AboutSection, AboutSectionType } from "@terramatch-microservices/database/entities/about-section.entity";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { cast, col, fn } from "sequelize";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { AboutSectionDto, LinkDto } from "./dto/about-section.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { AboutSectionIndexQueryDto } from "./dto/about-section-index-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { groupBy, uniq } from "lodash";
import { Link } from "@terramatch-microservices/database/entities";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  ENTITY_SERVICE_EXPORT_QUEUE,
  EntityServiceDelayedJobsProcessor
} from "../jobs/entity-service-delayed-jobs.processor";

@Injectable()
export class AboutSectionsService {
  constructor(@InjectQueue(ENTITY_SERVICE_EXPORT_QUEUE) private readonly exportQueue: Queue) {}

  async findOne(type: AboutSectionType, framework: FrameworkKey) {
    const aboutSection = await AboutSection.findOne({
      where: [{ type }, fn("JSON_CONTAINS", col("frameworks"), cast(`"${framework}"`, "CHAR"))]
    });

    return aboutSection ?? (await AboutSection.findOne({ where: { type, frameworks: null } }));
  }

  async addIndex(document: DocumentBuilder, query: AboutSectionIndexQueryDto) {
    if (query.framework != null) {
      if (query.type == null) throw new BadRequestException("Type is required when framework is specified");
      if ((query.page?.number ?? 1) !== 1)
        throw new BadRequestException("Only the first page is available when framework is specified");

      const section = await this.findOne(query.type, query.framework);
      if (section != null) await this.addDto(document, section);

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

    for (const section of sections) {
      section.links = links[section.id] ?? [];
      await this.addDto(document, section);
    }

    return document.addIndex({
      requestPath: `/aboutSections/v3/aboutSections${getStableRequestQuery(query)}`,
      total: await builder.paginationTotal(),
      pageNumber: query.page?.number ?? 1
    });
  }

  async addDto(document: DocumentBuilder, section: AboutSection) {
    // This should already be loaded, but best to cover our bases
    section.links ??= await section.$get("links");
    document.addData(
      section.uuid,
      new AboutSectionDto(section, {
        id: section.uuid,
        header: section.header ?? "",
        title: section.title,
        description: section.description ?? "",
        contactSupportMessage: section.contactSupportMessage ?? "",
        contactSupportSubject: section.contactSupportSubject ?? "",
        links: section.links.map(link =>
          populateDto<LinkDto>(new LinkDto(), {
            id: link.uuid,
            title: link.title ?? "",
            url: link.url
          })
        )
      })
    );

    return document;
  }

  async getI18nLabels(section: AboutSection) {
    section.links ??= await section.$get("links");
    return uniq(
      [
        section.header,
        section.title,
        section.description,
        section.contactSupportMessage,
        section.contactSupportSubject,
        ...section.links.map(({ title }) => title)
      ].filter(isNotNull)
    );
  }

  async pushTranslations(section: AboutSection) {
    const i18nLabels = await this.getI18nLabels(section);
    return await EntityServiceDelayedJobsProcessor.queuePushTranslations(this.exportQueue, section.uuid, i18nLabels);
  }
}
