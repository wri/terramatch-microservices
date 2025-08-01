import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { of } from "rxjs";
import { UserContextInterceptor } from "./user-context.interceptor";

describe("UserContextInterceptor", () => {
  let interceptor: UserContextInterceptor;
  let jwtService: jest.Mocked<JwtService>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserContextInterceptor,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn()
          }
        }
      ]
    }).compile();

    interceptor = module.get<UserContextInterceptor>(UserContextInterceptor);
    jwtService = module.get(JwtService);

    // Mock CallHandler
    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({}))
    } as CallHandler;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(interceptor).toBeDefined();
  });

  describe("when no valid authorization token is present", () => {
    it("should not set authenticatedUserId and continue", done => {
      const request = { headers: {}, authenticatedUserId: undefined };
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(request)
        }),
        getClass: jest.fn(),
        getHandler: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        getType: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn()
      } as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(request.authenticatedUserId).toBeUndefined();
          expect(jwtService.verify).not.toHaveBeenCalled();
          expect(mockCallHandler.handle).toHaveBeenCalled();
          done();
        },
        error: done
      });
    });
  });

  describe("when valid authorization token is present", () => {
    it("should set authenticatedUserId and continue", done => {
      const userId = 123;
      const request = { headers: { authorization: "Bearer valid-token" }, authenticatedUserId: undefined };
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(request)
        }),
        getClass: jest.fn(),
        getHandler: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        getType: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn()
      } as ExecutionContext;

      jwtService.verify.mockReturnValue({ sub: userId });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(request.authenticatedUserId).toBe(userId);
          expect(jwtService.verify).toHaveBeenCalledWith("valid-token");
          expect(mockCallHandler.handle).toHaveBeenCalled();
          done();
        },
        error: done
      });
    });
  });
});
