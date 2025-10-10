import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { Test } from "@nestjs/testing";
import { FormGetQueryDto, FormIndexQueryDto } from "./dto/form-query.dto";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { Form } from "@terramatch-microservices/database/entities";

describe("FormsController", () => {
  let controller: FormsController;
  let service: DeepMocked<FormsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FormsController],
      providers: [{ provide: FormsService, useValue: (service = createMock<FormsService>()) }]
    }).compile();

    controller = module.get(FormsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("formsIndex", () => {
    it("calls addIndex on the service", async () => {
      const query: FormIndexQueryDto = { search: "foo", type: "nursery" };
      await controller.formIndex(query);
      expect(service.addIndex).toHaveBeenCalledWith(expect.any(DocumentBuilder), query);
    });
  });

  describe("formsGet", () => {
    it("pulls the form instance and builds the full DTO", async () => {
      const form = {} as Form;
      const query: FormGetQueryDto = { translated: false };
      service.findOne.mockResolvedValue(form);
      await controller.formGet("fake-uuid", query);
      expect(service.findOne).toHaveBeenCalledWith("fake-uuid");
      expect(service.addFullDto).toHaveBeenCalledWith(expect.any(DocumentBuilder), form, false);
    });
  });
});
