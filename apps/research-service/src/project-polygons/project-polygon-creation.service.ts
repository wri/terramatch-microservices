import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { ProjectPolygon, ProjectPitch, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { Transaction } from "sequelize";
import { CreateProjectPolygonBatchRequestDto, Feature } from "./dto/create-project-polygon-request.dto";
import { PolygonGeometryCreationService } from "../site-polygons/polygon-geometry-creation.service";
import { Geometry } from "@terramatch-microservices/database/constants";

@Injectable()
export class ProjectPolygonCreationService {
  constructor(private readonly polygonGeometryService: PolygonGeometryCreationService) {}

  async createProjectPolygons(request: CreateProjectPolygonBatchRequestDto, userId: number): Promise<ProjectPolygon[]> {
    if (PolygonGeometry.sequelize == null) {
      throw new BadRequestException("Database connection not available");
    }

    const transaction = await PolygonGeometry.sequelize.transaction();
    const createdProjectPolygons: ProjectPolygon[] = [];

    try {
      // Extract all features and group by projectPitchId
      const groupedByProjectPitch = this.groupGeometriesByProjectPitchId(request.geometries);

      // Validate all project pitches exist
      await this.validateProjectPitchesExist(Object.keys(groupedByProjectPitch), transaction);

      // Process each project pitch
      for (const [projectPitchUuid, features] of Object.entries(groupedByProjectPitch)) {
        // Get project pitch to get its ID
        const projectPitch = await ProjectPitch.findOne({
          where: { uuid: projectPitchUuid },
          attributes: ["id", "uuid"],
          transaction
        });

        if (projectPitch == null) {
          throw new NotFoundException(`Project pitch not found: ${projectPitchUuid}`);
        }

        // Check if project polygon already exists for this pitch
        const existingProjectPolygon = await ProjectPolygon.findOne({
          where: {
            entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
            entityId: projectPitch.id
          },
          transaction
        });

        if (existingProjectPolygon != null) {
          throw new BadRequestException(
            `Project polygon already exists for project pitch ${projectPitchUuid}. Only one polygon per project pitch is allowed.`
          );
        }

        // Extract geometries from features
        const geometries = features.map(f => f.geometry as Geometry);

        // Create polygon geometries
        const { uuids: polygonUuids } = await this.polygonGeometryService.createGeometriesFromFeatures(
          geometries,
          userId,
          transaction
        );

        if (polygonUuids.length === 0) {
          throw new BadRequestException("No valid geometries were created");
        }

        // Only use the first polygon (one polygon per project pitch)
        const polygonUuid = polygonUuids[0];

        // Create project polygon
        const projectPolygon = await ProjectPolygon.create(
          {
            polyUuid: polygonUuid,
            entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
            entityId: projectPitch.id,
            createdBy: userId,
            lastModifiedBy: userId
          } as ProjectPolygon,
          { transaction }
        );

        createdProjectPolygons.push(projectPolygon);
      }

      await transaction.commit();
      return createdProjectPolygons;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private groupGeometriesByProjectPitchId(geometries: { type: string; features: Feature[] }[]): {
    [projectPitchId: string]: Feature[];
  } {
    const grouped: { [projectPitchId: string]: Feature[] } = {};

    for (const geometryCollection of geometries) {
      if (geometryCollection.features == null) {
        continue;
      }

      for (const feature of geometryCollection.features) {
        const projectPitchId =
          (feature.properties?.projectPitchId as string) ?? (feature.properties?.project_pitch_id as string);
        if (projectPitchId == null) {
          throw new BadRequestException("All features must have projectPitchId in properties");
        }

        if (grouped[projectPitchId] == null) {
          grouped[projectPitchId] = [];
        }

        grouped[projectPitchId].push(feature);
      }
    }

    return grouped;
  }

  private async validateProjectPitchesExist(projectPitchUuids: string[], transaction: Transaction): Promise<void> {
    const projectPitches = await ProjectPitch.findAll({
      where: { uuid: projectPitchUuids },
      attributes: ["uuid"],
      transaction
    });

    const foundProjectPitchUuids = new Set(projectPitches.map(p => p.uuid));
    const missingProjectPitches = projectPitchUuids.filter(uuid => !foundProjectPitchUuids.has(uuid));

    if (missingProjectPitches.length > 0) {
      throw new NotFoundException(`Project pitches not found: ${missingProjectPitches.join(", ")}`);
    }
  }
}
