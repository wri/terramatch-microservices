import { BadRequestException, Injectable } from "@nestjs/common";
import { AboutSection, AboutSectionType } from "@terramatch-microservices/database/entities/about-section.entity";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { cast, col, fn, Op, where } from "sequelize";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { AboutSectionDto, LinkDto, StoreAboutSectionAttributes } from "./dto/about-section.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { DocumentBuilder, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { AboutSectionIndexQueryDto } from "./dto/about-section-index-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { groupBy, isEmpty, uniq, xor } from "lodash";
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
    return (await this.findForFramework(type, framework)) ?? (await this.findDefault(type));
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
    return await EntityServiceDelayedJobsProcessor.queuePushTranslations(this.exportQueue, section.uuid, i18nLabels, {
      entity_type: "aboutSections",
      entity_name: `type=${section.type}, frameworks=${isEmpty(section.frameworks) ? "default" : section.frameworks?.join(", ")}`
    });
  }

  async store(attributes: StoreAboutSectionAttributes, section = new AboutSection()) {
    await this.validateFrameworksForStore(attributes, section);

    section.type = attributes.type;
    section.frameworks = attributes.frameworks ?? null;
    section.header = attributes.header;
    section.title = attributes.title ?? null;
    section.description = attributes.description;
    section.contactSupportMessage = attributes.contactSupportMessage;
    section.contactSupportSubject = attributes.contactSupportSubject;
    await section.save();

    section.links = await Promise.all(
      attributes.links.map(async (linkAttributes, index) => {
        if (linkAttributes.id != null) {
          const link = await Link.findOne({ where: { uuid: linkAttributes.id } });
          if (link != null && link.linkableType === AboutSection.LARAVEL_TYPE && link.linkableId === section.id) {
            link.order = index;
            link.title = linkAttributes.title;
            link.url = linkAttributes.url;
            await link.save();
            return link;
          }
        }

        return await Link.create({
          order: index,
          title: linkAttributes.title,
          url: linkAttributes.url,
          linkableType: AboutSection.LARAVEL_TYPE,
          linkableId: section.id
        });
      })
    );

    await Link.destroy({
      where: {
        linkableType: AboutSection.LARAVEL_TYPE,
        linkableId: section.id,
        id: { [Op.notIn]: section.links.map(({ id }) => id) }
      }
    });

    return section;
  }

  private async findForFramework(type: AboutSectionType, framework: FrameworkKey) {
    return await AboutSection.findOne({
      where: [{ type }, fn("JSON_CONTAINS", col("frameworks"), cast(`"${framework}"`, "CHAR"))]
    });
  }

  private async findDefault(type: AboutSectionType) {
    return await AboutSection.findOne({
      where: {
        type,
        [Op.or]: [where(fn("JSON_LENGTH", col("frameworks")), 0), { frameworks: null }]
      }
    });
  }

  private async validateFrameworksForStore(attributes: StoreAboutSectionAttributes, section: AboutSection) {
    const attributeFrameworksEmpty = isEmpty(attributes.frameworks);
    const sectionFrameworksEmpty = isEmpty(section.frameworks);
    const settingFrameworks =
      // new section
      section.id == null ||
      // one of them was empty and the other is not
      attributeFrameworksEmpty !== sectionFrameworksEmpty ||
      // Use lodash xor to check if the contents of the arrays are different, regardless of order
      (!attributeFrameworksEmpty && xor(attributes.frameworks, section.frameworks).length !== 0);
    if (!settingFrameworks) return;

    if (attributeFrameworksEmpty) {
      if ((await this.findDefault(attributes.type)) != null) {
        throw new BadRequestException(`The default About Section for type "${attributes.type}" is already set`);
      }
      return;
    }

    for (const framework of attributes.frameworks as FrameworkKey[]) {
      // Skip over frameworks that this section already covers - we only want to check new ones.
      if ((section.frameworks ?? []).includes(framework)) continue;

      if ((await this.findForFramework(attributes.type, framework)) != null) {
        throw new BadRequestException(
          `The About Section for type "${attributes.type}" and framework "${framework}" is already set`
        );
      }
    }
  }
}
