import { AuthGuard, NoBearerAuth } from "./auth.guard";
import { Test } from "@nestjs/testing";
import { APP_GUARD } from "@nestjs/core";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { JwtService } from "@nestjs/jwt";
import { Controller, Get, HttpStatus, INestApplication } from "@nestjs/common";
import { UserFactory } from "@terramatch-microservices/database/factories";
import request from "supertest";

@Controller("test")
class TestController {
  @Get()
  test() {
    return "test";
  }

  @NoBearerAuth
  @Get("/no-auth")
  noAuth() {
    return "no-auth";
  }
}

describe("AuthGuard", () => {
  let jwtService: DeepMocked<JwtService>;
  let app: INestApplication;

  beforeEach(async () => {
    app = (
      await Test.createTestingModule({
        controllers: [TestController],
        providers: [
          { provide: JwtService, useValue: (jwtService = createMock<JwtService>()) },
          { provide: APP_GUARD, useClass: AuthGuard }
        ]
      }).compile()
    ).createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it("should return an error when no auth header is present", async () => {
    await request(app.getHttpServer()).get("/test").expect(HttpStatus.UNAUTHORIZED);
  });

  it("should not return an error when a valid auth header is present", async () => {
    const token = "fake jwt token";
    jwtService.verifyAsync.mockResolvedValue({ sub: "fakeuserid" });

    await request(app.getHttpServer()).get("/test").set("Authorization", `Bearer ${token}`).expect(HttpStatus.OK);
  });

  it("should ignore bearer token on an endpoint with @NoBearerAuth", async () => {
    await request(app.getHttpServer()).get("/test/no-auth").expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .get("/test/no-auth")
      .set("Authorization", "Bearer fake jwt token")
      .expect(HttpStatus.OK);
  });

  it("should use an api key for login", async () => {
    const apiKey = "fake-api-key";
    await UserFactory.create({ apiKey });
    jwtService.decode.mockReturnValue(null);

    await request(app.getHttpServer()).get("/test").set("Authorization", `Bearer ${apiKey}`).expect(HttpStatus.OK);
  });

  it("should throw when the api key is not recognized", async () => {
    jwtService.decode.mockReturnValue(null);

    await request(app.getHttpServer())
      .get("/test")
      .set("Authorization", "Bearer foobar")
      .expect(HttpStatus.UNAUTHORIZED);
  });
});
