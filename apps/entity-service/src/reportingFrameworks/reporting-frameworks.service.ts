import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import {
  FinancialReport,
  Form,
  Framework,
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { Attributes, Op } from "sequelize";
import {
  CreateReportingFrameworkAttributes,
  ReportingFrameworkDto,
  UpdateReportingFrameworkAttributes
} from "./dto/reporting-framework.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { isNotNull } from "@terramatch-microservices/database/types/array";

export function reportingFrameworkSlugFromName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-");
}

export type FrameworkFormUuids = {
  projectFormUuid?: string | null;
  projectReportFormUuid?: string | null;
  siteFormUuid?: string | null;
  siteReportFormUuid?: string | null;
  nurseryFormUuid?: string | null;
  nurseryReportFormUuid?: string | null;
  financialReportFormUuid?: string | null;
};

const FRAMEWORK_FORM_MAP: ReadonlyArray<{
  key: keyof FrameworkFormUuids;
  model: string;
}> = [
  { key: "projectFormUuid", model: Project.LARAVEL_TYPE },
  { key: "projectReportFormUuid", model: ProjectReport.LARAVEL_TYPE },
  { key: "siteFormUuid", model: Site.LARAVEL_TYPE },
  { key: "siteReportFormUuid", model: SiteReport.LARAVEL_TYPE },
  { key: "nurseryFormUuid", model: Nursery.LARAVEL_TYPE },
  { key: "nurseryReportFormUuid", model: NurseryReport.LARAVEL_TYPE },
  { key: "financialReportFormUuid", model: FinancialReport.LARAVEL_TYPE }
];

@Injectable()
export class ReportingFrameworksService {
  private readonly logger = new Logger(ReportingFrameworksService.name);

  async findBySlug(slug: string): Promise<Framework> {
    const framework = await Framework.findOne({ where: { slug } });
    if (framework == null) {
      throw new NotFoundException("Reporting framework not found");
    }
    return framework;
  }

  async findByUuid(uuid: string): Promise<Framework> {
    const framework = await Framework.findOne({ where: { uuid } });
    if (framework == null) {
      throw new NotFoundException("Reporting framework not found");
    }
    return framework;
  }

  async findAll(): Promise<Framework[]> {
    return await Framework.findAll();
  }

  /**
   * Create a reporting framework. Slug is derived from name; permission and form links are set up.
   * Caller must have added the permission to permissions.ts and run sync first for it to survive sync.
   */
  async create(attributes: CreateReportingFrameworkAttributes): Promise<Framework> {
    await this.checkFormUuids(attributes);
    const slug = reportingFrameworkSlugFromName(attributes.name) as FrameworkKey;
    const framework = await Framework.create({
      name: attributes.name,
      slug,
      accessCode: attributes.accessCode ?? slug,
      projectFormUuid: attributes.projectFormUuid ?? null,
      projectReportFormUuid: attributes.projectReportFormUuid ?? null,
      siteFormUuid: attributes.siteFormUuid ?? null,
      siteReportFormUuid: attributes.siteReportFormUuid ?? null,
      nurseryFormUuid: attributes.nurseryFormUuid ?? null,
      nurseryReportFormUuid: attributes.nurseryReportFormUuid ?? null,
      financialReportFormUuid: attributes.financialReportFormUuid ?? null
    });
    await this.syncFormsForFramework(slug, attributes);
    return framework;
  }

  async update(framework: Framework, attributes: UpdateReportingFrameworkAttributes): Promise<Framework> {
    await this.checkFormUuids(attributes, framework.slug as FrameworkKey);
    const payload: Partial<Attributes<Framework>> = {};
    if (attributes.name != null && attributes.name !== "") payload.name = attributes.name;
    if (attributes.accessCode !== undefined) payload.accessCode = attributes.accessCode ?? null;
    if (attributes.projectFormUuid !== undefined) payload.projectFormUuid = attributes.projectFormUuid ?? null;
    if (attributes.projectReportFormUuid !== undefined)
      payload.projectReportFormUuid = attributes.projectReportFormUuid ?? null;
    if (attributes.siteFormUuid !== undefined) payload.siteFormUuid = attributes.siteFormUuid ?? null;
    if (attributes.siteReportFormUuid !== undefined) payload.siteReportFormUuid = attributes.siteReportFormUuid ?? null;
    if (attributes.nurseryFormUuid !== undefined) payload.nurseryFormUuid = attributes.nurseryFormUuid ?? null;
    if (attributes.nurseryReportFormUuid !== undefined)
      payload.nurseryReportFormUuid = attributes.nurseryReportFormUuid ?? null;
    if (attributes.financialReportFormUuid !== undefined)
      payload.financialReportFormUuid = attributes.financialReportFormUuid ?? null;
    if (Object.keys(payload).length > 0) {
      await framework.update(payload);
    }
    const slug = framework.slug;
    if (slug != null) {
      await this.syncFormsForFramework(slug, framework);
    }
    return framework;
  }

  /**
   * Delete a reporting framework (form links cleared, framework record removed).
   * Permissions are not removed here: permissions.ts is the source of truth. When retiring a
   * framework, remove its permission from permissions.ts and run Permission.syncPermissions() in
   * the REPL to clean up the DB.
   */
  async delete(framework: Framework): Promise<void> {
    for (const { key } of FRAMEWORK_FORM_MAP) {
      const uuid = framework[key];
      if (uuid != null && uuid !== "") {
        await Form.update({ frameworkKey: null, model: null }, { where: { uuid } });
      }
    }
    await framework.destroy();
    this.logger.log(`Removed ${framework.name} reporting framework ${framework.uuid}.`);
  }

  async calculateProjectsCount(frameworkSlug: string | null): Promise<number> {
    if (frameworkSlug == null) return 0;
    return await Project.count({ where: { frameworkKey: frameworkSlug } });
  }

  async addDto(document: DocumentBuilder, framework: Framework): Promise<DocumentBuilder> {
    const totalProjectsCount = await this.calculateProjectsCount(framework.slug);
    const resourceId = framework.slug ?? framework.uuid;
    document.addData(resourceId, new ReportingFrameworkDto(framework, { totalProjectsCount }));
    return document;
  }

  async addDtos(document: DocumentBuilder, frameworks: Framework[]): Promise<DocumentBuilder> {
    for (const framework of frameworks) {
      const totalProjectsCount = await this.calculateProjectsCount(framework.slug);
      const resourceId = framework.slug ?? framework.uuid;
      document.addData(resourceId, new ReportingFrameworkDto(framework, { totalProjectsCount }));
    }
    return document;
  }

  async syncFormsForFramework(slug: string, formUuids: FrameworkFormUuids): Promise<void> {
    const currentUuids: string[] = [];
    const frameworkKey = slug as FrameworkKey;

    for (const { key, model } of FRAMEWORK_FORM_MAP) {
      const uuid = formUuids[key];
      if (uuid != null && uuid !== "") {
        currentUuids.push(uuid);
        await Form.update({ frameworkKey, model }, { where: { uuid } });
      }
    }

    const uuidsClause = currentUuids.length > 0 ? { uuid: { [Op.notIn]: currentUuids } } : {};
    await Form.update({ frameworkKey: null, model: null }, { where: { frameworkKey: slug, ...uuidsClause } });
  }

  private async checkFormUuids(
    {
      projectFormUuid,
      projectReportFormUuid,
      siteFormUuid,
      siteReportFormUuid,
      nurseryFormUuid,
      nurseryReportFormUuid,
      financialReportFormUuid
    }: FrameworkFormUuids,
    frameworkKey?: FrameworkKey
  ): Promise<void> {
    const uuids = [
      projectFormUuid,
      projectReportFormUuid,
      siteFormUuid,
      siteReportFormUuid,
      nurseryFormUuid,
      nurseryReportFormUuid,
      financialReportFormUuid
    ].filter(isNotNull);
    const frameworkKeyClause =
      frameworkKey == null
        ? { frameworkKey: { [Op.not]: null } }
        : { frameworkKey: { [Op.and]: [{ [Op.not]: null }, { [Op.not]: frameworkKey }] } };
    const inUse = await Form.findAll({
      where: { uuid: { [Op.in]: uuids }, ...frameworkKeyClause },
      attributes: ["uuid"]
    });
    if (inUse.length === 0) return;

    const formNameMapping = {
      [projectFormUuid ?? ""]: "Project",
      [projectReportFormUuid ?? ""]: "Project Report",
      [siteFormUuid ?? ""]: "Site",
      [siteReportFormUuid ?? ""]: "Site Report",
      [nurseryFormUuid ?? ""]: "Nursery",
      [nurseryReportFormUuid ?? ""]: "Nursery Report",
      [financialReportFormUuid ?? ""]: "Financial Report"
    };
    const inUseForms = inUse.map(({ uuid }) => formNameMapping[uuid] ?? undefined).filter(isNotNull);
    throw new BadRequestException(
      `The following forms are already in use in another framework: ${inUseForms.join(", ")}.`
    );
  }
}
