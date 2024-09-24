import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import {
  HttpLambdaIntegration,
  HttpUrlIntegration
} from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

// References the .env in the root of this repo, so building from this directory will not find
// the file correctly. Instead, use `nx build api-gateway` in the root directory.
require('dotenv').config();

const V3_SERVICES = {
  'user-service': {
    target: process.env.USER_SERVICE_PROXY_TARGET ?? '',
    namespaces: ['auth', 'users']
  }
}

export class ApiGatewayStack extends cdk.Stack {
  protected httpApi: HttpApi;

  constructor (scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.httpApi = new HttpApi(this, "TerraMatch API Gateway", {
      apiName: 'TerraMatch API Gateway',
      corsPreflight: process.env.NODE_ENV !== 'development' ? undefined : {
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.PUT,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"],
        allowHeaders: ['authorization,content-type'],
      }
    });

    for (const [service, { target, namespaces }] of Object.entries(V3_SERVICES)) {
      this.addProxy(`API Swagger Docs [${service}]`, `/${service}/documentation/`, target);

      for (const namespace of namespaces) {
        this.addProxy(`V3 Namespace [${service}/${namespace}]`, `/${namespace}/v3/`, target);
      }
    }

    // The PHP Monolith proxy keeps `/api/` in its path to avoid conflict with the newer
    // namespace-driven design of the v3 API space, and to minimize disruption with existing
    // consumers (like Greenhouse and the web TM frontend) as we migrate to this API Gateway.
    this.addProxy('PHP Monolith', '/api/', process.env.PHP_PROXY_TARGET ?? '');
    this.addProxy('PHP OpenAPI Docs', '/documentation/', process.env.PHP_PROXY_TARGET ?? '')
  }

  protected addProxy (name: string, path: string, targetHost: string) {
    const sourcePath = `${path}{proxy+}`;
    if (process.env.NODE_ENV === 'development') {
      this.addLocalLambdaProxy(name, sourcePath, targetHost);
    } else {
      this.addHttpUrlProxy(name, sourcePath, `${targetHost}${path}{proxy}`);
    }
  }

  protected addLocalLambdaProxy (name: string, path: string, targetHost: string) {
    // In local development, we use SAM to synthesize our CDK API Gateway stack. However, SAM doesn't
    // support HttpUrlIntegration, so we have a lambda that is just a simple node proxy that is
    // only used locally.
    const lambdaIntegration = new HttpLambdaIntegration(
      name,
      new NodejsFunction(this, `Local Proxy: ${name}`, {
        entry: './lambda/local-proxy/index.ts',
        runtime: Runtime.NODEJS_20_X,
        handler: 'main',
        architecture: Architecture.ARM_64,
        logRetention: RetentionDays.ONE_WEEK,
        bundling: {
          externalModules: ['aws-lambda'],
          minify: true,
          define: {
            'process.env.PROXY_TARGET': JSON.stringify(targetHost),
          }
        },
      }),
    );

    this.httpApi.addRoutes({
      path: path,
      methods: [HttpMethod.ANY],
      integration: lambdaIntegration,
    })
  }

  protected addHttpUrlProxy (name: string, sourcePath: string, targetUrl: string) {
    this.httpApi.addRoutes({
      path: sourcePath,
      methods: [HttpMethod.ANY],
      integration: new HttpUrlIntegration(name, targetUrl),
    });
  }
}
