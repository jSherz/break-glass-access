import { Context } from "aws-lambda/handler";
import * as z from "zod";
import { DataStorage } from "../shared/DataStorage";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as crypto from "crypto";
import { IParameterStore } from "../shared/CachedSSM";

const accessRequestedEvent = z
  .object({
    type: z.enum(["interactive_message"]),
    actions: z.array(
      z.object({
        name: z.enum(["break_glass"]),
        type: z.enum(["button"]),
        value: z.string(),
      }),
    ),
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
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough();

type AccessRequestedEvent = z.infer<typeof accessRequestedEvent>;

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
) {
  return async function (
    event: APIGatewayProxyEvent,
    context: Context,
    callback: unknown,
  ): Promise<APIGatewayProxyResult> {
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

      // This could come from the button name etc
      const role = "break-glass-production";

      const messagingServicePrincipal = eventData.user.id;

      const principal = await dataStorage.resolvePrincipal(
        messagingServicePrincipal,
      );

      if (!principal) {
        throw new Error(
          `unable to resolve ${messagingServicePrincipal} into an SSO principal`,
        );
      }

      try {
        if (await dataStorage.userCanAccess(accountId, role, principal)) {
          await stepFunctionsClient.send(
            new StartExecutionCommand({
              stateMachineArn,
              input: JSON.stringify(
                {
                  accountId,
                  role,
                  principal,
                },
                null,
                2,
              ),
            }),
          );

          console.log("breaking the glass", accountId, role, principal);

          return {
            statusCode: 200,
            body: JSON.stringify({
              response_type: "ephemeral",
              replace_original: false,
              text: "Glass broken - access incoming.",
            }),
          };
        } else {
          console.log("user not authorised", accountId, role, principal);

          return {
            statusCode: 200,
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
