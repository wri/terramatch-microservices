import { SitePolygon, Site, Project } from "@terramatch-microservices/database/entities";
import { PolygonValidator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";
import { Op } from "sequelize";

interface EstimatedAreaResult extends ValidationResult {
  extraInfo: {
    sum_area_site: number | null;
    sum_area_project: number | null;
    percentage_site: number | null;
    percentage_project: number | null;
    total_area_site: number | null;
    total_area_project: number | null;
  } | null;
}

export class EstimatedAreaValidator implements PolygonValidator {
  private static readonly LOWER_BOUND_MULTIPLIER = 0.75;
  private static readonly UPPER_BOUND_MULTIPLIER = 1.25;

  async validatePolygon(polygonUuid: string): Promise<EstimatedAreaResult> {
    const sitePolygon = await this.getSitePolygonWithAssociations(polygonUuid);
    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for polygon UUID ${polygonUuid}`);
    }

    const siteData = await this.generateAreaDataSite(sitePolygon);
    const projectData = await this.generateAreaDataProject(sitePolygon);

    const valid = siteData.valid || projectData.valid;

    return {
      valid,
      extraInfo: {
        sum_area_site: siteData.sumAreaSite,
        sum_area_project: projectData.sumAreaProject,
        percentage_site: siteData.percentageSite,
        percentage_project: projectData.percentageProject,
        total_area_site: siteData.totalAreaSite,
        total_area_project: projectData.totalAreaProject
      }
    };
  }

  async validatePolygons(polygonUuids: string[]): Promise<PolygonValidationResult[]> {
    const results: PolygonValidationResult[] = [];

    for (const polygonUuid of polygonUuids) {
      try {
        const result = await this.validatePolygon(polygonUuid);
        results.push({
          polygonUuid,
          valid: result.valid,
          extraInfo: result.extraInfo
        });
      } catch (error) {
        results.push({
          polygonUuid,
          valid: false,
          extraInfo: { error: error instanceof Error ? error.message : "Unknown error" }
        });
      }
    }

    return results;
  }

  private async getSitePolygonWithAssociations(polygonUuid: string): Promise<SitePolygon | null> {
    return await SitePolygon.findOne({
      where: { polygonUuid, isActive: true },
      include: [
        {
          model: Site,
          as: "site",
          attributes: ["hectaresToRestoreGoal", "projectId"]
        }
      ]
    });
  }

  private async generateAreaDataSite(sitePolygon: SitePolygon): Promise<{
    valid: boolean;
    sumAreaSite: number | null;
    percentageSite: number | null;
    totalAreaSite: number | null;
  }> {
    const site = await sitePolygon.loadSite();
    if (site == null || site.hectaresToRestoreGoal == null || site.hectaresToRestoreGoal <= 0) {
      return {
        valid: false,
        sumAreaSite: null,
        percentageSite: null,
        totalAreaSite: site != null ? site.hectaresToRestoreGoal : null
      };
    }

    const sumAreaSite = await this.calculateSiteAreaSum(site.uuid);
    const lowerBound = EstimatedAreaValidator.LOWER_BOUND_MULTIPLIER * site.hectaresToRestoreGoal;
    const upperBound = EstimatedAreaValidator.UPPER_BOUND_MULTIPLIER * site.hectaresToRestoreGoal;
    const valid = sumAreaSite >= lowerBound && sumAreaSite <= upperBound;
    const percentage = (sumAreaSite / site.hectaresToRestoreGoal) * 100;

    return {
      valid,
      sumAreaSite: Math.round(sumAreaSite),
      percentageSite: Math.round(percentage),
      totalAreaSite: site.hectaresToRestoreGoal
    };
  }

  private async generateAreaDataProject(sitePolygon: SitePolygon): Promise<{
    valid: boolean;
    sumAreaProject: number | null;
    percentageProject: number | null;
    totalAreaProject: number | null;
  }> {
    const site = await sitePolygon.loadSite();
    if (site == null || site.projectId == null) {
      return {
        valid: false,
        sumAreaProject: null,
        percentageProject: null,
        totalAreaProject: null
      };
    }

    const project = await Project.findByPk(site.projectId);
    if (project == null || project.totalHectaresRestoredGoal == null || project.totalHectaresRestoredGoal <= 0) {
      return {
        valid: false,
        sumAreaProject: null,
        percentageProject: null,
        totalAreaProject: project?.totalHectaresRestoredGoal ?? null
      };
    }

    const sumAreaProject = await this.calculateProjectAreaSum(project.id);
    const lowerBound = EstimatedAreaValidator.LOWER_BOUND_MULTIPLIER * project.totalHectaresRestoredGoal;
    const upperBound = EstimatedAreaValidator.UPPER_BOUND_MULTIPLIER * project.totalHectaresRestoredGoal;
    const valid = sumAreaProject >= lowerBound && sumAreaProject <= upperBound;
    const percentage = (sumAreaProject / project.totalHectaresRestoredGoal) * 100;

    return {
      valid,
      sumAreaProject: Math.round(sumAreaProject),
      percentageProject: Math.round(percentage),
      totalAreaProject: project.totalHectaresRestoredGoal
    };
  }

  private async calculateSiteAreaSum(siteUuid: string): Promise<number> {
    if (siteUuid == null || siteUuid === "") {
      return 0;
    }

    const result = await SitePolygon.sum("calcArea", {
      where: { siteUuid, isActive: true }
    });
    return result ?? 0;
  }

  private async calculateProjectAreaSum(projectId: number): Promise<number> {
    const result = await SitePolygon.sum("calcArea", {
      where: {
        siteUuid: { [Op.in]: Site.uuidsSubquery(projectId) },
        isActive: true
      }
    });
    return result ?? 0;
  }
}
