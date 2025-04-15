import { Injectable } from "@nestjs/common";
import * as puppeteer from "puppeteer";
import { Project, Site, SiteReport } from "@terramatch-microservices/database/entities";
import { EntitiesService } from "../entities.service";

@Injectable()
export class PdfProcessor {
  async generateProjectPdf(entitiesService: EntitiesService, uuid: string): Promise<Buffer> {
    const projectProcessor = entitiesService.createEntityProcessor<Project>("projects");

    const project = await projectProcessor.findOne(uuid);
    if (!project) {
      throw new Error("Project not found");
    }
    await entitiesService.authorize("read", project);

    const { dto: projectData } = await projectProcessor.getFullDto(project);
    const additionalData = await this.getAdditionalReportData(project.id);
    const htmlContent = this.generateHtmlTemplate(projectData, additionalData);

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" }
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  }

  private async getAdditionalReportData(projectId: number) {
    // Fetch additional data from sites, tree species, and demographic data
    const sites = await this.getSiteBreakdown(projectId);
    const treeSpeciesSummary = await this.getTreeSpeciesDistribution(projectId);
    const siteNames = sites.map(site => site.name);

    // Get demographic data from approved project reports
    const demographicData = await this.getDemographicData(projectId);

    return {
      sites,
      siteNames,
      treeSpeciesSummary,
      employmentDemographics: demographicData,
      employment: {
        fullTime: demographicData.fullTimeJobs?.total || 0,
        partTime: demographicData.partTimeJobs?.total || 0,
        volunteers: demographicData.volunteers?.total || 0
      }
    };
  }

  private async getSiteBreakdown(projectId: number) {
    // Implementation to get site data for the report
    // This would fetch data from the database using repositories or services
    // Example implementation:
    try {
      // Query for sites associated with the project
      // This would typically use the project repository or a site service
      // Placeholder data - replace with actual implementation
      const approvedSites = await Site.approved().project(projectId).findAll();
      console.log(
        "Sites for project",
        projectId,
        ":",
        approvedSites.map(site => site.name)
      );
      const siteReports = await SiteReport.approved().sites([approvedSites[0].id]).findAll();
      console.log("Site reports for site", approvedSites[0].name, ":", siteReports);
      return [
        {
          name: "Agroforestry Marasoli",
          hectareGoal: 20,
          underRestoration: 4.352,
          totalDisturbances: 3,
          climatic: 4,
          manmade: 1
        },
        {
          name: "Songa forest-Marasoli",
          hectareGoal: 10,
          underRestoration: 9.085,
          totalDisturbances: 9,
          climatic: 3,
          manmade: 5
        }
      ];
    } catch (error) {
      console.error("Error fetching site breakdown:", error);
      return [];
    }
  }

  private async getTreeSpeciesDistribution(projectId: number) {
    // Implementation to get tree species distribution
    // Example implementation:
    try {
      return [
        {
          name: "Acacia",
          totalPlanted: 870,
          progress: 2.5,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 870,
            "Songa forest-Marasoli": "-"
          }
        },
        {
          name: "Azadirachta indica",
          totalPlanted: 6500,
          progress: 18.6,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 6500,
            "Songa forest-Marasoli": 880
          }
        },
        {
          name: "Carica papaya",
          totalPlanted: 230,
          progress: 0.7,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 230,
            "Songa forest-Marasoli": "-"
          }
        },
        {
          name: "Citrus + aurantium",
          totalPlanted: 350,
          progress: 1,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 350,
            "Songa forest-Marasoli": "-"
          }
        },
        {
          name: "Citrus",
          totalPlanted: 260,
          progress: 0.7,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 260,
            "Songa forest-Marasoli": "-"
          }
        },
        {
          name: "Croton megalocarpus",
          totalPlanted: 1530,
          progress: 4.4,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 1530,
            "Songa forest-Marasoli": 4830
          }
        },
        {
          name: "Croton",
          totalPlanted: 2200,
          progress: 6.3,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 2200,
            "Songa forest-Marasoli": "-"
          }
        },
        {
          name: "Grevillea robusta",
          totalPlanted: 1285,
          progress: 3.7,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 1285,
            "Songa forest-Marasoli": "-"
          }
        },
        {
          name: "Leucaena leucocephala",
          totalPlanted: 2200,
          progress: 6.3,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 2200,
            "Songa forest-Marasoli": "-"
          }
        },
        {
          name: "Mangifera indica",
          totalPlanted: 1600,
          progress: 4.6,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 1600,
            "Songa forest-Marasoli": "-"
          }
        },
        {
          name: "Medicago sativa",
          totalPlanted: 150,
          progress: 0.4,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 150,
            "Songa forest-Marasoli": "-"
          }
        },
        {
          name: "Moringa oleifera",
          totalPlanted: 2580,
          progress: 7.4,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 2580,
            "Songa forest-Marasoli": 250
          }
        },
        {
          name: "Musa acuminata",
          totalPlanted: 45,
          progress: 0.1,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 45,
            "Songa forest-Marasoli": "-"
          }
        },
        {
          name: "Olea",
          totalPlanted: 380,
          progress: 1.1,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 380,
            "Songa forest-Marasoli": 200
          }
        },
        {
          name: "Passiflora edulis",
          totalPlanted: 350,
          progress: 1,
          goal: 35000,
          siteCounts: {
            "Agroforestry Marasoli": 350,
            "Songa forest-Marasoli": "-"
          }
        }
      ];
    } catch (error) {
      console.error("Error fetching tree species distribution:", error);
      return [];
    }
  }

  private async getDemographicData(projectId: number) {
    // Implementation to get demographic data from approved project reports
    // This would fetch data from project reports
    // Example implementation:
    try {
      return {
        fullTimeJobs: {
          total: 43,
          male: 22,
          female: 12,
          youth: 10,
          nonYouth: 6
        },
        partTimeJobs: {
          total: 37,
          male: 22,
          female: 12,
          youth: 10,
          nonYouth: 6
        },
        volunteers: {
          total: 67,
          male: 11,
          female: 56,
          youth: 10,
          nonYouth: 6
        }
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

  private generateHtmlTemplate(projectData, additionalData) {
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
              margin-bottom: 10px;
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
            }
            .section-title {
              background-color: #f2f2f2;
              padding: 8px 12px;
              margin-bottom: 12px;
              border-radius: 3px;
              font-size: 16px;
              margin-top: 0;
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
            }
            .progress-ring strong {
              display: block;
              margin-top: 8px;
              font-size: 14px;
            }
            .progress-ring small {
              font-size: 12px;
              color: #666;
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
  
          <div class="section">
            <h2 class="section-title">General</h2>
            <table class="info-table">
              <tr><th>Organization Name</th><td>${projectData.organisationName || "-"}</td></tr>
              <tr><th>Project name</th><td>${projectData.name || "-"}</td></tr>
              <tr><th>Number of sites</th><td>${projectData.totalSites || 0}</td></tr>
              <tr><th>Most recent survival rate</th><td>${projectData.survivalRate || 0}%</td></tr>
              <tr><th>Total direct beneficiaries</th><td>${projectData.beneficiaries || 0}</td></tr>
              <tr><th>Total smallholder farmers engaged</th><td>${projectData.farmers || 0}</td></tr>
            </table>
          </div>
  
          <div class="section">
            <h2 class="section-title">Project and Goals</h2>
            <div class="chart">
              ${this.generateProgressRing("JOBS CREATED", 100, `43 Full-time<br>37 Part-time`, "#337ab7")}
              ${this.generateProgressRing(
                "HECTARES RESTORED",
                Math.round((projectData.totalHectaresRestoredSum / projectData.totalHectaresRestoredGoal) * 100),
                `${projectData.totalHectaresRestoredSum?.toLocaleString() || 0} of ${
                  projectData.totalHectaresRestoredGoal?.toLocaleString() || 0
                } ha`,
                "#5cb85c"
              )}
              ${this.generateProgressRing(
                "TREES PLANTED",
                Math.round((projectData.treesPlantedCount / projectData.treesGrownGoal) * 100),
                `${projectData.treesPlantedCount?.toLocaleString() || 0} of ${
                  projectData.treesGrownGoal?.toLocaleString() || 0
                }`,
                "#f0ad4e"
              )}
            </div>
          </div>
  
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
                      type === "Full Time Jobs"
                        ? "fullTimeJobs"
                        : type === "Part Time Jobs"
                        ? "partTimeJobs"
                        : "volunteers";
                    const data = additionalData?.employmentDemographics?.[dataKey] ?? {
                      total: 0,
                      male: 0,
                      female: 0,
                      youth: 0,
                      nonYouth: 0
                    };
                    return `<tr>
                    <th>${type} Created</th>
                    <td>${data.total ?? 0}</td>
                    <td>${data.male ?? 0}</td>
                    <td>${data.female ?? 0}</td>
                    <td>${data.youth ?? 0}</td>
                    <td>${data.nonYouth ?? 0}</td>
                  </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
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
          ${this.generateTreeSpeciesPages(additionalData.treeSpeciesSummary, additionalData.siteNames)}
        </body>
      </html>
    `;
  }

  private generateProgressRing(label: string, percent: number, description: string, color = "#00aaff") {
    const radius = 40;
    const stroke = 10;
    const normalizedRadius = radius - stroke * 0.5;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return `
      <div class="progress-ring">
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
          <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14" fill="#333">${percent}%</text>
        </svg>
        <strong>${label}</strong>
        <small>${description}</small>
      </div>
    `;
  }

  private generateEmploymentPieChart(data) {
    const total = data.fullTime + data.partTime + data.volunteers;
    const slices = [
      { label: "Full Time", value: data.fullTime, color: "#f4c542" },
      { label: "Part Time", value: data.partTime, color: "#42a5f5" },
      { label: "Volunteers", value: data.volunteers, color: "#66bb6a" }
    ];

    let cumulativePercent = 0;
    const getCoordinatesForPercent = percent => {
      const x = Math.cos(2 * Math.PI * percent);
      const y = Math.sin(2 * Math.PI * percent);
      return [x, y];
    };

    const paths = slices
      .map(slice => {
        if (slice.value === 0) return ""; // Skip slices with zero value

        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
        cumulativePercent += slice.value / total;
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
        const largeArcFlag = slice.value / total > 0.5 ? 1 : 0;

        return `
        <path d="M 0 0 L ${startX * 100} ${startY * 100} A 100 100 0 ${largeArcFlag} 1 ${endX * 100} ${
          endY * 100
        } Z" fill="${slice.color}">
          <title>${slice.label}: ${slice.value}</title>
        </path>
      `;
      })
      .join("");

    // Generate the legend items
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

  private generateTreeSpeciesPages(treeSpeciesData, sites) {
    if (!treeSpeciesData || !sites || sites.length === 0) {
      return "";
    }

    const pages = [];
    const sitesPerPage = 3;

    for (let i = 0; i < sites.length; i += sitesPerPage) {
      const currentSites = sites.slice(i, i + sitesPerPage);

      // Header row
      const siteHeaders = currentSites.map(site => `<th>Trees Planted in ${site}</th>`).join("");

      // Data rows
      const rows = treeSpeciesData
        .map(species => {
          const siteDataCells = currentSites
            .map(site => {
              const count = species.siteCounts[site] ?? "-";
              return `<td>${count}</td>`;
            })
            .join("");

          const progress = species.progress || 0;
          const goal = species.goal || 35000;
          const percentComplete = Math.min((species.totalPlanted / goal) * 100, 100);

          return `
          <tr>
            <td>${species.name}</td>
            ${siteDataCells}
            <td>
              <div class="progress-bar-container">
                <div class="progress-bar" style="width:${percentComplete}%;"></div>
              </div>
              <small>${species.totalPlanted.toLocaleString()} of ${goal.toLocaleString()}</small>
            </td>
          </tr>
        `;
        })
        .join("");

      const table = `
        <div class="section" ${i < sites.length - sitesPerPage ? 'style="page-break-after: always;"' : ""}>
          <h2 class="section-title">Tree Species Planting Summary</h2>
          <p>Showing Sites ${i + 1} - ${Math.min(i + sitesPerPage, sites.length)} (of ${sites.length})</p>
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
        </div>
        ${i < sites.length - sitesPerPage ? '<div class="page-break"></div>' : ""}
      `;
      pages.push(table);
    }

    return pages.join("");
  }
}
