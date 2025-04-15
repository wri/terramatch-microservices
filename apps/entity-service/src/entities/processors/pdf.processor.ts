import { Injectable } from "@nestjs/common";
import * as puppeteer from "puppeteer";
import { Project, Site, SiteReport, TreeSpecies } from "@terramatch-microservices/database/entities";
import { EntitiesService } from "../entities.service";
import { fn } from "sequelize";
import { col } from "sequelize";

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
      const approvedSitesQuery = Site.approvedIdsSubquery(projectId);

      // First, fetch all the approved sites with their basic info
      const sites = await Site.approved()
        .project(projectId)
        .findAll({
          attributes: ["id", "uuid", "name"]
        });

      // For each site, we need to find the associated site reports
      const siteDistribution = [];

      for (const site of sites) {
        // Get reports for this specific site
        const siteReportIds = SiteReport.approvedIdsSubquery([site.id]);

        // Find all tree species entries linked to these site reports
        const treeSpeciesEntries = await TreeSpecies.visible()
          .collection("tree-planted")
          .siteReports(siteReportIds)
          .findAll({
            attributes: ["name", "taxonId", [fn("SUM", col("amount")), "amount"]],
            group: ["name", "taxonId"],
            raw: true
          });

        // Transform data into a more usable format
        const speciesList = treeSpeciesEntries.map(entry => ({
          name: entry.name,
          taxonId: entry.taxonId,
          amount: parseInt(entry.amount as unknown as string, 10)
        }));

        // Add this site's data to the result
        siteDistribution.push({
          siteId: site.id,
          siteUuid: site.uuid,
          siteName: site.name,
          species: speciesList
        });
      }

      console.log("siteDistribution", JSON.stringify(siteDistribution, null, 2));
      return siteDistribution;
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
  private generateTreeSpeciesPages(treeSpeciesData, sitesNames) {
    // Make sure we have valid data to work with
    if (!treeSpeciesData || !Array.isArray(treeSpeciesData) || treeSpeciesData.length === 0) {
      console.log("Invalid or empty treeSpeciesData:", treeSpeciesData);
      return "<div class='section'><h2 class='section-title'>Tree Species Planting Summary</h2><p>No tree species data available</p></div>";
    }

    // Step 1: Transform the data structure
    // We need to create a consolidated view where each species appears once and has counts for each site

    // Create a map of all species across all sites
    const speciesMap = new Map();

    // First pass: collect all unique species
    treeSpeciesData.forEach(site => {
      // Make sure the site has a species array before trying to iterate
      if (!site.species || !Array.isArray(site.species)) {
        console.log("Site missing species array:", site);
        site.species = []; // Initialize as empty array to avoid further errors
      }

      site.species.forEach(species => {
        if (!species || typeof species !== "object") {
          console.log("Invalid species entry:", species);
          return; // Skip this entry
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

    // If no valid species were found, return early
    if (speciesMap.size === 0) {
      return "<div class='section'><h2 class='section-title'>Tree Species Planting Summary</h2><p>No tree species data found across sites</p></div>";
    }

    // Second pass: fill in the counts for each site
    treeSpeciesData.forEach(site => {
      const siteName = site.siteName || site.name || `Site ${site.siteId || "Unknown"}`;

      // Initialize all species with default value for this site
      speciesMap.forEach(speciesInfo => {
        speciesInfo.siteCounts[siteName] = "-";
      });

      // Update with actual counts
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

    // Convert map to array and sort by name
    const consolidatedSpecies = Array.from(speciesMap.values()).sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );

    // Calculate goal and progress for each species (sample calculation)
    // You might want to adjust this logic based on your requirements
    const treeGoal = 35000; // Default goal per species
    consolidatedSpecies.forEach(species => {
      species.goal = treeGoal;
      species.progress = (species.totalPlanted / treeGoal) * 100;
    });

    // Get the list of all site names
    const allSiteNames = treeSpeciesData.map(site => site.siteName || site.name || `Site ${site.siteId || "Unknown"}`);

    // Step 2: Generate the pages with 3 sites per page
    const pages = [];
    const sitesPerPage = 3;

    for (let i = 0; i < allSiteNames.length; i += sitesPerPage) {
      const currentSites = allSiteNames.slice(i, i + sitesPerPage);

      // Header row
      const siteHeaders = currentSites.map(site => `<th>Trees Planted in ${site}</th>`).join("");

      // Data rows
      const rows = consolidatedSpecies
        .map(species => {
          const siteDataCells = currentSites
            .map(site => {
              const count = species.siteCounts[site];
              return `<td>${count !== undefined ? count : "-"}</td>`;
            })
            .join("");

          const percentComplete = Math.min((species.totalPlanted / species.goal) * 100, 100);

          return `
          <tr>
            <td>${species.name || "Unknown"}</td>
            ${siteDataCells}
            <td>
              <div class="progress-bar-container">
                <div class="progress-bar" style="width:${percentComplete.toFixed(1)}%;"></div>
              </div>
              <small>${species.totalPlanted.toLocaleString()} of ${species.goal.toLocaleString()}</small>
            </td>
          </tr>
        `;
        })
        .join("");

      // Make sure each page starts fresh
      const pageBreakBefore = i > 0 ? "page-break-before: always;" : "";

      const table = `
        <div class="section" style="${pageBreakBefore}">
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
        </div>
      `;

      pages.push(table);
    }

    return pages.join("");
  }
}
