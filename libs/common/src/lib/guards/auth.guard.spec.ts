import { AuthGuard, AuthOptional } from "./auth.guard";
import { Test } from "@nestjs/testing";
import { APP_GUARD } from "@nestjs/core";
import { Controller, Get, HttpStatus, INestApplication } from "@nestjs/common";
import { UserFactory } from "@terramatch-microservices/database/factories";
import request from "supertest";
import { mockContextForUser } from "../util/testing";

@Controller("test")
class TestController {
  @Get()
  test() {
    return "test";
  }

  @AuthOptional
  @Get("/optional-auth")
  optionalAuth() {
    return "optional-auth";
  }
}

describe("AuthGuard", () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = (
      await Test.createTestingModule({
        controllers: [TestController],
        providers: [{ provide: APP_GUARD, useClass: AuthGuard }]
      }).compile()
    ).createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it("should return an error when no user is found in context", async () => {
    await request(app.getHttpServer()).get("/test").expect(HttpStatus.UNAUTHORIZED);
  });

  it("should use the user found in context for auth", async () => {
    mockContextForUser(await UserFactory.create());
    await request(app.getHttpServer()).get("/test").expect(HttpStatus.OK);
  });

  it("should allow missing auth on an endpoint with @AuthOptional", async () => {
    await request(app.getHttpServer()).get("/test/optional-auth").expect(HttpStatus.OK);
  });

  it("should allow valid auth on an endpoint with @AuthOptional", async () => {
    mockContextForUser(await UserFactory.create());
    await request(app.getHttpServer()).get("/test/optional-auth").expect(HttpStatus.OK);
  });
});
