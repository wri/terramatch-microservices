import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Handlebars from "handlebars";
import * as fs from "fs";
import * as path from "path";
import { Dictionary } from "factory-girl-ts";
import { isString } from "lodash";

@Injectable()
export class TemplateService {
  private templates: Dictionary<Handlebars.TemplateDelegate> = {};

  constructor(private readonly configService: ConfigService) {}

  private getCompiledTemplate(template: string) {
    if (this.templates[template] != null) return this.templates[template];

    // reference the template path from the NX root.
    const templatePath = path.join(__dirname, "../../..", template);
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    return (this.templates[template] = Handlebars.compile(templateSource));
  }

  render(templatePath: string, data: Dictionary<string | null | undefined | number>): string {
    const params: Dictionary<string | null | undefined | number> = {
      backendUrl: this.configService.get<string>("EMAIL_IMAGE_BASE_URL"),
      banner: null,
      invite: null,
      monitoring: null,
      transactional: null,
      year: new Date().getFullYear(),
      ...data
    };

    if (isString(params["link"]) && params["link"].substring(0, 4).toLowerCase() !== "http") {
      // If we're given a link that's pointing to a raw path, assume it should be prepended with
      // the configured app FE base URL.
      params["link"] = `${this.configService.get("APP_FRONT_END")}${params["link"]}`;
    }
    return this.getCompiledTemplate(templatePath)(params);
  }
}
