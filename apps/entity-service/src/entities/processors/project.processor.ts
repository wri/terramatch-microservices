import { Aggregate, aggregateColumns, EntityProcessor } from "./entity-processor";
import {
  Application,
  Tracking,
  TrackingEntry,
  Form,
  FormSubmission,
  Media,
  Nursery,
  NurseryReport,
  Organisation,
  Project,
  ProjectPitch,
  ProjectReport,
  ProjectUser,
  Seeding,
  Site,
  SitePolygon,
  SiteReport,
  TreeSpecies,
  User
} from "@terramatch-microservices/database/entities";
import { Dictionary, groupBy, sumBy } from "lodash";
import { Attributes, CreationAttributes, Op, Sequelize } from "sequelize";
import { ANRDto, ProjectApplicationDto, ProjectFullDto, ProjectLightDto, ProjectMedia } from "../dto/project.dto";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ProcessableEntity } from "../entities.service";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { ProjectUpdateAttributes } from "../dto/entity-update.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { EntityDto } from "../dto/entity.dto";
import { mapLandscapeCodesToNames } from "@terramatch-microservices/database/constants";
import { ProjectCreateAttributes } from "../dto/entity-create.dto";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = [
  "country",
  "status",
  "updateRequestStatus",
  "frameworkKey",
  "projectUuid",
  "organisationUuid"
];

const ASSOCIATION_FIELD_MAP = {
  projectUuid: "uuid",
  organisationUuid: "$organisation.uuid$",
  organisationType: "$organisation.type$"
};

type SharedPitchAttributes = keyof Attributes<Project> & keyof Attributes<ProjectPitch>;
const PITCH_COPY_ATTRIBUTES: SharedPitchAttributes[] = [
  "environmentalGoals",
  "projectCountyDistrict",
  "descriptionOfProjectTimeline",
  "landholderCommEngage",
  "projPartnerInfo",
  "projSuccessRisks",
  "seedlingsSource",
  "pctEmployeesMen",
  "pctEmployeesWomen",
  "pctEmployees18To35",
  "pctEmployeesOlder35",
  "pctEmployeesMarginalised",
  "projBeneficiaries",
  "pctBeneficiariesMen",
  "pctBeneficiariesWomen",
  "pctBeneficiariesSmall",
  "pctBeneficiariesLarge",
  "pctBeneficiariesYouth",
  "pctBeneficiariesMarginalised",
  "detailedInterventionTypes",
  "projImpactFoodsec",
  "proposedGovPartners",
  "proposedNumNurseries",
  "projBoundary",
  "proposedGovPartners",
  "proposedNumNurseries",
  "states",
  "waterSource",
  "baselineBiodiversity",
  "goalTreesRestoredPlanting",
  "goalTreesRestoredAnr",
  "goalTreesRestoredDirectSeeding",
  "directSeedingSurvivalRate"
];

export class ProjectProcessor extends EntityProcessor<
  Project,
  ProjectLightDto,
  ProjectFullDto,
  ProjectUpdateAttributes,
  ProjectCreateAttributes
> {
  readonly LIGHT_DTO = ProjectLightDto;
  readonly FULL_DTO = ProjectFullDto;

  async findOne(uuid: string) {
    return await Project.findOne({
      where: { uuid },
      include: [
        { association: "organisation", attributes: ["uuid", "name", "type"] },
        {
          association: "application",
          include: [{ association: "fundingProgramme" }, { association: "formSubmissions" }]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const builder = await this.entitiesService.buildQuery(Project, query, [
      { association: "organisation", attributes: ["uuid", "name", "type"] }
    ]);

    if (query.sort?.field != null) {
      if (["name", "plantingStartDate", "country", "shortName"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    const permissions = await this.entitiesService.getPermissions();
    const frameworkPermissions = permissions
      .filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworkPermissions.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions.includes("manage-own")) {
      builder.where({ id: { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId) } });
    } else if (permissions.includes("projects-manage")) {
      builder.where({ id: { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId) } });
    }

    for (const term of SIMPLE_FILTERS) {
      const field = ASSOCIATION_FIELD_MAP[term] ?? term;
      if (query[term] != null) builder.where({ [field]: query[term] });
    }

    if (query.landscape != null && query.landscape.length > 0) {
      const landscapeNames = mapLandscapeCodesToNames(query.landscape);
      builder.where({ landscape: { [Op.in]: landscapeNames } });
    }

    if (query.organisationType != null && query.organisationType.length > 0) {
      builder.where({ "$organisation.type$": { [Op.in]: query.organisationType } });
    }

    if (query.cohort != null && query.cohort.length > 0) {
      const cohortConditions = query.cohort
        .map(cohort => `JSON_CONTAINS(cohort, ${Project.sql.escape(`"${cohort}"`)})`)
        .join(" OR ");
      builder.where(Sequelize.literal(`(${cohortConditions})`));
    }

    if (query.shortName != null) {
      builder.where({ shortName: query.shortName });
    }

    if (query.search != null || query.searchFilter != null) {
      builder.where({ name: { [Op.like]: `%${query.search ?? query.searchFilter}%` } });
    }

    if (query.plantingStatus != null) {
      builder.where({
        uuid: { [Op.in]: ProjectReport.projectUuidsForLatestApprovedPlantingStatus(query.plantingStatus) }
      });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async update(project: Project, update: ProjectUpdateAttributes) {
    if (update.isTest != null) {
      if (!(await this.entitiesService.isFrameworkAdmin(project))) {
        // Only framework admins can set the isTest flag.
        throw new UnauthorizedException();
      }

      project.isTest = update.isTest;
    }

    await super.update(project, update);
  }

  async processSideload(
    document: DocumentBuilder,
    model: Project,
    entity: ProcessableEntity,
    pageSize: number
  ): Promise<void> {
    if (!["sites", "nurseries"].includes(entity)) {
      throw new BadRequestException("Projects only support sideloading associated sites and nurseries");
    }
    const processor = this.entitiesService.createEntityProcessor(entity);
    await processor.addIndex(document, { page: { size: pageSize }, projectUuid: model.uuid }, true);
  }

  async getLightDto(project: Project, associateDto: EntityDto) {
    const projectId = project.id;
    const totalHectaresRestoredSum =
      (await SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(projectId)).sum("calcArea")) ?? 0;
    const lastReport = await this.getLastReport(projectId);
    const plantingStatus = lastReport?.plantingStatus ?? null;

    const dto = new ProjectLightDto(project, {
      totalHectaresRestoredSum,
      treesPlantedCount: 0,
      plantingStatus,
      ...associateDto
    });

    return {
      id: project.uuid,
      dto
    };
  }

  async getFullDto(project: Project) {
    const projectId = project.id;
    const approvedSitesQuery = Site.approvedIdsSubquery(projectId);
    const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery(approvedSitesQuery);

    const approvedSites = await Site.approved()
      .project(projectId)
      .findAll({ attributes: ["id", "name"] });

    const approvedSiteReports =
      approvedSites.length === 0
        ? ([] as unknown as Dictionary<SiteReport[]>)
        : groupBy(
            await SiteReport.approved()
              .sites(approvedSitesQuery)
              .findAll({ attributes: ["id", "siteId", "numTreesRegenerating"] }),
            "siteId"
          );

    const assistedNaturalRegenerationList: ANRDto[] = approvedSites.map(({ id, name }) => ({
      name: name ?? "",
      treeCount: sumBy(approvedSiteReports[id], "numTreesRegenerating") ?? 0
    }));
    const regeneratedTreesCount = sumBy(assistedNaturalRegenerationList, "treeCount");
    const treesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;
    const seedsPlantedCount = (await Seeding.visible().siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;
    const lastReport = await this.getLastReport(projectId);
    const lastReportSurvivalRate = await this.getLastReportSurvivalRate(projectId);
    const plantingStatus = lastReport?.plantingStatus ?? null;

    const dto = new ProjectFullDto(project, {
      ...(await this.getFeedback(project)),
      plantingStatus,
      lastReportedSurvivalRate: lastReportSurvivalRate?.pctSurvivalToDate ?? null,
      totalSites: approvedSites.length,
      totalNurseries: await Nursery.approved().project(projectId).count(),
      totalOverdueReports: await this.getTotalOverdueReports(project.id),
      totalProjectReports: await ProjectReport.project(projectId).count(),

      assistedNaturalRegenerationList,
      regeneratedTreesCount,
      treesPlantedCount,
      seedsPlantedCount,
      treesRestoredPpc:
        regeneratedTreesCount +
        (treesPlantedCount * ((project.survivalRate ?? 0) / 100) +
          (seedsPlantedCount * (project.directSeedingSurvivalRate ?? 0)) / 100),

      totalHectaresRestoredSum:
        (await SitePolygon.active().approved().sites(Site.approvedUuidsSubquery(projectId)).sum("calcArea")) ?? 0,

      workdayCount: await this.getWorkdayCount(project.id),
      selfReportedWorkdayCount: await this.getSelfReportedWorkdayCount(project.id),
      combinedWorkdayCount:
        (await this.getWorkdayCount(project.id, true)) + (await this.getSelfReportedWorkdayCount(project.id, true)),
      totalJobsCreated: await this.getTotalJobs(project.id),

      application: project.application == null ? null : populateDto(new ProjectApplicationDto(), project.application),

      ...(this.entitiesService.mapMediaCollection(
        await Media.for(project).findAll(),
        Project.MEDIA,
        "projects",
        project.uuid
      ) as ProjectMedia)
    });

    await this.entitiesService.removeHiddenValues(project, dto);

    return { id: project.uuid, dto };
  }

  protected async getWorkdayCount(projectId: number, useDemographicsCutoff = false) {
    const dueAfter = useDemographicsCutoff ? Tracking.DEMOGRAPHIC_COUNT_CUTOFF : undefined;

    const siteIds = Site.approvedIdsSubquery(projectId);
    const siteReportIds = SiteReport.approvedIdsSubquery(siteIds, { dueAfter });
    const siteReportWorkdays = Tracking.idsSubquery(siteReportIds, SiteReport.LARAVEL_TYPE, {
      domain: "demographics",
      type: Tracking.WORKDAYS_TYPE
    });
    const projectReportIds = ProjectReport.approvedIdsSubquery(projectId, { dueAfter });
    const projectReportWorkdays = Tracking.idsSubquery(projectReportIds, ProjectReport.LARAVEL_TYPE, {
      domain: "demographics",
      type: Tracking.WORKDAYS_TYPE
    });

    return (
      (await TrackingEntry.gender().sum("amount", {
        where: {
          trackingId: {
            [Op.or]: [{ [Op.in]: siteReportWorkdays }, { [Op.in]: projectReportWorkdays }]
          }
        }
      })) ?? 0
    );
  }

  protected async getSelfReportedWorkdayCount(projectId: number, useDemographicsCutoff = false) {
    let SR = SiteReport.approved().sites(Site.approvedIdsSubquery(projectId));
    let PR = ProjectReport.approved().project(projectId);
    if (useDemographicsCutoff) {
      PR = PR.dueBefore(Tracking.DEMOGRAPHIC_COUNT_CUTOFF);
      SR = SR.dueBefore(Tracking.DEMOGRAPHIC_COUNT_CUTOFF);
    }

    const aggregates = [
      { func: "SUM", attr: "workdaysPaid" },
      { func: "SUM", attr: "workdaysVolunteer" }
    ];
    const site = await aggregateColumns(SR, aggregates as Aggregate<SiteReport>[]);
    const project = await aggregateColumns(PR, aggregates as Aggregate<ProjectReport>[]);
    return (
      (site.workdaysPaid ?? 0) +
      (site.workdaysVolunteer ?? 0) +
      (project.workdaysPaid ?? 0) +
      (project.workdaysVolunteer ?? 0)
    );
  }

  protected async getTotalJobs(projectId: number) {
    return (
      (await TrackingEntry.gender().sum("amount", {
        where: {
          trackingId: {
            [Op.in]: Tracking.idsSubquery(ProjectReport.approvedIdsSubquery(projectId), ProjectReport.LARAVEL_TYPE, {
              domain: "demographics",
              type: Tracking.JOBS_TYPE
            })
          }
        }
      })) ?? 0
    );
  }

  protected async getTotalOverdueReports(projectId: number) {
    const countOpts = { where: { dueAt: { [Op.lt]: new Date() } } };
    const pTotal = await ProjectReport.incomplete().project(projectId).count(countOpts);
    const sTotal = await SiteReport.incomplete().sites(Site.approvedIdsSubquery(projectId)).count(countOpts);
    const nTotal = await NurseryReport.incomplete().nurseries(Nursery.approvedIdsSubquery(projectId)).count(countOpts);

    return pTotal + sTotal + nTotal;
  }

  protected async getLastReport(projectId: number) {
    return await ProjectReport.approved()
      .project(projectId)
      .lastReport()
      .findOne({ attributes: ["plantingStatus"] });
  }

  protected async getLastReportSurvivalRate(projectId: number) {
    return await ProjectReport.approved()
      .pctSurvivalToDate()
      .project(projectId)
      .lastReport()
      .findOne({ attributes: ["pctSurvivalToDate"] });
  }

  /* istanbul ignore next */
  async loadAssociationData(projectIds: number[]): Promise<Record<number, ProjectLightDto>> {
    const associationDtos: Record<number, ProjectLightDto> = {};
    const sites = await this.getSites(projectIds);

    if (sites.length === 0) {
      return associationDtos;
    }

    const siteIdToProjectId = new Map<number, number>();
    for (const site of sites) {
      siteIdToProjectId.set(site.id, site.projectId);
      if (associationDtos[site.projectId] !== undefined) {
        associationDtos[site.projectId] = {} as ProjectLightDto; // Initialize with default structure
      }
    }

    const approvedSiteReports = await this.getSiteReports(sites);

    if (approvedSiteReports.length === 0) {
      return associationDtos;
    }

    const siteReportIdToProjectId = new Map<number, number>();
    for (const report of approvedSiteReports) {
      const projectId = siteIdToProjectId.get(report.siteId) ?? null;
      if (projectId !== null) {
        siteReportIdToProjectId.set(report.id, projectId);
      }
    }
    const treeSpecies = await this.getTreeSpecies(approvedSiteReports);

    for (const species of treeSpecies) {
      const projectId = siteReportIdToProjectId.get(species.speciesableId);
      if (projectId !== undefined) {
        const dto = associationDtos[projectId] as ProjectLightDto;

        if (dto == null) {
          associationDtos[projectId] = { treesPlantedCount: species.amount } as ProjectLightDto;
        } else {
          dto.treesPlantedCount = (dto.treesPlantedCount ?? 0) + (species.amount ?? 0);
        }
      }
    }

    return associationDtos;
  }

  /* istanbul ignore next */
  private async getTreeSpecies(approvedSiteReports: SiteReport[]) {
    return await TreeSpecies.visible()
      .collection("tree-planted")
      .siteReports(approvedSiteReports.map(r => r.id))
      .findAll({
        attributes: ["speciesableId", [Sequelize.fn("SUM", Sequelize.col("amount")), "amount"]],
        group: ["speciesableId"],
        raw: true
      });
  }

  /* istanbul ignore next */
  private async getSiteReports(sites: Site[]) {
    return await SiteReport.findAll({
      where: { id: { [Op.in]: SiteReport.approvedIdsSubquery(sites.map(s => s.id)) } },
      attributes: ["id", "siteId"],
      raw: true
    });
  }

  /* istanbul ignore next */
  private async getSites(numericProjectIds: number[]) {
    return await Site.findAll({
      where: { id: { [Op.in]: Site.approvedIdsProjectsSubquery(numericProjectIds) } },
      attributes: ["id", "projectId"],
      raw: true
    });
  }

  async create({ applicationUuid, formUuid }: ProjectCreateAttributes) {
    const form = await Form.findOne({ where: { uuid: formUuid }, attributes: ["frameworkKey", "model"] });
    if (form?.frameworkKey == null || form?.model !== Project.LARAVEL_TYPE) {
      throw new BadRequestException(`Invalid form for project creation: ${formUuid}`);
    }

    const application =
      applicationUuid == null
        ? undefined
        : (await Application.findOne({ where: { uuid: applicationUuid } })) ?? undefined;
    if (application == null && applicationUuid != null) {
      throw new BadRequestException(`Invalid application for project creation: ${applicationUuid}`);
    }

    const organisation = await this.getProjectCreationOrg(application);
    const attributes: CreationAttributes<Project> = {
      frameworkKey: form.frameworkKey,
      organisationId: organisation.id,
      isTest: organisation.isTest
    };

    const pitch = application == null ? undefined : await ProjectPitch.application(application.id).findOne();
    if (application != null) {
      if (pitch == null) throw new BadRequestException(`No pitch found for application: ${applicationUuid}`);

      for (const attribute of PITCH_COPY_ATTRIBUTES) {
        attributes[attribute] = pitch[attribute];
      }

      // These attributes don't simply copy data from one record to the other with the same name.
      attributes.applicationId = application.id;
      attributes.name = pitch.projectName;
      attributes.boundaryGeojson = pitch.projBoundary;
      attributes.landUseTypes = pitch.landUseTypes ?? pitch.landSystems;
      attributes.restorationStrategy = pitch.restorationStrategy ?? pitch.treeRestorationPractices;
      attributes.country = pitch.projectCountry;
      attributes.plantingStartDate = pitch.expectedActiveRestorationStartDate;
      attributes.plantingEndDate = pitch.expectedActiveRestorationEndDate;
      attributes.description = pitch.descriptionOfProjectTimeline;
      attributes.history = pitch.currLandDegradation;
      attributes.objectives = pitch.projectObjectives;
      attributes.socioeconomicGoals = pitch.projImpactSocieconom;
      attributes.budget = pitch.projectBudget;
      attributes.jobsCreatedGoal = pitch.numJobsCreated;
      attributes.totalHectaresRestoredGoal = pitch.totalHectares;
      attributes.treesGrownGoal = pitch.totalTrees;
      attributes.landTenureProjectArea = pitch.landTenureProjArea;
      attributes.projImpactBiodiv = pitch.biodiversityImpact;
    }

    const project = await Project.create(attributes);

    if (pitch != null) {
      const treesToCreate: CreationAttributes<TreeSpecies>[] = [];
      for (const tree of await TreeSpecies.for(pitch).findAll()) {
        if (tree.hidden) continue;

        treesToCreate.push({
          speciesableType: Project.LARAVEL_TYPE,
          speciesableId: project.id,
          collection: tree.collection ?? "tree-planted",
          name: tree.name,
          taxonId: tree.taxonId,
          amount: tree.amount
        });
      }
      if (treesToCreate.length > 0) await TreeSpecies.bulkCreate(treesToCreate);

      const entriesToCreate: CreationAttributes<TrackingEntry>[] = [];
      const trackings = await Tracking.for(pitch).findAll();
      const entries = groupBy(
        await TrackingEntry.findAll({
          where: { trackingId: { [Op.in]: trackings.map(d => d.id) } }
        }),
        "trackingId"
      );
      for (const tracking of trackings) {
        if (tracking.hidden) continue;

        // There aren't many tracking types associated with each project / pitch, so this
        // initial creation list is short, and we can less awkwardly collect all the entries
        // to create if we create the trackings sequentially to get each id here.
        const projTracking = await Tracking.create({
          trackableType: Project.LARAVEL_TYPE,
          trackableId: project.id,
          domain: tracking.domain,
          type: tracking.type,
          collection: tracking.collection,
          description: tracking.description
        });
        for (const entry of entries[tracking.id] ?? []) {
          entriesToCreate.push({
            trackingId: projTracking.id,
            type: entry.type,
            subtype: entry.subtype,
            name: entry.name,
            amount: entry.amount
          });
        }
      }
      if (entriesToCreate.length > 0) await TrackingEntry.bulkCreate(entriesToCreate);

      const medias = await Media.for(pitch)
        .collection(["detailed_project_budget", "proof_of_land_tenure_mou"])
        .findAll();
      await Promise.all(medias.map(media => this.entitiesService.duplicateMedia(media, project)));
    }

    if (application != null) {
      const submission = await FormSubmission.application(application.id).findOne({
        order: [["id", "DESC"]],
        attributes: ["id"],
        include: [{ association: "user", attributes: ["id"] }]
      });
      const userIds = (await User.findAll({ where: { organisationId: organisation.id }, attributes: ["id"] })).map(
        ({ id }) => id
      );
      await ProjectUser.bulkCreate(
        userIds.map(userId => ({
          projectId: project.id,
          userId,
          status: "active",
          // All org users other than the one that submitted the application are monitoring partners. The
          // submitter is the project "owner"
          isMonitoring: userId !== submission?.user?.id
        }))
      );
    } else {
      await ProjectUser.create({ projectId: project.id, userId: this.entitiesService.userId, status: "active" });
    }

    // Load the full project with necessary associations.
    return (await this.findOne(project.uuid)) as Project;
  }

  private async getProjectCreationOrg(application: Application | undefined) {
    if (application == null) {
      const user = await User.findOne({
        where: { id: this.entitiesService.userId },
        attributes: [],
        include: [{ association: "organisation", attributes: ["id", "isTest"] }]
      });
      if (user?.organisation == null) {
        throw new BadRequestException("Current user does not have an organisation associated");
      }
      return user.organisation;
    } else {
      const organisation =
        application.organisationUuid == null
          ? undefined
          : await Organisation.findOne({ where: { uuid: application.organisationUuid }, attributes: ["id", "isTest"] });
      if (organisation == null) {
        throw new BadRequestException(`Invalid application for project creation: ${application.uuid}`);
      }
      return organisation;
    }
  }
}
