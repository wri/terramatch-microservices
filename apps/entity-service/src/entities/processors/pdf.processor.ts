import { NotImplementedException } from "@nestjs/common";
import * as puppeteer from "puppeteer";
import {
  Demographic,
  DemographicEntry,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { EntitiesService } from "../entities.service";
import { col, fn, Op } from "sequelize";
import { SiteFullDto } from "../dto/site.dto";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";

@Processor("pdfs")
export class PdfProcessor extends WorkerHost {
  private readonly logger = new TMLogger(PdfProcessor.name);

  constructor(private readonly entitiesService: EntitiesService) {
    super();
  }

  async process(job: Job) {
    const { name, data } = job;
    if (name !== "generateProjectPdf") throw new NotImplementedException(`Unknown job type: ${name}`);

    this.logger.log(`Starting generation process [${data}]`);
    const buffer = await this.generateProjectPdf(data as string);
    this.logger.log(`Generated PDF [${data}, ${buffer.length}]`);
  }

  async generateProjectPdf(uuid: string): Promise<Buffer> {
    const projectProcessor = this.entitiesService.createEntityProcessor<Project>("projects");

    const project = await projectProcessor.findOne(uuid);
    if (!project) {
      throw new Error("Project not found");
    }
    // await this.entitiesService.authorize("read", project);

    const { dto: projectData } = await projectProcessor.getFullDto(project);
    const additionalData = await this.getAdditionalReportData(project.id);
    this.logger.log(`Adding html content [${uuid}]`);
    const htmlContent = await this.generateHtmlTemplate(projectData, additionalData);
    this.logger.log(`Html content generated, launching Puppeteer [${uuid}]`);

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    this.logger.log(`Setting content [${uuid}]`);
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    this.logger.log(`Generating PDF [${uuid}]`);
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" }
    });

    await browser.close();
    this.logger.log(`Returning PDF buffer [${uuid}]}`);
    return Buffer.from(pdfBuffer);
  }

  private async getAdditionalReportData(projectId: number) {
    const sites = await this.getSiteBreakdown(projectId);
    const treeSpeciesData = await this.getTreeSpeciesDistribution(projectId);
    const siteNames = sites.map(site => site.name);

    const demographicData = await this.getDemographicData(projectId);
    const beneficiariesData = await this.getBeneficiariesData(projectId);
    const survivalRate = await this.getMostRecentSurvivalRate(projectId);

    return {
      sites,
      siteNames,
      treeSpeciesSummary: treeSpeciesData,
      employmentDemographics: demographicData,
      employment: {
        fullTime: demographicData.fullTimeJobs?.total || 0,
        partTime: demographicData.partTimeJobs?.total || 0,
        volunteers: demographicData.volunteers?.total || 0
      },
      beneficiaries: beneficiariesData.beneficiaries,
      farmers: beneficiariesData.farmers,
      survivalRate
    };
  }

  private async getSiteBreakdown(projectId: number) {
    try {
      const approvedSites = await Site.approved().project(projectId).findAll();
      const siteProcessor = this.entitiesService.createEntityProcessor<Site>("sites");
      const siteDataPromises = approvedSites.map(async site => {
        const { dto } = await siteProcessor.getFullDto(site);
        const siteFullDto = dto as SiteFullDto;

        const siteReports = await SiteReport.approved().sites([site.id]).findAll();

        const disturbancePromises = siteReports.map(async report => {
          await report.loadDisturbances();
          return report.disturbances || [];
        });

        const allDisturbances = (await Promise.all(disturbancePromises)).flat();

        const totalDisturbances = allDisturbances.length;
        const climaticDisturbances = allDisturbances.filter(d => d.type === "climatic").length;
        const manmadeDisturbances = allDisturbances.filter(d => d.type === "manmade").length;

        return {
          name: siteFullDto.name,
          hectareGoal: siteFullDto.hectaresToRestoreGoal,
          underRestoration: Number((siteFullDto.totalHectaresRestoredSum ?? 0).toFixed(2)),
          totalDisturbances,
          climatic: climaticDisturbances,
          manmade: manmadeDisturbances
        };
      });

      return await Promise.all(siteDataPromises);
    } catch (error) {
      console.error("Error fetching site breakdown:", error);
      return [];
    }
  }

  private async getTreeSpeciesDistribution(projectId: number) {
    try {
      const sites = await Site.approved()
        .project(projectId)
        .findAll({
          attributes: ["id", "uuid", "name"]
        });

      const siteDistribution = [];

      for (const site of sites) {
        const siteReportIds = SiteReport.approvedIdsSubquery([site.id]);

        const treeSpeciesEntries = await TreeSpecies.visible()
          .collection("tree-planted")
          .siteReports(siteReportIds)
          .findAll({
            attributes: ["name", "taxonId", [fn("SUM", col("amount")), "amount"]],
            group: ["name", "taxonId"],
            raw: true
          });

        const speciesList = treeSpeciesEntries.map(entry => ({
          name: entry.name,
          taxonId: entry.taxonId,
          amount: parseInt(entry.amount as unknown as string, 10)
        }));

        siteDistribution.push({
          siteId: site.id,
          siteUuid: site.uuid,
          siteName: site.name,
          species: speciesList
        });
      }

      // Add the projectId to the return data so we don't need to look it up again
      return {
        projectId,
        sites: siteDistribution
      };
    } catch (error) {
      console.error("Error fetching tree species distribution:", error);
      return {
        projectId: null,
        sites: []
      };
    }
  }

  private async getDemographicData(projectId: number) {
    try {
      const projectReportIds = ProjectReport.approvedIdsSubquery(projectId);

      const fullTimeDemographicIds = await Demographic.findAll({
        where: {
          demographicalId: {
            [Op.in]: projectReportIds
          },
          demographicalType: ProjectReport.LARAVEL_TYPE,
          type: Demographic.JOBS_TYPE,
          collection: "full-time",
          hidden: false
        },
        attributes: ["id"],
        raw: true
      }).then(results => results.map(r => r.id));

      const partTimeDemographicIds = await Demographic.findAll({
        where: {
          demographicalId: {
            [Op.in]: projectReportIds
          },
          demographicalType: ProjectReport.LARAVEL_TYPE,
          type: Demographic.JOBS_TYPE,
          collection: "part-time",
          hidden: false
        },
        attributes: ["id"],
        raw: true
      }).then(results => results.map(r => r.id));

      const volunteersDemographicIds = await Demographic.findAll({
        where: {
          demographicalId: {
            [Op.in]: projectReportIds
          },
          demographicalType: ProjectReport.LARAVEL_TYPE,
          type: Demographic.VOLUNTEERS_TYPE,
          hidden: false
        },
        attributes: ["id"],
        raw: true
      }).then(results => results.map(r => r.id));

      const getDemographicData = async (demographicIds: number[], type: string) => {
        const genderEntries = await DemographicEntry.findAll({
          where: {
            demographicId: {
              [Op.in]: demographicIds
            },
            type: "gender"
          },
          raw: true
        });

        const ageEntries = await DemographicEntry.findAll({
          where: {
            demographicId: {
              [Op.in]: demographicIds
            },
            type: "age"
          },
          raw: true
        });

        const total = genderEntries.reduce((sum, entry) => sum + entry.amount, 0);

        const male = genderEntries
          .filter(entry => entry.subtype === "male")
          .reduce((sum, entry) => sum + entry.amount, 0);

        const female = genderEntries
          .filter(entry => entry.subtype === "female")
          .reduce((sum, entry) => sum + entry.amount, 0);

        const youth = ageEntries
          .filter(entry => entry.subtype === "youth")
          .reduce((sum, entry) => sum + entry.amount, 0);
        const nonYouth = total - youth;
        return {
          total,
          male,
          female,
          youth,
          nonYouth
        };
      };

      const fullTimeJobs = await getDemographicData(fullTimeDemographicIds, "full-time");
      const partTimeJobs = await getDemographicData(partTimeDemographicIds, "part-time");
      const volunteers = await getDemographicData(volunteersDemographicIds, "volunteers");

      return {
        fullTimeJobs,
        partTimeJobs,
        volunteers
      };
    } catch (error) {
      console.error("Error fetching demographic data:", error);
      return {
        fullTimeJobs: { total: 0, male: 0, female: 0, youth: 0, nonYouth: 0 },
        partTimeJobs: { total: 0, male: 0, female: 0, youth: 0, nonYouth: 0 },
        volunteers: { total: 0, male: 0, female: 0, youth: 0, nonYouth: 0 }
      };
    }
  }

  private async getBeneficiariesData(projectId: number) {
    try {
      const projectReportIds = ProjectReport.approvedIdsSubquery(projectId);

      const beneficiariesDemographicIds = await Demographic.findAll({
        where: {
          demographicalId: {
            [Op.in]: projectReportIds
          },
          demographicalType: ProjectReport.LARAVEL_TYPE,
          type: Demographic.ALL_BENEFICIARIES_TYPE,
          collection: "all",
          hidden: false
        },
        attributes: ["id"],
        raw: true
      }).then(results => results.map(r => r.id));

      const smallholdersDemographicIds = await Demographic.findAll({
        where: {
          demographicalId: {
            [Op.in]: projectReportIds
          },
          demographicalType: ProjectReport.LARAVEL_TYPE,
          type: Demographic.ALL_BENEFICIARIES_TYPE,
          collection: "all",
          hidden: false
        },
        attributes: ["id"],
        raw: true
      }).then(results => results.map(r => r.id));

      const beneficiariesEntries = await DemographicEntry.findAll({
        where: {
          demographicId: {
            [Op.in]: beneficiariesDemographicIds
          },
          type: "gender"
        },
        raw: true
      });

      const smallholdersEntries = await DemographicEntry.findAll({
        where: {
          demographicId: {
            [Op.in]: smallholdersDemographicIds
          },
          type: "farmer",
          subtype: "smallholder"
        },
        raw: true
      });

      const totalBeneficiaries = beneficiariesEntries.reduce((sum, entry) => sum + entry.amount, 0);
      const totalSmallholders = smallholdersEntries.reduce((sum, entry) => sum + entry.amount, 0);

      return {
        beneficiaries: totalBeneficiaries,
        farmers: totalSmallholders
      };
    } catch (error) {
      console.error("Error fetching beneficiaries data:", error);
      return {
        beneficiaries: 0,
        farmers: 0
      };
    }
  }

  private async getMostRecentSurvivalRate(projectId: number) {
    try {
      const mostRecentReport = await ProjectReport.approved()
        .project(projectId)
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
    } catch (error) {
      console.error("Error fetching most recent survival rate:", error);
      return 0;
    }
  }

  private async generateHtmlTemplate(projectData, additionalData) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Project Report: ${projectData.name}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #333;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid #eeeeee;
      padding-bottom: 10px;
    }
    .header h1 {
      font-size: 24px;
      margin: 0;
    }
    .header p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .section {
      margin-bottom: 30px;
      flex: 1;
      min-width: 0;
    }
    .section-title {
      background-color: #f2f2f2;
      padding: 8px 12px;
      margin-bottom: 12px;
      border-radius: 3px;
      font-size: 16px;
      margin-top: 0;
    }
    .row {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 14px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: normal;
    }
    .info-table th {
      width: 40%;
    }
    .chart {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      margin: 20px 0;
    }
    .progress-ring {
      text-align: center;
      position: relative;
    }
    .progress-ring strong {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .progress-ring small {
      display: block;
      font-size: 12px;
      color: #666;
      margin-top: 8px;
    }
    .progress-bar-container {
      background: #e0e0e0;
      width: 100%;
      height: 10px;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      border-radius: 4px;
      background: #42a5f5;
    }
    .footer {
      margin-top: 30px;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .page-break {
      page-break-after: always;
      height: 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Report Generation</h1>
    <div style="text-align: right; font-size: 12px;">
      <div>View more reports online at <a href="https://terramatch.org">terramatch.org</a></div>
      <div>Printed on ${new Date().toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })}</div>
    </div>
  </div>

  <div class="row">
    <div class="section">
      <h2 class="section-title">General</h2>
      <table class="info-table">
        <tr>
          <th>Organization Name</th>
          <td>${projectData.organisationName || "-"}</td>
        </tr>
        <tr>
          <th>Project name</th>
          <td>${projectData.name || "-"}</td>
        </tr>
        <tr>
          <th>Number of sites</th>
          <td>${projectData.totalSites || 0}</td>
        </tr>
        <tr>
          <th>Most recent survival rate</th>
          <td>${additionalData.survivalRate}%</td>
        </tr>
        <tr>
          <th>Total direct beneficiaries</th>
          <td>${additionalData.beneficiaries.toLocaleString() || 0}</td>
        </tr>
        <tr>
          <th>Total smallholder farmers engaged</th>
          <td>${additionalData.farmers.toLocaleString() || 0}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">Project and Goals</h2>
      <div class="chart">
        ${this.generateProgressRing(
          "TREES PLANTED",
          Math.round((projectData.treesPlantedCount / projectData.treesGrownGoal) * 100),
          `${projectData.treesPlantedCount?.toLocaleString() || 0} of ${
            projectData.treesGrownGoal?.toLocaleString() || 0
          }`,
          "#26A9E0"
        )}
        ${this.generateProgressRing(
          "HECTARES RESTORED",
          Math.round((projectData.totalHectaresRestoredSum / projectData.totalHectaresRestoredGoal) * 100),
          `${projectData.totalHectaresRestoredSum?.toFixed(1).toLocaleString() || 0} of ${
            projectData.totalHectaresRestoredGoal?.toLocaleString() || 0
          } ha`,
          "#26A9E0"
        )}
        ${this.generateProgressRing(
          "JOBS CREATED",
          Math.round(
            (additionalData.employment.partTime /
              (additionalData.employment.fullTime + additionalData.employment.partTime)) *
              100
          ),
          `${additionalData.employment.fullTime} Full-time<br>${additionalData.employment.partTime} Part-time`,
          "#26A9E0",
          true
        )}
      </div>
    </div>
  </div>

  <div class="row">
    <div class="section">
      <h2 class="section-title">Employment Opportunities Created</h2>
      <div style="display: flex; align-items: center;">
        ${this.generateEmploymentPieChart(additionalData.employment)}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Employment by Demographics</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Total</th>
            <th>Male</th>
            <th>Female</th>
            <th>Youth</th>
            <th>Non-Youth</th>
          </tr>
        </thead>
        <tbody>
          ${["Full Time Jobs", "Part Time Jobs", "Volunteers"]
            .map((type, index) => {
              const dataKey =
                type === "Full Time Jobs" ? "fullTimeJobs" : type === "Part Time Jobs" ? "partTimeJobs" : "volunteers";
              const data = additionalData?.employmentDemographics?.[dataKey] ?? {
                total: 0,
                male: 0,
                female: 0,
                youth: 0,
                nonYouth: 0
              };
              return `
                <tr>
                  <th>${type} Created</th>
                  <td>${data.total ?? 0}</td>
                  <td>${data.male ?? 0}</td>
                  <td>${data.female ?? 0}</td>
                  <td>${data.youth ?? 0}</td>
                  <td>${data.nonYouth ?? 0}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Site Information</h2>
    <table>
      <thead>
        <tr>
          <th>Site Name</th>
          <th>Site Hectare Goal</th>
          <th>Hectares Under Restoration</th>
          <th>Total Disturbances</th>
          <th>Climatic</th>
          <th>Manmade</th>
        </tr>
      </thead>
      <tbody>
        ${additionalData.sites
          .map(
            site => `
          <tr>
            <td>${site.name || "-"}</td>
            <td>${site.hectareGoal || 0}</td>
            <td>${site.underRestoration || 0}</td>
            <td>${site.totalDisturbances || 0}</td>
            <td>${site.climatic || 0}</td>
            <td>${site.manmade || 0}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  </div>
  ${await this.generateTreeSpeciesPages(additionalData.treeSpeciesSummary)}
</body>
</html>
`;
  }

  private generateProgressRing(
    label: string,
    percent: number,
    description: string,
    color = "#00aaff",
    hidePercentage = false
  ) {
    const radius = 40;
    const stroke = 10;
    const normalizedRadius = radius - stroke * 0.5;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return `
      <div class="progress-ring">
        <strong>${label}</strong>
        <svg height="100" width="100">
          <circle
            stroke="#eee"
            fill="transparent"
            stroke-width="${stroke}"
            r="${normalizedRadius}"
            cx="50"
            cy="50"
          />
          <circle
            stroke="${color}"
            fill="transparent"
            stroke-width="${stroke}"
            stroke-dasharray="${circumference} ${circumference}"
            stroke-dashoffset="${strokeDashoffset}"
            r="${normalizedRadius}"
            cx="50"
            cy="50"
            transform="rotate(-90 50 50)"
          />
          ${
            !hidePercentage
              ? `<text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14" fill="#333">${percent}%</text>`
              : ""
          }
        </svg>
        <small>${description}</small>
      </div>
    `;
  }

  private generateEmploymentPieChart(data) {
    const total = data.fullTime + data.partTime + data.volunteers;
    const slices = [
      { label: "Full Time", value: data.fullTime, color: "#F59E0C" },
      { label: "Part Time", value: data.partTime, color: "#FACC14" },
      { label: "Volunteers", value: data.volunteers, color: "#15B8A6" }
    ];

    let cumulativePercent = 0;
    const getCoordinatesForPercent = percent => {
      const x = Math.cos(2 * Math.PI * percent);
      const y = Math.sin(2 * Math.PI * percent);
      return [x, y];
    };

    const paths = slices
      .map(slice => {
        if (slice.value === 0) return "";

        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
        cumulativePercent += slice.value / total;
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
        const largeArcFlag = slice.value / total > 0.5 ? 1 : 0;

        return `
          <path
            d="M 0 0 L ${startX * 100} ${startY * 100} A 100 100 0 ${largeArcFlag} 1 ${endX * 100} ${endY * 100} Z"
            fill="${slice.color}"
            stroke="white"
            stroke-width="2"
          >
            <title>${slice.label}: ${slice.value}</title>
          </path>
        `;
      })
      .join("");

    const legendItems = slices
      .map(slice => {
        return `
          <div style="display: flex; align-items: center; margin-right: 20px; margin-bottom: 5px;">
            <div style="width: 15px; height: 15px; background-color: ${slice.color}; margin-right: 5px;"></div>
            <div>${slice.label}: ${slice.value} (${Math.round((slice.value / total) * 100)}%)</div>
          </div>
        `;
      })
      .join("");

    return `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <svg width="200" height="200" viewBox="-120 -120 240 240">
          ${paths}
        </svg>
        <div style="margin-top: 10px;">
          <strong>Total Jobs/Volunteers: ${total}</strong>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; margin-left: 20px;">
        ${legendItems}
      </div>
    `;
  }

  private async generateTreeSpeciesPages(treeSpeciesData) {
    if (
      !treeSpeciesData ||
      !treeSpeciesData.sites ||
      !Array.isArray(treeSpeciesData.sites) ||
      treeSpeciesData.sites.length === 0
    ) {
      return `
        <div class='section'>
          <h2 class='section-title'>Tree Species Planting Summary</h2>
          <p>No tree species data available</p>
        </div>
      `;
    }

    const speciesMap = new Map();
    const sitesData = treeSpeciesData.sites;
    const projectId = treeSpeciesData.projectId;

    sitesData.forEach(site => {
      if (!site.species || !Array.isArray(site.species)) {
        site.species = [];
      }

      site.species.forEach(species => {
        if (!species || typeof species !== "object") {
          return;
        }

        const key = species.name || "Unknown";
        if (!speciesMap.has(key)) {
          speciesMap.set(key, {
            name: species.name || "Unknown",
            taxonId: species.taxonId,
            totalPlanted: 0,
            siteCounts: {}
          });
        }
      });
    });

    if (speciesMap.size === 0) {
      return `
        <div class='section'>
          <h2 class='section-title'>Tree Species Planting Summary</h2>
          <p>No tree species data found across sites</p>
        </div>
      `;
    }

    sitesData.forEach(site => {
      const siteName = site.siteName || site.name || `Site ${site.siteId || "Unknown"}`;

      speciesMap.forEach(speciesInfo => {
        speciesInfo.siteCounts[siteName] = "-";
      });

      if (Array.isArray(site.species)) {
        site.species.forEach(species => {
          if (!species || !species.name) return;

          const key = species.name;
          const speciesInfo = speciesMap.get(key);
          if (speciesInfo) {
            const amount =
              typeof species.amount === "number"
                ? species.amount
                : parseInt(species.amount as unknown as string, 10) || 0;
            speciesInfo.siteCounts[siteName] = amount;
            speciesInfo.totalPlanted += amount;
          }
        });
      }
    });

    const consolidatedSpecies = Array.from(speciesMap.values()).sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );

    // Find the project tree species goals
    const projectSpeciesGoals = new Map();
    try {
      if (projectId) {
        // Get the tree species for this project
        const projectTreeSpecies = await TreeSpecies.findAll({
          where: {
            speciesableType: Project.LARAVEL_TYPE,
            speciesableId: projectId,
            hidden: false
          },
          attributes: ["name", "amount"]
        });

        // Create a map of species name to goal amount
        projectTreeSpecies.forEach(species => {
          if (species.name && species.amount) {
            projectSpeciesGoals.set(species.name, species.amount);
          }
        });
      }
    } catch (error) {
      console.error("Error fetching project tree species goals:", error);
    }

    consolidatedSpecies.forEach(species => {
      species.goal = projectSpeciesGoals.has(species.name) ? projectSpeciesGoals.get(species.name) : null;
      if (species.goal) {
        species.progress = (species.totalPlanted / species.goal) * 100;
      }
    });

    const allSiteNames = sitesData.map(site => site.siteName || site.name || `Site ${site.siteId || "Unknown"}`);

    const pages = [];
    const sitesPerPage = 3;

    // Add a page break before the first tree species page
    pages.push('<div class="page-break"></div>');

    for (let i = 0; i < allSiteNames.length; i += sitesPerPage) {
      const currentSites = allSiteNames.slice(i, i + sitesPerPage);

      const siteHeaders = currentSites.map(site => `<th>Trees Planted in ${site}</th>`).join("");

      const rows = consolidatedSpecies
        .map(species => {
          const siteDataCells = currentSites
            .map(site => {
              const count = species.siteCounts[site];
              return `<td>${count !== undefined ? count : "-"}</td>`;
            })
            .join("");

          const progressCell = species.goal
            ? `
              <div class="progress-bar-container">
                <div class="progress-bar" style="width:${Math.min(
                  (species.totalPlanted / species.goal) * 100,
                  100
                ).toFixed(1)}%;"></div>
              </div>
              <small>${species.totalPlanted.toLocaleString()} of ${species.goal.toLocaleString()}</small>
            `
            : "-";

          return `
            <tr>
              <td>${species.name || "Unknown"}</td>
              ${siteDataCells}
              <td>${progressCell}</td>
            </tr>
          `;
        })
        .join("");

      // We no longer need page-break-before since we're using page-break between all groups
      // and already added a page break at the beginning
      const table = `
        <div class="section">
          <h2 class="section-title">Tree Species Planting Summary</h2>
          <p>Showing Sites ${i + 1} - ${Math.min(i + sitesPerPage, allSiteNames.length)} (of ${allSiteNames.length})</p>
          <table>
            <thead>
              <tr>
                <th>Species Name</th>
                ${siteHeaders}
                <th>Progress Towards Goal</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          ${i < allSiteNames.length - sitesPerPage ? '<div class="page-break"></div>' : ""}
        </div>
      `;

      pages.push(table);
    }

    return pages.join("");
  }
}
