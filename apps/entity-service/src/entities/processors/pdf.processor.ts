import { Injectable } from "@nestjs/common";
import * as puppeteer from "puppeteer";
import { Project } from "@terramatch-microservices/database/entities";
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
    console.log("    *");
    console.log("   ***");
    console.log("  *****");
    console.log(" *******");
    console.log("   ***");
    console.log("  * * *");
    console.log(" *  *  *");
    const additionalData = await this.getAdditionalReportData(project.id);
    console.log(projectData, " and ", additionalData);
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
    // Fetch additional data from sites and tree species
    // This is where you'd gather any data not in the projectFullDto
    return {
      // Example data structure
      sites: await this.getSiteBreakdown(projectId),
      employmentDemographics: await this.getTreeSpeciesDistribution(projectId),
      // Add more data as needed
      employment: {
        fullTime: 10,
        partTime: 20,
        volunteers: 30
      }
    };
  }

  private async getSiteBreakdown(projectId: number) {
    // Implementation to get site data for the report
    // Could use existing Site model and repository methods
    // ...
    return [];
  }

  private async getTreeSpeciesDistribution(projectId: number) {
    // Implementation to get tree species distribution
    // ...
    return [];
  }

  private generateHtmlTemplate(projectData, additionalData) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Project Report: ${projectData.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 40px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .chart { display: flex; justify-content: space-between; gap: 20px; margin: 30px 0; }
            .progress-ring { text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Project Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
  
          <div class="section">
            <h2>General Information</h2>
            <table>
              <tr><th>Organization Name</th><td>${projectData.organization}</td></tr>
              <tr><th>Project Name</th><td>${projectData.name}</td></tr>
              <tr><th>Number of Sites</th><td>${projectData.siteCount}</td></tr>
              <tr><th>Most Recent Survival Rate</th><td>${projectData.survivalRate}%</td></tr>
              <tr><th>Total Direct Beneficiaries</th><td>${projectData.beneficiaries}</td></tr>
              <tr><th>Total Smallholder Farmers Engaged</th><td>${projectData.farmers}</td></tr>
            </table>
          </div>
  
          <div class="section">
            <h2>Project and Goals</h2>
            <div class="chart">
              ${this.generateProgressRing("Jobs Created", 100, `43 Full-time<br>12 Part-time`)}
              ${this.generateProgressRing("Hectares Restored", 45, `${projectData.totalHectaresRestoredSum} of 30 ha`)}
              ${this.generateProgressRing("Trees Planted", 114, `${projectData.treesRestoredPpc} of 30,000`)}
            </div>
          </div>
  
          <div class="section">
            <h2>Employment Opportunities Created</h2>
            ${this.generateEmploymentPieChart(additionalData.employment)}
          </div>
  
          <div class="section">
            <h2>Employment by Demographics</h2>
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
                  .map(type => {
                    const data = additionalData?.employmentDemographics?.[type.toLowerCase().replace(/ /g, "")] ?? {
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
            <h2>Site Information</h2>
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
                    <td>${site.name}</td>
                    <td>${site.hectareGoal}</td>
                    <td>${site.underRestoration}</td>
                    <td>${site.totalDisturbances}</td>
                    <td>${site.climatic}</td>
                    <td>${site.manmade}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;
  }
  private generateProgressRing(label: string, percent: number, description: string) {
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
            stroke="#00aaff"
            fill="transparent"
            stroke-width="${stroke}"
            stroke-dasharray="${circumference} ${circumference}"
            stroke-dashoffset="${strokeDashoffset}"
            r="${normalizedRadius}"
            cx="50"
            cy="50"
            transform="rotate(-90 50 50)"
          />
          <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14">${percent}%</text>
        </svg>
        <strong>${label}</strong><br/>
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

    return `
      <svg width="300" height="300" viewBox="-120 -120 240 240">
        ${paths}
      </svg>
      <p><strong>Total Jobs/Volunteers: ${total}</strong></p>
    `;
  }
}
