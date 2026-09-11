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
import { HttpAlbIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  ApplicationListener,
  ApplicationListenerLookupOptions,
  ApplicationProtocol,
  IApplicationListener
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Stack, StackProps } from "aws-cdk-lib";

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

const SOCKET_SERVICE = "user-service";

type ServiceDefinition = { namespaces: string[] };
const V3_SERVICES: Record<string, ServiceDefinition> = {
  "user-service": { namespaces: ["auth", "users", "organisations", "userAssociations"] },
  "job-service": { namespaces: ["jobs"] },
  "entity-service": {
    namespaces: [
      "entities",
      "trees",
      "forms",
      "applications",
      "fundingProgrammes",
      "reportingFrameworks",
      "aboutSections"
    ]
  },
  "research-service": { namespaces: ["research", "boundingBoxes", "validations", "polygonClipping"] },
  "dashboard-service": { namespaces: ["dashboard"] },
  "unified-database-service": { namespaces: ["unified-database"] }
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

export class ApiGatewayStack extends Stack {
  private readonly _httpApi: HttpApi;
  private readonly _env: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if (process.env.TM_ENV == null) throw new Error("No TM_ENV defined");
    this._env = process.env.TM_ENV ?? "local";

    const enabledServices: string[] =
      process.env.ENABLED_SERVICES == null || process.env.ENABLED_SERVICES === ""
        ? Object.keys(V3_SERVICES)
        : process.env.ENABLED_SERVICES.split(",");

    const httpApiProps: HttpApiProps = {
      apiName: `TerraMatch API Gateway - ${this._env}`,
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
        allowHeaders: ["authorization", "content-type"],
        exposeHeaders: ["content-disposition"]
      },
      disableExecuteApiEndpoint: true,
      defaultDomainMapping: {
        domainName: DomainName.fromDomainNameAttributes(
          this,
          `API Domain Name - ${this._env}`,
          DOMAIN_MAPPINGS[this._env]
        )
      }
    };

    this._httpApi = new HttpApi(this, `TerraMatch API Gateway - ${this._env}`, httpApiProps);

    for (const [service, { namespaces }] of Object.entries(V3_SERVICES)) {
      if (!enabledServices.includes(service)) continue;

      this.addAlbProxy(`API Swagger Docs [${service}]`, `/${service}/documentation/{proxy+}`, service);

      for (const namespace of namespaces) {
        this.addAlbProxy(`V3 Namespace [${service}/${namespace}]`, `/${namespace}/v3/{proxy+}`, service);
      }
    }
  }

  private _serviceListeners: Map<string, IApplicationListener> = new Map();
  private getServiceListener(service: string) {
    let serviceListener = this._serviceListeners.get(service);
    if (serviceListener == null) {
      const props: Mutable<ApplicationListenerLookupOptions> = {
        loadBalancerTags: { service: `${service}-${this._env}` }
      };
      if (service === SOCKET_SERVICE) {
        props.listenerProtocol = ApplicationProtocol.HTTPS;
      }
      this._serviceListeners.set(
        service,
        (serviceListener = ApplicationListener.fromLookup(this, `${service} Listener`, props))
      );
    }

    return serviceListener;
  }

  private _vpcLink: IVpcLink;
  private getVpcLink() {
    if (this._vpcLink == null) {
      this._vpcLink = VpcLink.fromVpcLinkAttributes(this, `vpc-link-${this._env}`, {
        vpcLinkId: "t74cf1",
        vpc: Vpc.fromLookup(this, "wri-terramatch-vpc", {
          vpcId: "vpc-0beac5973796d96b1"
        })
      });
    }

    return this._vpcLink;
  }

  private addAlbProxy(name: string, sourcePath: string, service: string) {
    const vpcLink = this.getVpcLink();
    const serviceListener = this.getServiceListener(service);
    this._httpApi.addRoutes({
      path: sourcePath,
      methods: [HttpMethod.GET, HttpMethod.DELETE, HttpMethod.POST, HttpMethod.PATCH, HttpMethod.PUT],
      integration: new HttpAlbIntegration(name, serviceListener, {
        vpcLink,
        // This turns on connection via HTTPS to the ALB. The actual subdomain does not need to match
        // because the certificate in use specifies *.terramatch.org and the server doesn't do any
        // kind of domain based routing.
        secureServerName: service === SOCKET_SERVICE ? `${service}-${this._env}.terramatch.org` : undefined
      })
    });
  }
}
