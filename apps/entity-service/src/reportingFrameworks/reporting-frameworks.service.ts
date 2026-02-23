import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import {
  Framework,
  Form,
  Nursery,
  NurseryReport,
  Permission,
  Project,
  ProjectReport,
  Role,
  RoleHasPermission,
  Site,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { kebabCase } from "lodash";
import { InferAttributes } from "sequelize";
import { Op } from "sequelize";
import {
  CreateReportingFrameworkAttributes,
  ReportingFrameworkDto,
  UpdateReportingFrameworkAttributes
} from "./dto/reporting-framework.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";

const ADMIN_SUPER_ROLE_NAME = "admin-super";
const GUARD_NAME = "api";

function frameworkPermissionName(frameworkName: string): string {
  return `framework-${kebabCase(frameworkName)}`;
}

export type FrameworkFormUuids = {
  projectFormUuid?: string | null;
  projectReportFormUuid?: string | null;
  siteFormUuid?: string | null;
  siteReportFormUuid?: string | null;
  nurseryFormUuid?: string | null;
  nurseryReportFormUuid?: string | null;
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
  { key: "nurseryReportFormUuid", model: NurseryReport.LARAVEL_TYPE }
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
    const slug = kebabCase(attributes.name) as FrameworkKey;
    const framework = await Framework.create({
      name: attributes.name,
      slug,
      accessCode: attributes.accessCode ?? null,
      projectFormUuid: attributes.projectFormUuid ?? null,
      projectReportFormUuid: attributes.projectReportFormUuid ?? null,
      siteFormUuid: attributes.siteFormUuid ?? null,
      siteReportFormUuid: attributes.siteReportFormUuid ?? null,
      nurseryFormUuid: attributes.nurseryFormUuid ?? null,
      nurseryReportFormUuid: attributes.nurseryReportFormUuid ?? null
    });
    await this.ensurePermissionForFramework(attributes.name);
    await this.syncFormsForFramework(slug, attributes);
    return framework;
  }

  async update(framework: Framework, attributes: UpdateReportingFrameworkAttributes): Promise<Framework> {
    const payload: Partial<InferAttributes<Framework>> = {};
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

    if (Object.keys(payload).length > 0) {
      await framework.update(payload);
    }
    const slug = framework.slug;
    if (slug != null) {
      await this.syncFormsForFramework(slug, {
        projectFormUuid: framework.projectFormUuid,
        projectReportFormUuid: framework.projectReportFormUuid,
        siteFormUuid: framework.siteFormUuid,
        siteReportFormUuid: framework.siteReportFormUuid,
        nurseryFormUuid: framework.nurseryFormUuid,
        nurseryReportFormUuid: framework.nurseryReportFormUuid
      });
    }
    return framework;
  }

  async delete(framework: Framework): Promise<void> {
    await this.removePermissionForFramework(framework.name);
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

    const detachWhere: { frameworkKey: string; uuid?: { [Op.notIn]: string[] } } = { frameworkKey: slug };
    if (currentUuids.length > 0) {
      detachWhere.uuid = { [Op.notIn]: currentUuids };
    }
    await Form.update({ frameworkKey: null, model: null }, { where: detachWhere });
  }

  /**
   * Ensure a permission exists for the framework (framework-{slug}) and is assigned to admin-super.
   * Call after creating a framework. Idempotent if permission and assignment already exist.
   *
   * Sync caveat: Permission.syncPermissions() treats permissions.ts as source of
   * truth and removes DB permissions not in config, and strips role assignments not in config. So
   * if sync is run after creating a new framework, this permission and its admin-super assignment
   * will be removed. To make new frameworks survive sync, add the permission to
   * libs/database/src/lib/constants/permissions.ts (PERMISSIONS and ROLES["admin-super"]) and run
   * sync once; thereafter sync will keep it.
   */
  async ensurePermissionForFramework(frameworkName: string): Promise<void> {
    const name = frameworkPermissionName(frameworkName);
    let permission = await Permission.findOne({ where: { name } });
    if (permission == null) {
      permission = await Permission.create({ name, guardName: GUARD_NAME });
    }

    const role = await Role.findOne({ where: { name: ADMIN_SUPER_ROLE_NAME } });
    if (role == null) return;

    const existing = await RoleHasPermission.findOne({
      where: { roleId: role.id, permissionId: permission.id }
    });
    if (existing == null) {
      await RoleHasPermission.create({ roleId: role.id, permissionId: permission.id });
    }
  }

  async removePermissionForFramework(frameworkName: string): Promise<void> {
    const name = frameworkPermissionName(frameworkName);
    const permission = await Permission.findOne({ where: { name } });
    if (permission == null) return;

    await RoleHasPermission.destroy({ where: { permissionId: permission.id } });
    await permission.destroy();
  }
}
