import { Injectable, NotFoundException, InternalServerErrorException } from "@nestjs/common";
import { ProjectPolygon, ProjectPitch, PolygonGeometry } from "@terramatch-microservices/database/entities";
import { ProjectPolygonDto } from "./dto/project-polygon.dto";
import { Op } from "sequelize";

@Injectable()
export class ProjectPolygonsService {
  async findByProjectPitchUuid(projectPitchUuid: string): Promise<ProjectPolygon | null> {
    const projectPitch = await ProjectPitch.findOne({
      where: { uuid: projectPitchUuid },
      attributes: ["id", "uuid"]
    });

    if (projectPitch == null) {
      return null;
    }

    const projectPolygon = await ProjectPolygon.findOne({
      where: {
        entityType: ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH,
        entityId: projectPitch.id
      },
      include: [
        {
          model: PolygonGeometry,
          attributes: ["uuid"]
        }
      ]
    });

    return projectPolygon;
  }

  async loadProjectPitchAssociation(projectPolygons: ProjectPolygon[]): Promise<Record<number, string>> {
    if (projectPolygons.length === 0) {
      return {};
    }

    const entityIds = projectPolygons
      .filter(pp => pp.entityType === ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH)
      .map(pp => pp.entityId);

    if (entityIds.length === 0) {
      return {};
    }

    const projectPitches = await ProjectPitch.findAll({
      where: { id: { [Op.in]: entityIds } },
      attributes: ["id", "uuid"]
    });

    return projectPitches.reduce(
      (mapping, pitch) => ({
        ...mapping,
        [pitch.id]: pitch.uuid
      }),
      {} as Record<number, string>
    );
  }

  async buildDto(projectPolygon: ProjectPolygon, projectPitchUuid?: string): Promise<ProjectPolygonDto> {
    const dto = new ProjectPolygonDto(projectPolygon);

    // Set projectPitchId if we have it
    if (projectPitchUuid != null) {
      dto.projectPitchId = projectPitchUuid;
    } else if (projectPolygon.entityType === ProjectPolygon.LARAVEL_TYPE_PROJECT_PITCH) {
      // Load it if not provided
      const projectPitch = await ProjectPitch.findByPk(projectPolygon.entityId, {
        attributes: ["uuid"]
      });
      dto.projectPitchId = projectPitch?.uuid ?? null;
    }

    return dto;
  }

  async transaction<TReturn>(callback: (transaction: any) => Promise<TReturn>) {
    if (ProjectPolygon.sequelize == null) {
      throw new InternalServerErrorException("Database connection not available");
    }

    const transaction = await ProjectPolygon.sequelize.transaction();
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }
}
