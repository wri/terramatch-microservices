import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Handlebars from "handlebars";
import * as fs from "fs";
import * as path from "path";
import { Dictionary } from "factory-girl-ts";

@Injectable()
export class TemplateService {
  private templates: Dictionary<Handlebars.TemplateDelegate> = {};

  constructor(private readonly configService: ConfigService) {}

  private getCompiledTemplate(template: string) {
    if (this.templates[template] != null) return this.templates[template];

    const templatePath = path.join(__dirname, "..", template);
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    return (this.templates[template] = Handlebars.compile(templateSource));
  }

  render(templatePath: string, data: Dictionary<string>): string {
    const params = {
      backendUrl: this.configService.get<string>("EMAIL_IMAGE_BASE_URL"),
      banner: null,
      invite: null,
      monitoring: null,
      transactional: null,
      year: new Date().getFullYear(),
      ...data
    };
    return this.getCompiledTemplate(templatePath)(params);
  }
}
