import { EmailSender } from "./email-sender";
import { SpecificEntityData } from "./email.processor";
import { ENTITY_MODELS, EntityType } from "@terramatch-microservices/database/constants/entities";
import { EmailService } from "./email.service";
import { Dictionary, groupBy } from "lodash";
import { Nursery, Project, ProjectReport, ProjectUser, Site, User } from "@terramatch-microservices/database/entities";
import { TMLogger } from "../util/tm-logger";
import { ModelCtor } from "sequelize-typescript";
import { Includeable, Op } from "sequelize";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";

export class ProjectManagerEmail extends EmailSender {
  private readonly logger = new TMLogger(ProjectManagerEmail.name);

  private readonly type: EntityType;
  private readonly id: number;

  constructor({ type, id }: SpecificEntityData) {
    super();
    this.type = type;
    this.id = id;
  }

  async send(emailService: EmailService) {
    const result = await this.getEmailParameters();
    if (result == null) {
      // Unsupported entity type, NOOP.
      return;
    }
    const { keySuffix, i18nReplacements, link, projectId } = result;

    const i18nKeys = {
      subject: `project-manager${keySuffix}.subject`,
      title: `project-manager${keySuffix}.title`,
      body: `project-manager${keySuffix}.body`,
      cta: `project-manager${keySuffix}.cta`
    };
    const additionalValues = {
      link,
      transactional: "transactional"
    };

    // Group the users by locale and then send the email to each locale group.
    const users = await User.findAll({
      where: { id: { [Op.in]: ProjectUser.projectManagersSubquery(projectId), attributes: ["emailAddress", "locale"] } }
    });
    await Promise.all(
      Object.entries(groupBy(users, "locale")).map(([locale, users]) =>
        emailService.sendI18nTemplateEmail(
          users.map(({ emailAddress }) => emailAddress),
          locale as ValidLocale,
          i18nKeys,
          { i18nReplacements, additionalValues }
        )
      )
    );
  }

  private async getEmailParameters(): Promise<
    { keySuffix: string; i18nReplacements: Dictionary<string>; link: string; projectId: number } | undefined
  > {
    const entity = await this.getEntity();
    const project = entity instanceof Project ? entity : entity?.project;
    if (entity == null || project == null) {
      this.logger.error(`Could not find entity or project [type=${this.type}, id=${this.id}]`);
      return undefined;
    }

    const entityTypeName = this.type === "projectReports" ? "Project" : entity.constructor.name;
    const i18nReplacements: Dictionary<string> = {
      "{projectName}": project.name ?? "",
      "{entityTypeName}": entityTypeName
    };
    if (entity instanceof Site || entity instanceof Nursery) {
      i18nReplacements["{entityName}"] = entity.name ?? "";
    }

    const adminResource = entityTypeName === "Project" ? "projects" : entityTypeName === "Site" ? "sites" : "nurseries";
    const adminUuid = entityTypeName === "Project" ? project.uuid : entity.uuid;
    return {
      keySuffix: `-${entityTypeName.toLowerCase()}`,
      i18nReplacements,
      link: `admin#/${adminResource}/${adminUuid}/show`,
      projectId: project.id
    };
  }

  private async getEntity() {
    if (!["projects", "projectReports", "sites", "nurseries"].includes(this.type)) {
      return undefined;
    }

    const entityClass = ENTITY_MODELS[this.type] as ModelCtor<Project | ProjectReport | Site | Nursery>;
    const attributes = ["uuid", "name"];
    const include: Includeable[] = [];
    if (this.type !== "projects") {
      attributes.push("projectId");
      include.push({ association: "project", attributes: ["name", "uuid"] });
    }
    return await entityClass.findOne({ where: { id: this.id }, attributes, include });
  }
}
