import { Construct } from 'constructs';
import {
  CorsHttpMethod,
  DomainName,
  DomainNameAttributes,
  HttpApi,
  HttpApiProps,
  HttpMethod,
  IVpcLink,
  VpcLink,
} from 'aws-cdk-lib/aws-apigatewayv2';
import {
  HttpAlbIntegration,
  HttpLambdaIntegration,
  HttpUrlIntegration,
} from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  ApplicationListener,
  IApplicationListener,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Stack, StackProps } from 'aws-cdk-lib';

const IS_DEV =
  process.env.NODE_ENV == null || process.env.NODE_ENV === 'development';

const V3_SERVICES = {
  'user-service': {
    targetHost: process.env.USER_SERVICE_PROXY_TARGET ?? '',
    namespaces: ['auth', 'users']
  },
  'job-service': {
    targetHost: process.env.JOB_SERVICE_PROXY_TARGET ?? '',
    namespaces: ['jobs']
  },
  'research-service': {
    targetHost: process.env.RESEARCH_SERVICE_PROXY_TARGET ?? '',
    namespaces: ['research']
  }
}

const DOMAIN_MAPPINGS: Record<string, DomainNameAttributes> = {
  test: {
    name: 'api-test.terramatch.org',
    regionalDomainName: 'd-7wg2eazpki.execute-api.eu-west-1.amazonaws.com',
    regionalHostedZoneId: 'ZLY8HYME6SFDD',
  },
  dev: {
    name: 'api-dev.terramatch.org',
    regionalDomainName: 'd-p4wtcekqfd.execute-api.eu-west-1.amazonaws.com',
    regionalHostedZoneId: 'ZLY8HYME6SFDD',
  },
  staging: {
    name: 'api-staging.terramatch.org',
    regionalDomainName: 'd-lwwcq09sse.execute-api.eu-west-1.amazonaws.com',
    regionalHostedZoneId: 'ZLY8HYME6SFDD'
  },
  prod: {
    name: 'api.terramatch.org',
    regionalDomainName: 'd-6bkz3xwm7k.execute-api.eu-west-1.amazonaws.com',
    regionalHostedZoneId: 'ZLY8HYME6SFDD'
  }
}

type MutableHttpApiProps = {
  -readonly [K in keyof HttpApiProps]: HttpApiProps[K]
}

type AddProxyProps = { targetHost: string, service?: never } | { targetHost?: never, service: string };

export class ApiGatewayStack extends Stack {
  private readonly httpApi: HttpApi;
  private readonly env: string;

  constructor (scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (!IS_DEV && process.env.TM_ENV == null) throw new Error('No TM_ENV defined');
    this.env = process.env.TM_ENV ?? 'local';

    const httpApiProps: MutableHttpApiProps = {
      apiName: `TerraMatch API Gateway - ${this.env}`,
      corsPreflight: {
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.PUT,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"],
        allowHeaders: ['authorization', 'content-type'],
      },
    }
    if (!IS_DEV) {
      httpApiProps.disableExecuteApiEndpoint = true;
      httpApiProps.defaultDomainMapping = {
        domainName: DomainName.fromDomainNameAttributes(
          this,
          `API Domain Name - ${this.env}`,
          DOMAIN_MAPPINGS[this.env]
        )
      };
    }

    this.httpApi = new HttpApi(this, `TerraMatch API Gateway - ${this.env}`, httpApiProps);

    for (const [service, { targetHost, namespaces }] of Object.entries(V3_SERVICES)) {
      const props: AddProxyProps = IS_DEV ? { targetHost } : { service };
      this.addProxy(`API Swagger Docs [${service}]`, `/${service}/documentation/`, props);

      for (const namespace of namespaces) {
        this.addProxy(`V3 Namespace [${service}/${namespace}]`, `/${namespace}/v3/`, props);
      }
    }

    // The PHP Monolith proxy keeps `/api/` in its path to avoid conflict with the newer
    // namespace-driven design of the v3 API space, and to minimize disruption with existing
    // consumers (like Greenhouse and the web TM frontend) as we migrate to this API Gateway.
    this.addProxy('PHP Monolith', '/api/', { targetHost: process.env.PHP_PROXY_TARGET ?? '' });
    this.addProxy('PHP OpenAPI Docs', '/documentation/', { targetHost: process.env.PHP_PROXY_TARGET ?? '' });
  }

  private addProxy (name: string, path: string, { targetHost, service }: AddProxyProps) {
    const sourcePath = `${path}{proxy+}`;
    if (IS_DEV) {
      if (targetHost == null) throw new Error(`Missing target host for local dev [${name}, ${path}]`);
      this.addLocalLambdaProxy(name, sourcePath, targetHost);
    } else {
      if (targetHost == null) {
        this.addAlbProxy(name, sourcePath, service);
      } else {
        this.addHttpUrlProxy(name, sourcePath, `${targetHost}${path}{proxy}`);
      }
    }
  }

  private addLocalLambdaProxy (name: string, path: string, targetHost: string) {
    // In local development, we use SAM to synthesize our CDK API Gateway stack. However, SAM doesn't
    // support HttpUrlIntegration, so we have a lambda that is just a simple node proxy that is
    // only used locally.

    // For some reason, ARM_64 stopped working on Github actions, but X86_64 is noticeably slower
    // locally (on a modern Mac; folks on Windows might want to go ahead and use X86). Therefore, we
    // allow switching the arch type by env variable
    const architecture = process.env.ARCH === 'X86'
      ? Architecture.X86_64
      : Architecture.ARM_64;

    const lambdaIntegration = new HttpLambdaIntegration(
      name,
      new NodejsFunction(this, `Local Proxy: ${name}`, {
        entry: './lambda/local-proxy/index.js',
        runtime: Runtime.NODEJS_20_X,
        handler: 'main',
        architecture,
        logRetention: RetentionDays.ONE_WEEK,
        bundling: {
          externalModules: ['aws-lambda'],
          define: {
            'process.env.PROXY_TARGET': JSON.stringify(targetHost),
          }
        },
      }),
    );

    this.httpApi.addRoutes({
      path: path,
      methods: [HttpMethod.GET, HttpMethod.DELETE, HttpMethod.POST, HttpMethod.PATCH, HttpMethod.PUT],
      integration: lambdaIntegration,
    })
  }

  private addHttpUrlProxy (name: string, sourcePath: string, targetUrl: string) {
    this.httpApi.addRoutes({
      path: sourcePath,
      methods: [HttpMethod.GET, HttpMethod.DELETE, HttpMethod.POST, HttpMethod.PATCH, HttpMethod.PUT],
      integration: new HttpUrlIntegration(name, targetUrl),
    });
  }

  private _serviceListeners: Map<string, IApplicationListener> = new Map();
  private _vpcLink :IVpcLink;
  private addAlbProxy (name: string, sourcePath: string, service: string) {
    if (this._vpcLink == null) {
      this._vpcLink = VpcLink.fromVpcLinkAttributes(this, `vpc-link-${this.env}`, {
        vpcLinkId: 't74cf1',
        vpc: Vpc.fromLookup(this, 'wri-terramatch-vpc', {
          vpcId: 'vpc-0beac5973796d96b1',
        })
      });
    }

    let serviceListener = this._serviceListeners.get(service);
    if (serviceListener == null) {
      this._serviceListeners.set(service, serviceListener = ApplicationListener.fromLookup(
        this,
        `${service} Listener`,
        { loadBalancerTags: { service: `${service}-${this.env}` } }
      ));
    }

    this.httpApi.addRoutes({
      path: sourcePath,
      methods: [HttpMethod.GET, HttpMethod.DELETE, HttpMethod.POST, HttpMethod.PATCH, HttpMethod.PUT],
      integration: new HttpAlbIntegration(name, serviceListener, { vpcLink: this._vpcLink })
    })
  }
}
