import {
  Demographic,
  DemographicEntry,
  Project,
  ProjectReport,
  Site,
  SitePolygon,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { groupBy, sumBy } from "lodash";
import { BadRequestException } from "@nestjs/common";
import { Op } from "sequelize";

export interface ProjectReportData {
  project: Project;
  siteBreakdown: SiteBreakdownData[];
  treeSpeciesSummary: TreeSpeciesDistributionData;
  employmentDemographics: EmploymentDemographicData;
  employment: {
    fullTime: number;
    partTime: number;
    volunteers: number;
  };
  beneficiaries: number;
  farmers: number;
  survivalRate: number;
}

interface SiteBreakdownData {
  name: string;
  hectareGoal: number;
  underRestoration: number;
  totalDisturbances: number;
  climatic: number;
  manmade: number;
}

interface TreeSpeciesDistributionData {
  projectId: number;
  sites: {
    siteId: number;
    siteUuid: string;
    siteName: string;
    species: {
      name: string;
      taxonId: string;
      amount: number;
    }[];
  }[];
}

interface EmploymentDemographicData {
  fullTimeJobs: DemographicBreakdown;
  partTimeJobs: DemographicBreakdown;
  volunteers: DemographicBreakdown;
}

interface DemographicBreakdown {
  total: number;
  male: number;
  female: number;
  youth: number;
  nonYouth: number;
}

interface BeneficiaryData {
  beneficiaries: number;
  farmers: number;
}

export class ProjectReportQueryBuilder {
  private projectId: number;
  private project: Project;

  constructor(private readonly projectUuid: string) {}

  /**
   * Fetches all data needed for a project report in an optimized manner to minimize database queries
   */
  async execute(): Promise<ProjectReportData> {
    // First fetch the project to get its ID and basic data
    this.project = await this.fetchProject();
    this.projectId = this.project.id;

    // Execute all queries in parallel for efficiency
    const [siteBreakdown, treeSpeciesSummary, employmentDemographics, beneficiariesData, survivalRate] =
      await Promise.all([
        this.fetchSiteBreakdownWithPolygons(),
        this.fetchTreeSpeciesDistribution(),
        this.fetchDemographicData(),
        this.fetchBeneficiariesData(),
        this.fetchMostRecentSurvivalRate()
      ]);

    return {
      project: this.project,
      siteBreakdown,
      treeSpeciesSummary,
      employmentDemographics,
      employment: {
        fullTime: employmentDemographics.fullTimeJobs?.total || 0,
        partTime: employmentDemographics.partTimeJobs?.total || 0,
        volunteers: employmentDemographics.volunteers?.total || 0
      },
      beneficiaries: beneficiariesData.beneficiaries,
      farmers: beneficiariesData.farmers,
      survivalRate
    };
  }

  private async fetchProject(): Promise<Project> {
    const project = await Project.findOne({
      where: { uuid: this.projectUuid },
      include: [{ association: "organisation", attributes: ["uuid", "name"] }]
    });

    if (!project) {
      throw new BadRequestException(`Project not found with UUID ${this.projectUuid}`);
    }

    return project;
  }

  private async fetchSiteBreakdownWithPolygons(): Promise<SiteBreakdownData[]> {
    // Fetch all approved sites and their UUIDs for this project in a single query
    const approvedSites = await Site.approved()
      .project(this.projectId)
      .findAll({
        attributes: ["id", "uuid", "name", "hectaresToRestoreGoal"],
        include: [
          {
            association: "reports",
            where: { status: "approved" },
            attributes: ["id"],
            include: [
              {
                association: "disturbances",
                attributes: ["id", "type"],
                required: false
              }
            ],
            required: false
          }
        ]
      });

    // Get all site UUIDs
    const siteUuids = approvedSites.map(site => site.uuid);

    // Fetch all polygon areas for these sites in a single query
    const polygonAreas =
      siteUuids.length > 0
        ? await SitePolygon.active()
            .approved()
            .findAll({
              where: {
                siteUuid: { [Op.in]: siteUuids }
              },
              attributes: ["siteUuid", "calcArea"]
            })
        : [];

    // Group polygon areas by site UUID for easy lookup
    const areasBySite = groupBy(polygonAreas, "siteUuid");

    // Map sites to the return format with polygon data included
    return approvedSites.map(site => {
      const disturbances = site.reports?.flatMap(report => report.disturbances ?? []) ?? [];
      const sitePolygons = areasBySite[site.uuid] || [];

      return {
        name: site.name,
        hectareGoal: site.hectaresToRestoreGoal || 0,
        underRestoration: Number(sumBy(sitePolygons, "calcArea").toFixed(2)),
        totalDisturbances: disturbances.length,
        climatic: disturbances.filter(d => d.type === "climatic").length,
        manmade: disturbances.filter(d => d.type === "manmade").length
      };
    });
  }

  private async fetchTreeSpeciesDistribution(): Promise<TreeSpeciesDistributionData> {
    const sites = await Site.approved()
      .project(this.projectId)
      .findAll({
        attributes: ["id", "uuid", "name"]
      });

    const siteIds = sites.map(site => site.id);

    const siteReportIds = await SiteReport.approved()
      .sites(siteIds)
      .findAll({
        attributes: ["id", "siteId"]
      });

    const treeSpeciesEntries = await TreeSpecies.visible()
      .collection("tree-planted")
      .siteReports(siteReportIds.map(report => report.id))
      .findAll({
        attributes: ["name", "taxonId", "amount", "speciesableId"],
        raw: true
      });

    const siteReportMap = new Map(siteReportIds.map(report => [report.id, report.siteId]));
    const entriesBySite = groupBy(treeSpeciesEntries, entry => siteReportMap.get(entry.speciesableId));
    const projectTreeSpecies = await TreeSpecies.findAll({
      where: {
        speciesableType: Project.LARAVEL_TYPE,
        speciesableId: this.projectId,
        hidden: false
      },
      attributes: ["name", "amount"]
    });

    const projectSpeciesGoals = new Map();
    projectTreeSpecies.forEach(species => {
      if (species.name && species.amount) {
        projectSpeciesGoals.set(species.name, species.amount);
      }
    });

    // Prepare the site data
    const siteDistribution = sites.map(site => {
      const siteEntries = entriesBySite[site.id] || [];

      // Aggregate species data for this site
      const speciesBySite = new Map();
      siteEntries.forEach(entry => {
        const key = entry.name;
        if (!speciesBySite.has(key)) {
          speciesBySite.set(key, {
            name: entry.name,
            taxonId: entry.taxonId,
            amount: 0
          });
        }
        speciesBySite.get(key).amount += entry.amount;
      });

      return {
        siteId: site.id,
        siteUuid: site.uuid,
        siteName: site.name,
        species: Array.from(speciesBySite.values())
      };
    });

    return {
      projectId: this.projectId,
      sites: siteDistribution
    };
  }

  private async fetchDemographicData(): Promise<EmploymentDemographicData> {
    // Get all approved project report IDs in one query
    const projectReportIds = await ProjectReport.approved()
      .project(this.projectId)
      .findAll({
        attributes: ["id"]
      })
      .then(reports => reports.map(r => r.id));

    if (projectReportIds.length === 0) {
      return {
        fullTimeJobs: { total: 0, male: 0, female: 0, youth: 0, nonYouth: 0 },
        partTimeJobs: { total: 0, male: 0, female: 0, youth: 0, nonYouth: 0 },
        volunteers: { total: 0, male: 0, female: 0, youth: 0, nonYouth: 0 }
      };
    }

    // Get all demographics in one query
    const demographics = await Demographic.findAll({
      where: {
        demographicalId: {
          [Op.in]: projectReportIds
        },
        demographicalType: ProjectReport.LARAVEL_TYPE,
        type: {
          [Op.in]: [Demographic.JOBS_TYPE, Demographic.VOLUNTEERS_TYPE]
        },
        hidden: false
      },
      attributes: ["id", "type", "collection"]
    });

    // Separate demographics by type
    const fullTimeDemographicIds = demographics
      .filter(d => d.type === Demographic.JOBS_TYPE && d.collection === "full-time")
      .map(d => d.id);

    const partTimeDemographicIds = demographics
      .filter(d => d.type === Demographic.JOBS_TYPE && d.collection === "part-time")
      .map(d => d.id);

    const volunteersDemographicIds = demographics.filter(d => d.type === Demographic.VOLUNTEERS_TYPE).map(d => d.id);

    // Get all demographic entries in one query
    const allDemographicIds = [...fullTimeDemographicIds, ...partTimeDemographicIds, ...volunteersDemographicIds];

    if (allDemographicIds.length === 0) {
      return {
        fullTimeJobs: { total: 0, male: 0, female: 0, youth: 0, nonYouth: 0 },
        partTimeJobs: { total: 0, male: 0, female: 0, youth: 0, nonYouth: 0 },
        volunteers: { total: 0, male: 0, female: 0, youth: 0, nonYouth: 0 }
      };
    }

    const allEntries = await DemographicEntry.findAll({
      where: {
        demographicId: {
          [Op.in]: allDemographicIds
        }
      }
    });

    // Process each type of demographic
    const processDemographicData = (demographicIds: number[]) => {
      const entries = allEntries.filter(entry => demographicIds.includes(entry.demographicId));

      const genderEntries = entries.filter(entry => entry.type === "gender");
      const ageEntries = entries.filter(entry => entry.type === "age");

      const total = genderEntries.reduce((sum, entry) => sum + entry.amount, 0);
      const male = genderEntries
        .filter(entry => entry.subtype === "male")
        .reduce((sum, entry) => sum + entry.amount, 0);
      const female = genderEntries
        .filter(entry => entry.subtype === "female")
        .reduce((sum, entry) => sum + entry.amount, 0);
      const youth = ageEntries.filter(entry => entry.subtype === "youth").reduce((sum, entry) => sum + entry.amount, 0);
      const nonYouth = total - youth;

      return { total, male, female, youth, nonYouth };
    };

    return {
      fullTimeJobs: processDemographicData(fullTimeDemographicIds),
      partTimeJobs: processDemographicData(partTimeDemographicIds),
      volunteers: processDemographicData(volunteersDemographicIds)
    };
  }

  private async fetchBeneficiariesData(): Promise<BeneficiaryData> {
    // Get approved project report IDs in one query
    const projectReportIds = await ProjectReport.approved()
      .project(this.projectId)
      .findAll({
        attributes: ["id"]
      })
      .then(reports => reports.map(r => r.id));

    if (projectReportIds.length === 0) {
      return { beneficiaries: 0, farmers: 0 };
    }

    // Get all beneficiary demographics in one query
    const beneficiariesDemographics = await Demographic.findAll({
      where: {
        demographicalId: {
          [Op.in]: projectReportIds
        },
        demographicalType: ProjectReport.LARAVEL_TYPE,
        type: Demographic.ALL_BENEFICIARIES_TYPE,
        collection: "all",
        hidden: false
      },
      attributes: ["id"]
    });

    const beneficiariesDemographicIds = beneficiariesDemographics.map(r => r.id);

    // Get all entries in one query
    const [beneficiariesEntries, smallholdersEntries] = await Promise.all([
      DemographicEntry.findAll({
        where: {
          demographicId: {
            [Op.in]: beneficiariesDemographicIds
          },
          type: "gender"
        }
      }),
      DemographicEntry.findAll({
        where: {
          demographicId: {
            [Op.in]: beneficiariesDemographicIds
          },
          type: "farmer",
          subtype: "smallholder"
        }
      })
    ]);

    const totalBeneficiaries = beneficiariesEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const totalSmallholders = smallholdersEntries.reduce((sum, entry) => sum + entry.amount, 0);

    return {
      beneficiaries: totalBeneficiaries,
      farmers: totalSmallholders
    };
  }

  private async fetchMostRecentSurvivalRate(): Promise<number> {
    const mostRecentReport = await ProjectReport.approved()
      .project(this.projectId)
      .findOne({
        where: {
          pctSurvivalToDate: {
            [Op.ne]: null
          }
        },
        order: [["dueAt", "DESC"]],
        attributes: ["pctSurvivalToDate"]
      });

    return mostRecentReport?.pctSurvivalToDate ?? 0;
  }
}
