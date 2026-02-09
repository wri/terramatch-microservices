import { Injectable, NotFoundException } from "@nestjs/common";
import { Framework, Project } from "@terramatch-microservices/database/entities";
import { ReportingFrameworkDto } from "./dto/reporting-framework.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";

@Injectable()
export class ReportingFrameworksService {
  async findBySlug(slug: string): Promise<Framework> {
    const framework = await Framework.findOne({ where: { slug } });
    if (framework == null) {
      throw new NotFoundException("Reporting framework not found");
    }
    return framework;
  }

  async findAll(): Promise<Framework[]> {
    return await Framework.findAll();
  }

  async calculateProjectsCount(frameworkSlug: string | null): Promise<number> {
    if (frameworkSlug == null) return 0;
    return await Project.count({ where: { frameworkKey: frameworkSlug } });
  }

  async addDto(document: DocumentBuilder, framework: Framework): Promise<DocumentBuilder> {
    const totalProjectsCount = await this.calculateProjectsCount(framework.slug);
    document.addData(framework.uuid, new ReportingFrameworkDto(framework, { totalProjectsCount }));
    return document;
  }

  async addDtos(document: DocumentBuilder, frameworks: Framework[]): Promise<DocumentBuilder> {
    for (const framework of frameworks) {
      const totalProjectsCount = await this.calculateProjectsCount(framework.slug);
      document.addData(framework.uuid, new ReportingFrameworkDto(framework, { totalProjectsCount }));
    }
    return document;
  }
}
