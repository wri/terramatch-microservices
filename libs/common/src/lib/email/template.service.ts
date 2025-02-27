import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Handlebars from "handlebars";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class TemplateService {
  private readonly template: Handlebars.TemplateDelegate;

  constructor(private readonly configService: ConfigService) {
    this.template = this.compileTemplate("default-email.hbs");
  }

  private compileTemplate(template: string) {
    const templatePath = path.join(__dirname, "..", "user-service/views", template);
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    return Handlebars.compile(templateSource);
  }

  render(data: any): string {
    const params = {
      backend_url: this.configService.get<string>("APP_BACKEND_URL"),
      banner: null,
      year: new Date().getFullYear(),
      monitoring: null,
      invite: null,
      transactional: null,
      ...data
    };
    return this.template(params);
  }
}
