import * as fs from "fs";
import { Test } from "@nestjs/testing";
import { TemplateService } from "./template.service";

describe("TemplateService", () => {
  let service: TemplateService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TemplateService]
    }).compile();
    service = module.get(TemplateService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should render the template with the given data", async () => {
    const template = "A sample {{type}} template. Useful for {{entity}} updates.";
    jest.spyOn(fs, "readFileSync").mockImplementation(() => template);
    const result = service.render("template", { type: "email", unused: "foo" });
    expect(result).toEqual("A sample email template. Useful for  updates.");
  });

  it("should cache the compiled template", async () => {
    const template = "A sample {{type}} template. Useful for {{entity}} updates.";
    const spy = jest.spyOn(fs, "readFileSync").mockImplementation(() => template);
    let result = service.render("template", { type: "email", entity: "foo" });
    expect(result).toEqual("A sample email template. Useful for foo updates.");
    result = service.render("template", { type: "text", entity: "bar" });
    expect(result).toEqual("A sample text template. Useful for bar updates.");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
