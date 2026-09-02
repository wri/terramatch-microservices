import { Construct } from "constructs";
import {
  CorsHttpMethod,
  DomainName,
  DomainNameAttributes,
  HttpApi,
  HttpApiProps,
  HttpMethod,
  IVpcLink,
  VpcLink,
  WebSocketApi,
  CfnIntegration,
  CfnRoute
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpAlbIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { ApplicationListener, IApplicationListener } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Stack, StackProps } from "aws-cdk-lib";

type ServiceDefinition = { namespaces: string[]; sockets?: string[] };
const V3_SERVICES: Record<string, ServiceDefinition> = {
  "user-service": { namespaces: ["auth", "users", "organisations", "userAssociations"], sockets: ["userSockets"] },
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
  private readonly _websocketApi: WebSocketApi;
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
    this._websocketApi = new WebSocketApi(this, `TerraMatch Websocket Gateway - ${this._env}`, {
      apiName: `TerraMatch Websocket Gateway - ${this._env}`
    });

    for (const [service, { namespaces, sockets }] of Object.entries(V3_SERVICES)) {
      if (!enabledServices.includes(service)) continue;

      this.addAlbProxy(`API Swagger Docs [${service}]`, `/${service}/documentation/{proxy+}`, service);

      for (const namespace of namespaces) {
        this.addAlbProxy(`V3 Namespace [${service}/${namespace}]`, `/${namespace}/v3/{proxy+}`, service);
      }

      for (const socket of sockets ?? []) {
        this.addWebsocketProxy(`V3 Socket [${service}/${socket}]`, `/${socket}/v3/{proxy+}`, service);
      }
    }
  }

  private _serviceListeners: Map<string, IApplicationListener> = new Map();
  private getServiceListener(service: string) {
    let serviceListener = this._serviceListeners.get(service);
    if (serviceListener == null) {
      this._serviceListeners.set(
        service,
        (serviceListener = ApplicationListener.fromLookup(this, `${service} Listener`, {
          loadBalancerTags: { service: `${service}-${this._env}` }
        }))
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
      integration: new HttpAlbIntegration(name, serviceListener, { vpcLink })
    });
  }

  private addWebsocketProxy(name: string, sourcePath: string, service: string) {
    const vpcLink = this.getVpcLink();
    const serviceListener = this.getServiceListener(service);
    const integration = new CfnIntegration(this, name, {
      apiId: this._websocketApi.apiId,
      integrationType: "HTTP_PROXY",
      integrationMethod: "ANY",
      connectionType: "VPC_LINK",
      connectionId: vpcLink.vpcLinkRef.vpcLinkId,
      integrationUri: serviceListener.listenerArn,
      requestParameters: {
        "integration.request.header.Connection": "'Upgrade'"
      }
    });

    new CfnRoute(this, "ConnectRoute", {
      apiId: this._websocketApi.apiId,
      routeKey: "$connect",
      target: `integrations/${integration.ref}`
    });
    new CfnRoute(this, "DisconnectRoute", {
      apiId: this._websocketApi.apiId,
      routeKey: "$disconnect",
      target: `integrations/${integration.ref}`
    });
    new CfnRoute(this, "DefaultRoute", {
      apiId: this._websocketApi.apiId,
      routeKey: "$default",
      target: `integrations/${integration.ref}`
    });
  }
}
