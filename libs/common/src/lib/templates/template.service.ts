import { Injectable } from "@nestjs/common";
import * as Handlebars from "handlebars";
import * as fs from "fs";
import * as path from "path";
import { Dictionary } from "factory-girl-ts";

@Injectable()
export class TemplateService {
  private templates: Dictionary<Handlebars.TemplateDelegate> = {};

  private getCompiledTemplate(template: string) {
    if (this.templates[template] != null) return this.templates[template];

    // reference the template path from the NX root.
    const templatePath = path.join(__dirname, "../../..", template);
    const templateSource = fs.readFileSync(templatePath, "utf-8");
    return (this.templates[template] = Handlebars.compile(templateSource));
  }

  render(templatePath: string, data: Dictionary<string | null | undefined | number>): string {
    return this.getCompiledTemplate(templatePath)(data);
  }
}
