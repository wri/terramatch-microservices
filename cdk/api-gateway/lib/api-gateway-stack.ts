import { Construct } from "constructs";
import {
  CorsHttpMethod,
  DomainName,
  DomainNameAttributes,
  HttpApi,
  HttpApiProps,
  HttpMethod,
  IVpcLink,
  VpcLink
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpAlbIntegration, HttpUrlIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { ApplicationListener, IApplicationListener } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Stack, StackProps } from "aws-cdk-lib";
import * as process from "node:process";

const V3_SERVICES = {
  "user-service": ["auth", "users", "organisations"],
  "job-service": ["jobs"],
  "entity-service": ["entities", "trees"],
  "research-service": ["research", "boundingBoxes"],
  "dashboard-service": ["dashboard"],
  "unified-database-service": ["unified-database"]
};

const DOMAIN_MAPPINGS: Record<string, DomainNameAttributes> = {
  test: {
    name: "api-test.terramatch.org",
    regionalDomainName: "d-7wg2eazpki.execute-api.eu-west-1.amazonaws.com",
    regionalHostedZoneId: "ZLY8HYME6SFDD"
  },
  dev: {
    name: "api-dev.terramatch.org",
    regionalDomainName: "d-p4wtcekqfd.execute-api.eu-west-1.amazonaws.com",
    regionalHostedZoneId: "ZLY8HYME6SFDD"
  },
  staging: {
    name: "api-staging.terramatch.org",
    regionalDomainName: "d-lwwcq09sse.execute-api.eu-west-1.amazonaws.com",
    regionalHostedZoneId: "ZLY8HYME6SFDD"
  },
  prod: {
    name: "api.terramatch.org",
    regionalDomainName: "d-6bkz3xwm7k.execute-api.eu-west-1.amazonaws.com",
    regionalHostedZoneId: "ZLY8HYME6SFDD"
  }
};

type AddProxyProps = { targetHost: string; service?: never } | { targetHost?: never; service: string };

export class ApiGatewayStack extends Stack {
  private readonly httpApi: HttpApi;
  private readonly env: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (process.env.TM_ENV == null) throw new Error("No TM_ENV defined");
    this.env = process.env.TM_ENV ?? "local";

    const enabledServices =
      process.env.ENABLED_SERVICES == null || process.env.ENABLED_SERVICES === ""
        ? Object.keys(V3_SERVICES)
        : process.env.ENABLED_SERVICES.split(",");

    const httpApiProps: HttpApiProps = {
      apiName: `TerraMatch API Gateway - ${this.env}`,
      corsPreflight: {
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.PUT,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.OPTIONS
        ],
        allowOrigins: ["*"],
        allowHeaders: ["authorization", "content-type"]
      },
      disableExecuteApiEndpoint: true,
      defaultDomainMapping: {
        domainName: DomainName.fromDomainNameAttributes(
          this,
          `API Domain Name - ${this.env}`,
          DOMAIN_MAPPINGS[this.env]
        )
      }
    };

    this.httpApi = new HttpApi(this, `TerraMatch API Gateway - ${this.env}`, httpApiProps);

    for (const [service, namespaces] of Object.entries(V3_SERVICES)) {
      if (!enabledServices.includes(service)) continue;

      this.addProxy(`API Swagger Docs [${service}]`, `/${service}/documentation/`, { service });

      for (const namespace of namespaces) {
        this.addProxy(`V3 Namespace [${service}/${namespace}]`, `/${namespace}/v3/`, { service });
      }
    }

    // The PHP Monolith proxy keeps `/api/` in its path to avoid conflict with the newer
    // namespace-driven design of the v3 API space, and to minimize disruption with existing
    // consumers (like Greenhouse and the web TM frontend) as we migrate to this API Gateway.
    this.addProxy("PHP Monolith", "/api/", { targetHost: process.env.PHP_PROXY_TARGET ?? "" });
    this.addProxy("PHP OpenAPI Docs", "/documentation/", { targetHost: process.env.PHP_PROXY_TARGET ?? "" });
    this.addProxy("PHP Images", "/images/", { targetHost: process.env.PHP_PROXY_TARGET ?? "" });
  }

  private addProxy(name: string, path: string, { targetHost, service }: AddProxyProps) {
    const sourcePath = `${path}{proxy+}`;
    if (targetHost == null) {
      this.addAlbProxy(name, sourcePath, service);
    } else {
      this.addHttpUrlProxy(name, sourcePath, `${targetHost}${path}{proxy}`);
    }
  }

  private addHttpUrlProxy(name: string, sourcePath: string, targetUrl: string) {
    this.httpApi.addRoutes({
      path: sourcePath,
      methods: [HttpMethod.GET, HttpMethod.DELETE, HttpMethod.POST, HttpMethod.PATCH, HttpMethod.PUT],
      integration: new HttpUrlIntegration(name, targetUrl)
    });
  }

  private _serviceListeners: Map<string, IApplicationListener> = new Map();
  private _vpcLink: IVpcLink;
  private addAlbProxy(name: string, sourcePath: string, service: string) {
    if (this._vpcLink == null) {
      this._vpcLink = VpcLink.fromVpcLinkAttributes(this, `vpc-link-${this.env}`, {
        vpcLinkId: "t74cf1",
        vpc: Vpc.fromLookup(this, "wri-terramatch-vpc", {
          vpcId: "vpc-0beac5973796d96b1"
        })
      });
    }

    let serviceListener = this._serviceListeners.get(service);
    if (serviceListener == null) {
      this._serviceListeners.set(
        service,
        (serviceListener = ApplicationListener.fromLookup(this, `${service} Listener`, {
          loadBalancerTags: { service: `${service}-${this.env}` }
        }))
      );
    }

    this.httpApi.addRoutes({
      path: sourcePath,
      methods: [HttpMethod.GET, HttpMethod.DELETE, HttpMethod.POST, HttpMethod.PATCH, HttpMethod.PUT],
      integration: new HttpAlbIntegration(name, serviceListener, { vpcLink: this._vpcLink })
    });
  }
}
