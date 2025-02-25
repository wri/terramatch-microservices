import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Handlebars from "handlebars";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class TemplateService {
  private readonly template: Handlebars.TemplateDelegate;

  constructor() {
    this.template = this.compileTemplate("default-email.hbs");
  }

  private compileTemplate(template: string) {
    const templatePath = path.join(__dirname, "..", "user-service/views", template);
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    return Handlebars.compile(templateSource);
  }

  render(data: any): string {
    const params = {
      ...data,
      backend_url: null, // TODO add backend url
      banner: null,
      year: new Date().getFullYear()
    };
    return this.template(params);
  }
}
