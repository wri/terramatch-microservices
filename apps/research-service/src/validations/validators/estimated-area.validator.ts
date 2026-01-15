import { SitePolygon, Site, Project } from "@terramatch-microservices/database/entities";
import { PolygonValidator, ValidationResult, PolygonValidationResult } from "./validator.interface";
import { NotFoundException } from "@nestjs/common";
import { Op, WhereOptions } from "sequelize";

interface EstimatedAreaResult extends ValidationResult {
  extraInfo: {
    polygon_status: string | null;
    polygon_area: number | null;
    is_polygon_approved: boolean;
    sum_area_site_approved: number | null;
    percentage_site_approved: number | null;
    total_area_site: number | null;
    sum_area_project_approved: number | null;
    percentage_project_approved: number | null;
    total_area_project: number | null;
    projected_sum_area_site?: number | null;
    projected_percentage_site?: number | null;
    projected_sum_area_project?: number | null;
    projected_percentage_project?: number | null;
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

    const isApproved = sitePolygon.status === "approved";

    return {
      valid,
      extraInfo: {
        polygon_status: sitePolygon.status,
        polygon_area: sitePolygon.calcArea != null ? this.round2(sitePolygon.calcArea) : null,
        is_polygon_approved: isApproved,
        sum_area_site_approved: siteData.sumAreaSiteApproved,
        percentage_site_approved: siteData.percentageSiteApproved,
        total_area_site: siteData.totalAreaSite,
        sum_area_project_approved: projectData.sumAreaProjectApproved,
        percentage_project_approved: projectData.percentageProjectApproved,
        total_area_project: projectData.totalAreaProject,
        ...(siteData.projectedSumAreaSite !== undefined && {
          projected_sum_area_site: siteData.projectedSumAreaSite,
          projected_percentage_site: siteData.projectedPercentageSite
        }),
        ...(projectData.projectedSumAreaProject !== undefined && {
          projected_sum_area_project: projectData.projectedSumAreaProject,
          projected_percentage_project: projectData.projectedPercentageProject
        })
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
          attributes: ["hectaresToRestoreGoal", "projectId", "uuid"]
        }
      ]
    });
  }

  private async generateAreaDataSite(sitePolygon: SitePolygon): Promise<{
    valid: boolean;
    sumAreaSiteApproved: number | null;
    percentageSiteApproved: number | null;
    totalAreaSite: number | null;
    projectedSumAreaSite?: number | null;
    projectedPercentageSite?: number | null;
  }> {
    if (sitePolygon.siteUuid == null || sitePolygon.siteUuid === "") {
      return {
        valid: false,
        sumAreaSiteApproved: null,
        percentageSiteApproved: null,
        totalAreaSite: null
      };
    }

    const site = await sitePolygon.loadSite();
    if (site == null || site.hectaresToRestoreGoal == null || site.hectaresToRestoreGoal <= 0) {
      return {
        valid: false,
        sumAreaSiteApproved: null,
        percentageSiteApproved: null,
        totalAreaSite: site != null ? site.hectaresToRestoreGoal : null
      };
    }

    const sumAreaSiteApproved = await this.calculateSiteAreaSum(site.uuid, "approved");

    const lowerBound = EstimatedAreaValidator.LOWER_BOUND_MULTIPLIER * site.hectaresToRestoreGoal;
    const upperBound = EstimatedAreaValidator.UPPER_BOUND_MULTIPLIER * site.hectaresToRestoreGoal;

    const valid = sumAreaSiteApproved >= lowerBound && sumAreaSiteApproved <= upperBound;
    const percentageApproved = (sumAreaSiteApproved / site.hectaresToRestoreGoal) * 100;

    const isApproved = sitePolygon.status === "approved";
    const polygonArea = sitePolygon.calcArea ?? 0;

    let projectedSum: number | undefined;
    let projectedPercentage: number | undefined;

    if (!isApproved && polygonArea > 0) {
      projectedSum = sumAreaSiteApproved + polygonArea;
      projectedPercentage = (projectedSum / site.hectaresToRestoreGoal) * 100;
    }

    return {
      valid,
      sumAreaSiteApproved: this.round2(sumAreaSiteApproved),
      percentageSiteApproved: this.round2(percentageApproved),
      totalAreaSite: site.hectaresToRestoreGoal,
      projectedSumAreaSite: projectedSum !== undefined ? this.round2(projectedSum) : undefined,
      projectedPercentageSite: projectedPercentage !== undefined ? this.round2(projectedPercentage) : undefined
    };
  }

  private async generateAreaDataProject(sitePolygon: SitePolygon): Promise<{
    valid: boolean;
    sumAreaProjectApproved: number | null;
    percentageProjectApproved: number | null;
    totalAreaProject: number | null;
    projectedSumAreaProject?: number | null;
    projectedPercentageProject?: number | null;
  }> {
    const site = await sitePolygon.loadSite();
    if (site == null || site.projectId == null) {
      return {
        valid: false,
        sumAreaProjectApproved: null,
        percentageProjectApproved: null,
        totalAreaProject: null
      };
    }

    const project = await Project.findByPk(site.projectId);
    if (project == null || project.totalHectaresRestoredGoal == null || project.totalHectaresRestoredGoal <= 0) {
      return {
        valid: false,
        sumAreaProjectApproved: null,
        percentageProjectApproved: null,
        totalAreaProject: project?.totalHectaresRestoredGoal ?? null
      };
    }

    const sumAreaProjectApproved = await this.calculateProjectAreaSum(project.id, "approved");

    const lowerBound = EstimatedAreaValidator.LOWER_BOUND_MULTIPLIER * project.totalHectaresRestoredGoal;
    const upperBound = EstimatedAreaValidator.UPPER_BOUND_MULTIPLIER * project.totalHectaresRestoredGoal;

    const valid = sumAreaProjectApproved >= lowerBound && sumAreaProjectApproved <= upperBound;
    const percentageApproved = (sumAreaProjectApproved / project.totalHectaresRestoredGoal) * 100;

    const isApproved = sitePolygon.status === "approved";
    const polygonArea = sitePolygon.calcArea ?? 0;

    let projectedSum: number | undefined;
    let projectedPercentage: number | undefined;

    if (!isApproved && polygonArea > 0) {
      projectedSum = sumAreaProjectApproved + polygonArea;
      projectedPercentage = (projectedSum / project.totalHectaresRestoredGoal) * 100;
    }

    return {
      valid,
      sumAreaProjectApproved: this.round2(sumAreaProjectApproved),
      percentageProjectApproved: this.round2(percentageApproved),
      totalAreaProject: project.totalHectaresRestoredGoal,
      projectedSumAreaProject: projectedSum !== undefined ? this.round2(projectedSum) : undefined,
      projectedPercentageProject: projectedPercentage !== undefined ? this.round2(projectedPercentage) : undefined
    };
  }

  private async calculateSiteAreaSum(siteUuid: string, status?: string): Promise<number> {
    if (siteUuid == null || siteUuid === "") {
      return 0;
    }

    const whereClause: WhereOptions<SitePolygon> = {
      siteUuid,
      isActive: true,
      calcArea: { [Op.gt]: 0 }
    };

    if (status != null) {
      whereClause.status = status;
    }

    const result = await SitePolygon.sum("calcArea", {
      where: whereClause
    });

    return result ?? 0;
  }

  private async calculateProjectAreaSum(projectId: number, status?: string): Promise<number> {
    const whereClause: WhereOptions<SitePolygon> = {
      siteUuid: { [Op.in]: Site.uuidsSubquery(projectId) },
      isActive: true,
      calcArea: { [Op.gt]: 0 }
    };

    if (status != null) {
      whereClause.status = status;
    }

    const result = await SitePolygon.sum("calcArea", {
      where: whereClause
    });
    return result ?? 0;
  }

  private round2(value: number): number {
    return Number(value.toFixed(2));
  }
}
