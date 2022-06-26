import { URLSearchParams } from "url";
import { APIGatewayProxyEvent } from "aws-lambda";
import crypto from "crypto";
import {
  CreateStateMachineCommand,
  DeleteStateMachineCommand,
  DescribeExecutionCommand,
  ListExecutionsCommand,
  ListExecutionsCommandOutput,
  SFNClient,
} from "@aws-sdk/client-sfn";
import { buildAccessRequestedHandler } from "./access-requested";
import { InMemoryParameterStore } from "../shared/InMemoryParameterStore";
import { InMemoryDataStorage } from "../shared/InMemoryDataStorage";
import {
  CreateRoleCommand,
  DeleteRoleCommand,
  IAMClient,
} from "@aws-sdk/client-iam";

const VALID_SLACK_EVENT = {
  type: "interactive_message",
  actions: [
    {
      name: "break_glass",
      type: "button",
      value: "break_glass",
    },
  ],
  callback_id: "deployment_abc",
  team: {
    id: "...",
    domain: "my-slack",
  },
  channel: {
    id: "...",
    name: "deployments",
  },
  user: {
    id: "...",
    name: "james",
  },
  action_ts: "....398689",
  message_ts: "....688119",
  attachment_id: "1",
  token: "...",
  is_app_unfurl: false,
  enterprise: null,
  is_enterprise_install: false,
  original_message: {
    bot_id: "...",
    type: "message",
    text: "",
    user: "...",
    ts: "....688119",
    app_id: "...",
    team: "...",
    bot_profile: {
      id: "...",
      deleted: false,
      name: "Live Laugh Ship",
      updated: 1655666115,
      app_id: "...",
      icons: {
        image_36: "https://avatars.slack-edge.com/2022-06-19/3..._36.png",
        image_48: "https://avatars.slack-edge.com/2022-06-19/3..._48.png",
        image_72: "https://avatars.slack-edge.com/2022-06-19/3..._72.png",
      },
      team_id: "...",
    },
    attachments: [
      {
        id: 1,
        color: "fc6f03",
        fallback: "Deployment ABC is being rolled back.",
        text: "Deployment *ABC* is being rolled back.",
        callback_id: "deployment_abc",
        actions: [
          {
            id: "1",
            name: "retry",
            text: "Retry",
            type: "button",
            value: "retry",
            style: "",
          },
          {
            id: "2",
            name: "break_glass",
            text: "Break Glass Prod",
            type: "button",
            value: "break_glass",
            style: "danger",
            confirm: {
              text: "Are you sure?",
              title: "Are you sure?",
              ok_text: "Yes",
              dismiss_text: "No",
            },
          },
        ],
      },
    ],
  },
  response_url: "https://hooks.slack.com/actions/...",
  trigger_id: "367507467...8c7ae44f2e6a3a",
};

const API_GATEWAY_EVENT: APIGatewayProxyEvent = {
  resource: "/test",
  path: "/test",
  httpMethod: "POST",
  headers: {
    Accept: "*/*",
    "CloudFront-Forwarded-Proto": "https",
    "CloudFront-Is-Desktop-Viewer": "true",
    "CloudFront-Is-Mobile-Viewer": "false",
    "CloudFront-Is-SmartTV-Viewer": "false",
    "CloudFront-Is-Tablet-Viewer": "false",
    "CloudFront-Viewer-ASN": "2856",
    "CloudFront-Viewer-Country": "GB",
    "content-type": "application/x-www-form-urlencoded",
    Host: "myapi.execute-api.eu-west-1.amazonaws.com",
    "User-Agent": "insomnia/2022.3.0",
    Via: "2.0 myapi.cloudfront.net (CloudFront)",
    "X-Amz-Cf-Id": "vwpBrvcE3C09LuRK0LxyiY_gSimrwyqO6qNU2XthyF9F6RPYlhoOiQ==",
    "X-Amzn-Trace-Id": "Root=1-62b8b1b0-504723ed4bc83ca533e3a6f4",
    "X-Forwarded-For": "123.123.123.123, 124.124.124.124",
    "X-Forwarded-Port": "443",
    "X-Forwarded-Proto": "https",
  },
  multiValueHeaders: {
    Accept: ["*/*"],
    "CloudFront-Forwarded-Proto": ["https"],
    "CloudFront-Is-Desktop-Viewer": ["true"],
    "CloudFront-Is-Mobile-Viewer": ["false"],
    "CloudFront-Is-SmartTV-Viewer": ["false"],
    "CloudFront-Is-Tablet-Viewer": ["false"],
    "CloudFront-Viewer-ASN": ["2856"],
    "CloudFront-Viewer-Country": ["GB"],
    "content-type": ["application/x-www-form-urlencoded"],
    Host: ["myapi.execute-api.eu-west-1.amazonaws.com"],
    "User-Agent": ["insomnia/2022.3.0"],
    Via: ["2.0 myapi.cloudfront.net (CloudFront)"],
    "X-Amz-Cf-Id": ["vwpBrvcE3C09LuRK0LxyiY_gSimrwyqO6qNU2XthyF9F6RPYlhoOiQ=="],
    "X-Amzn-Trace-Id": ["Root=1-62b8b1b0-504723ed4bc83ca533e3a6f4"],
    "X-Forwarded-For": ["123.123.123.123, 124.124.124.124"],
    "X-Forwarded-Port": ["443"],
    "X-Forwarded-Proto": ["https"],
  },
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  pathParameters: null,
  stageVariables: null,
  requestContext: {
    authorizer: null,
    resourceId: "bzskpg",
    resourcePath: "/test",
    httpMethod: "POST",
    extendedRequestId: "UWCzoEypjoEFSyQ=",
    requestTime: "26/Jun/2022:19:21:20 +0000",
    path: "/prod/test",
    accountId: "123456789012",
    protocol: "HTTP/1.1",
    stage: "prod",
    domainPrefix: "myapi",
    requestTimeEpoch: 1656271280671,
    requestId: "3b816d62-f4b2-435c-84ab-9d473ce4603c",
    identity: {
      cognitoIdentityPoolId: null,
      accountId: null,
      cognitoIdentityId: null,
      caller: null,
      sourceIp: "123.123.123.123",
      principalOrgId: null,
      accessKey: null,
      cognitoAuthenticationType: null,
      cognitoAuthenticationProvider: null,
      userArn: null,
      userAgent: "insomnia/2022.3.0",
      user: null,
      apiKey: null,
      apiKeyId: null,
      clientCert: null,
    },
    domainName: "myapi.execute-api.eu-west-1.amazonaws.com",
    apiId: "myapi",
  },
  body: "test=foo",
  isBase64Encoded: false,
};

function buildHandler(
  stateMachineArn: string,
  sfnClient: SFNClient,
): {
  paramStore: InMemoryParameterStore;
  dataStorage: InMemoryDataStorage;
  handler: ReturnType<typeof buildAccessRequestedHandler>;
} {
  const paramStore = new InMemoryParameterStore();

  const dataStorage = new InMemoryDataStorage();

  const handler = buildAccessRequestedHandler(
    dataStorage,
    stateMachineArn,
    sfnClient,
    paramStore,
    {
      userIdToUserName(): Promise<string> {
        return Promise.resolve("foo");
      },
    },
  );

  return {
    paramStore,
    dataStorage,
    handler,
  };
}

describe("access-requested", () => {
  const sfnName = `break-glass-access-integration-tests-${crypto
    .randomBytes(8)
    .toString("hex")}`;

  const sfnClient = new SFNClient({});

  const iamClient = new IAMClient({});

  let sfnArn = "";
  let roleArn = "";

  beforeAll(async () => {
    const iamResponse = await iamClient.send(
      new CreateRoleCommand({
        RoleName: sfnName,
        AssumeRolePolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "states.amazonaws.com",
              },
              Action: "sts:AssumeRole",
            },
          ],
        }),
      }),
    );

    roleArn = iamResponse.Role!.Arn!;

    const response = await sfnClient.send(
      new CreateStateMachineCommand({
        name: sfnName,
        definition: JSON.stringify({
          Comment: "A description of my state machine",
          StartAt: "Success",
          States: {
            Success: {
              Type: "Succeed",
            },
          },
        }),
        roleArn,
      }),
    );

    sfnArn = response.stateMachineArn!;
  });

  afterAll(async () => {
    if (sfnArn) {
      await sfnClient.send(
        new DeleteStateMachineCommand({
          stateMachineArn: sfnArn,
        }),
      );
    }

    await iamClient.send(
      new DeleteRoleCommand({
        RoleName: sfnName,
      }),
    );
  });

  describe("handler", () => {
    describe("when the timestamp header is missing", () => {
      it("returns an unauthorised response", async () => {
        const { handler } = buildHandler(sfnArn, sfnClient);

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-signature": "foo",
          },
          body: "blah",
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          statusCode: 403,
          body: "Forbidden.",
        });
      });
    });

    describe("when the signature header is missing", () => {
      it("returns an unauthorised response", async () => {
        const { handler } = buildHandler(sfnArn, sfnClient);

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-request-timestamp": "12345",
          },
          body: "blah",
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          statusCode: 403,
          body: "Forbidden.",
        });
      });
    });

    describe("when the event has no body", () => {
      it("returns an unauthorised response", async () => {
        const { handler } = buildHandler(sfnArn, sfnClient);

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-request-timestamp": "123123",
            "x-slack-signature": "foo",
          },
          body: null,
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          statusCode: 403,
          body: "Forbidden.",
        });
      });
    });

    describe("when the signature does not match", () => {
      it("returns an unauthorised response", async () => {
        const { handler, paramStore } = buildHandler(sfnArn, sfnClient);

        paramStore.setParameter("/live-laugh-ship/slack-signing-secret", "foo");

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-request-timestamp": "123123",
            "x-slack-signature": "foo",
          },
          body: "blah123",
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          statusCode: 403,
          body: "Forbidden.",
        });
      });
    });

    describe("when the event body is not a form data string", () => {
      it("returns an empty 200 response", async () => {
        const { handler, paramStore } = buildHandler(sfnArn, sfnClient);

        const body = JSON.stringify({ a: "lemons" });
        const timestamp = "123123";
        const secret = "my-secret";

        paramStore.setParameter(
          "/live-laugh-ship/slack-signing-secret",
          secret,
        );

        const hash = crypto.createHmac("sha256", secret);
        hash.update("v0:" + timestamp + ":");
        hash.update(body);
        const signature = "v0=" + hash.digest().toString("hex");

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-request-timestamp": timestamp,
            "x-slack-signature": signature,
          },
          body,
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          body: JSON.stringify({
            response_type: "ephemeral",
            replace_original: false,
            text: "Failed to handle Slack's webhook - check the app's logs.",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          statusCode: 200,
        });
      });
    });

    describe("when the body is form data but has no payload", () => {
      it("returns an empty 200 response", async () => {
        const { handler, paramStore } = buildHandler(sfnArn, sfnClient);

        const body = new URLSearchParams({ foo: "bar" }).toString();
        const timestamp = "123123";
        const secret = "my-secret";

        paramStore.setParameter(
          "/live-laugh-ship/slack-signing-secret",
          secret,
        );

        const hash = crypto.createHmac("sha256", secret);
        hash.update("v0:" + timestamp + ":");
        hash.update(body);
        const signature = "v0=" + hash.digest().toString("hex");

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-request-timestamp": timestamp,
            "x-slack-signature": signature,
          },
          body,
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          body: JSON.stringify({
            response_type: "ephemeral",
            replace_original: false,
            text: "Failed to handle Slack's webhook - check the app's logs.",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          statusCode: 200,
        });
      });
    });

    describe("when the event body is form data with a payload that doesn't match our event", () => {
      it("returns an empty 200 response", async () => {
        const { handler, paramStore } = buildHandler(sfnArn, sfnClient);

        const body = new URLSearchParams({
          payload: JSON.stringify({ some: "JSON" }),
        }).toString();
        const timestamp = "123123";
        const secret = "my-secret";

        paramStore.setParameter(
          "/live-laugh-ship/slack-signing-secret",
          secret,
        );

        const hash = crypto.createHmac("sha256", secret);
        hash.update("v0:" + timestamp + ":");
        hash.update(body);
        const signature = "v0=" + hash.digest().toString("hex");

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-request-timestamp": timestamp,
            "x-slack-signature": signature,
          },
          body,
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          body: JSON.stringify({
            response_type: "ephemeral",
            replace_original: false,
            text: "Failed to handle Slack's webhook - check the app's logs.",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          statusCode: 200,
        });
      });
    });

    describe("when the event body has an action not in the attachments", () => {
      it("returns a 500 response", async () => {
        const { handler, paramStore, dataStorage } = buildHandler(
          sfnArn,
          sfnClient,
        );
        const userId = crypto.randomBytes(8).toString("hex");
        const ssoPrincipalId =
          "sso-principal-" + crypto.randomBytes(8).toString("hex");

        const webhook = {
          ...VALID_SLACK_EVENT,
          user: {
            id: userId,
            name: "unused",
          },
          original_message: {
            ...VALID_SLACK_EVENT.original_message,
            attachments: [
              {
                ...VALID_SLACK_EVENT.original_message.attachments[0],
                actions: [
                  {
                    id: "1",
                    name: "unknown",
                    text: "Blah",
                    type: "button",
                    value: "foo",
                    style: "",
                  },
                ],
              },
            ],
          },
        };

        dataStorage.definePrincipal(userId, ssoPrincipalId);

        dataStorage.defineUserAccess(
          "abc",
          "break_glass",
          ssoPrincipalId,
          true,
        );

        const body = new URLSearchParams({
          payload: JSON.stringify(webhook),
        }).toString();
        const timestamp = "123123";
        const secret = "my-secret";

        paramStore.setParameter(
          "/live-laugh-ship/slack-signing-secret",
          secret,
        );

        const hash = crypto.createHmac("sha256", secret);
        hash.update("v0:" + timestamp + ":");
        hash.update(body);
        const signature = "v0=" + hash.digest().toString("hex");

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-request-timestamp": timestamp,
            "x-slack-signature": signature,
          },
          body,
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          body: "Failed to identify action.",
          statusCode: 500,
        });
      });
    });

    describe("if the user's principal is not configured", () => {
      it("returns an ephemeral error message back to the user", async () => {
        const { handler, paramStore } = buildHandler(sfnArn, sfnClient);

        const userId = crypto.randomBytes(8).toString("hex");

        const webhook = {
          ...VALID_SLACK_EVENT,
          user: {
            id: userId,
            name: "unused",
          },
        };

        const body = new URLSearchParams({
          payload: JSON.stringify(webhook),
        }).toString();
        const timestamp = "123123";
        const secret = "my-secret";

        paramStore.setParameter(
          "/live-laugh-ship/slack-signing-secret",
          secret,
        );

        const hash = crypto.createHmac("sha256", secret);
        hash.update("v0:" + timestamp + ":");
        hash.update(body);
        const signature = "v0=" + hash.digest().toString("hex");

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-request-timestamp": timestamp,
            "x-slack-signature": signature,
          },
          body,
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          body: JSON.stringify({
            response_type: "ephemeral",
            replace_original: false,
            text: `We could not match your user ID ${userId} with an AWS SSO principal - ask for the mapping to be created in this app's data store.`,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          statusCode: 200,
        });
      });
    });

    describe("if the user cannot access their chosen permission set", () => {
      it("returns an ephemeral", async () => {
        const { handler, paramStore, dataStorage } = buildHandler(
          sfnArn,
          sfnClient,
        );

        const userId = crypto.randomBytes(8).toString("hex");
        const ssoPrincipalId =
          "sso-principal-" + crypto.randomBytes(8).toString("hex");

        const webhook = {
          ...VALID_SLACK_EVENT,
          user: {
            id: userId,
            name: "unused",
          },
        };

        dataStorage.definePrincipal(userId, ssoPrincipalId);

        const body = new URLSearchParams({
          payload: JSON.stringify(webhook),
        }).toString();
        const timestamp = "123123";
        const secret = "my-secret";

        paramStore.setParameter(
          "/live-laugh-ship/slack-signing-secret",
          secret,
        );

        const hash = crypto.createHmac("sha256", secret);
        hash.update("v0:" + timestamp + ":");
        hash.update(body);
        const signature = "v0=" + hash.digest().toString("hex");

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-request-timestamp": timestamp,
            "x-slack-signature": signature,
          },
          body,
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          body: JSON.stringify({
            response_type: "ephemeral",
            replace_original: false,
            text: `You do not have access to this account / role.`,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          statusCode: 200,
        });
      });
    });

    it("starts the break glass Step Function", async () => {
      const { handler, paramStore, dataStorage } = buildHandler(
        sfnArn,
        sfnClient,
      );

      const userId = crypto.randomBytes(8).toString("hex");
      const ssoPrincipalId =
        "sso-principal-" + crypto.randomBytes(8).toString("hex");

      const webhook = {
        ...VALID_SLACK_EVENT,
        user: {
          id: userId,
          name: "unused",
        },
      };

      dataStorage.definePrincipal(userId, ssoPrincipalId);

      dataStorage.defineUserAccess("abc", "break_glass", ssoPrincipalId, true);

      const body = new URLSearchParams({
        payload: JSON.stringify(webhook),
      }).toString();
      const timestamp = "123123";
      const secret = "my-secret";

      paramStore.setParameter("/live-laugh-ship/slack-signing-secret", secret);

      const hash = crypto.createHmac("sha256", secret);
      hash.update("v0:" + timestamp + ":");
      hash.update(body);
      const signature = "v0=" + hash.digest().toString("hex");

      const event: APIGatewayProxyEvent = {
        ...API_GATEWAY_EVENT,
        headers: {
          ...API_GATEWAY_EVENT.headers,
          "x-slack-request-timestamp": timestamp,
          "x-slack-signature": signature,
        },
        body,
      };

      await expect(handler(event, {} as any, {})).resolves.toEqual({
        body: JSON.stringify({
          response_type: "ephemeral",
          replace_original: false,
          text: "Glass broken - check the AWS SSO account list. This may take a few seconds.",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        statusCode: 200,
      });

      let sfnExecutions: ListExecutionsCommandOutput = {} as any;

      for (let attempt = 1; attempt <= 5; attempt++) {
        sfnExecutions = await sfnClient.send(
          new ListExecutionsCommand({
            stateMachineArn: sfnArn,
          }),
        );

        try {
          expect(sfnExecutions.executions).toHaveLength(1);
        } catch (err) {
          if (attempt === 5) {
            throw err;
          } else {
            await new Promise((resolve) => setTimeout(resolve, attempt * 50));
          }
        }
      }

      const executionArn = sfnExecutions.executions?.[0].executionArn;

      const execution = await sfnClient.send(
        new DescribeExecutionCommand({
          executionArn,
        }),
      );

      expect(execution.input).toMatch(/^{/);
      expect(JSON.parse(execution.input!)).toEqual({
        accountId: "abc",
        permissionSetArn: "break_glass",
        principalId: ssoPrincipalId,
        principalUsername: "foo",
      });
    });

    describe("when starting the step function fails", () => {
      it("returns a descriptive ephemeral message to the user", async () => {
        const { handler, paramStore, dataStorage } = buildHandler(
          sfnArn + "fail",
          sfnClient,
        );

        const userId = crypto.randomBytes(8).toString("hex");
        const ssoPrincipalId =
          "sso-principal-" + crypto.randomBytes(8).toString("hex");

        const webhook = {
          ...VALID_SLACK_EVENT,
          user: {
            id: userId,
            name: "unused",
          },
        };

        dataStorage.definePrincipal(userId, ssoPrincipalId);

        dataStorage.defineUserAccess(
          "abc",
          "break_glass",
          ssoPrincipalId,
          true,
        );

        const body = new URLSearchParams({
          payload: JSON.stringify(webhook),
        }).toString();
        const timestamp = "123123";
        const secret = "my-secret";

        paramStore.setParameter(
          "/live-laugh-ship/slack-signing-secret",
          secret,
        );

        const hash = crypto.createHmac("sha256", secret);
        hash.update("v0:" + timestamp + ":");
        hash.update(body);
        const signature = "v0=" + hash.digest().toString("hex");

        const event: APIGatewayProxyEvent = {
          ...API_GATEWAY_EVENT,
          headers: {
            ...API_GATEWAY_EVENT.headers,
            "x-slack-request-timestamp": timestamp,
            "x-slack-signature": signature,
          },
          body,
        };

        await expect(handler(event, {} as any, {})).resolves.toEqual({
          body: JSON.stringify({
            response_type: "ephemeral",
            replace_original: false,
            text: "An unknown error occurred. CALL THAT PAGER!",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          statusCode: 200,
        });
      });
    });
  });
});
