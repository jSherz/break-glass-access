import { Context } from "aws-lambda/handler";
import * as z from "zod";
import { DataStorage } from "../shared/DataStorage";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyResult,
} from "aws-lambda";
import * as crypto from "crypto";
import { IParameterStore } from "../shared/CachedSSM";
import {
  DescribeUserCommand,
  IdentitystoreClient,
} from "@aws-sdk/client-identitystore";
import { BreakGlassEvent } from "../shared/events";

const accessRequestedEvent = z
  .object({
    type: z.enum(["interactive_message"]),
    actions: z
      .array(
        z.object({
          name: z.enum(["break_glass"]),
          type: z.enum(["button"]),
          value: z.string(),
        }),
      )
      .min(1)
      .max(1),
    user: z.object({
      id: z.string(),
      name: z.string(),
    }),
    original_message: z
      .object({
        attachments: z.array(
          z
            .object({
              callback_id: z.string(),
              actions: z
                .array(
                  z.object({
                    name: z.string(),
                    type: z.string(),
                    value: z.string(),
                  }),
                )
                .min(1),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough();

const UNAUTH_RESPONSE: APIGatewayProxyResult = {
  statusCode: 403,
  body: "Forbidden.",
};

function signRequest(timestamp: string, body: string, secret: string): string {
  const hash = crypto.createHmac("sha256", secret);
  hash.update("v0:" + timestamp + ":");
  hash.update(body);
  return "v0=" + hash.digest().toString("hex");
}

export function buildAccessRequestedHandler(
  dataStorage: DataStorage,
  stateMachineArn: string,
  stepFunctionsClient: SFNClient,
  cachedSSM: IParameterStore,
  idClient: IdentitystoreClient,
  identityStoreId: string,
) {
  return async function (
    event: APIGatewayProxyEvent,
    _context: Context,
    _callback: unknown,
  ): Promise<APIGatewayProxyResult> {
    // Normalise headers
    event.headers = Object.keys(event.headers).reduce((out, curr) => {
      if (curr) {
        out[curr.toLowerCase()] = event.headers[curr];
      }
      return out;
    }, {} as APIGatewayProxyEventHeaders);

    const slackTimestampHeader = event.headers["x-slack-request-timestamp"];
    const slackSignatureHeader = event.headers["x-slack-signature"];

    console.log(event.body);

    if (!slackTimestampHeader || !slackSignatureHeader || !event.body) {
      console.log("timestamp header, signature header or body missing");

      return UNAUTH_RESPONSE;
    }

    const expected = signRequest(
      slackTimestampHeader,
      event.body,
      await cachedSSM.getParameter("/live-laugh-ship/slack-signing-secret"),
    );

    if (slackSignatureHeader !== expected) {
      console.log("slack signature verification failed");

      return UNAUTH_RESPONSE;
    }

    // TODO: check timestamp to prevent replay attacks

    const bodyParams = new URLSearchParams(event.body);
    console.log(bodyParams);
    console.log(bodyParams.get("payload"));
    const buttonEvent = accessRequestedEvent.safeParse(
      JSON.parse(bodyParams.get("payload") || ""),
    );

    if (buttonEvent.success) {
      const eventData = buttonEvent.data;

      // Use a standardised callback_id to relate the alert to the account
      const [_, accountId] =
        eventData.original_message.attachments[0].callback_id.split("_");

      const action = eventData.original_message.attachments
        .map((attachment) => {
          return attachment.actions.find((action) => {
            return (
              action.type === eventData.actions[0].type &&
              action.name === eventData.actions[0].name
            );
          });
        })
        .find((action) => !!action);

      if (!action) {
        console.log(
          `failed to find action in attachments: ${JSON.stringify(
            eventData.original_message.attachments,
          )} - actions: ${JSON.stringify(eventData.actions)}`,
        );

        return {
          statusCode: 500,
          body: "Failed to identify action.",
        };
      }

      const permissionSetArn = action.value;

      const messagingServicePrincipal = eventData.user.id;

      const principalId = await dataStorage.resolvePrincipal(
        messagingServicePrincipal,
      );

      if (!principalId) {
        throw new Error(
          `unable to resolve ${messagingServicePrincipal} into an SSO principal`,
        );
      }

      const user = await idClient.send(
        new DescribeUserCommand({
          IdentityStoreId: identityStoreId,
          UserId: principalId,
        }),
      );

      try {
        if (
          await dataStorage.userCanAccess(
            accountId,
            permissionSetArn,
            principalId,
          )
        ) {
          await stepFunctionsClient.send(
            new StartExecutionCommand({
              stateMachineArn,
              input: JSON.stringify(
                {
                  accountId,
                  permissionSetArn,
                  principalId,
                  principalUsername: user.UserName,
                } as BreakGlassEvent,
                null,
                2,
              ),
            }),
          );

          console.log(
            "breaking the glass",
            accountId,
            permissionSetArn,
            principalId,
          );

          return {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              response_type: "ephemeral",
              replace_original: false,
              text: "Glass broken - access incoming.",
            }),
          };
        } else {
          console.log(
            "user not authorised",
            accountId,
            permissionSetArn,
            principalId,
          );

          return {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              response_type: "ephemeral",
              replace_original: false,
              text: "You do not have access to this account / role.",
            }),
          };
        }
      } catch (err) {
        console.log("could not start flow", err);

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            response_type: "ephemeral",
            replace_original: false,
            text: "An unknown error occurred. CALL THAT PAGER!",
          }),
        };
      }
    } else {
      console.log("not an event we can handle", buttonEvent.error);

      // Ensure Slack does not retry as we can't handle it regardless
      return {
        statusCode: 200,
        body: "",
      };
    }
  };
}
