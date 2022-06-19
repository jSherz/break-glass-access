import { Context } from "aws-lambda/handler";
import {
  CreateAccountAssignmentCommand,
  SSOAdminClient,
  UpdatePermissionSetCommand,
} from "@aws-sdk/client-sso-admin";
import * as z from "zod";
import { DataStorage } from "../shared/DataStorage";

const grantAccessEvent = z
  .object({
    accountId: z.string(),
    role: z.string(),
    principal: z.string(),
  })
  .passthrough();

type GrantAccessEvent = z.infer<typeof grantAccessEvent>;

export function buildGrantAccessHandler(
  ssoClient: SSOAdminClient,
  instanceArn: string,
) {
  return async function (
    rawEvent: unknown,
    context: Context,
    callback: unknown,
  ): Promise<void> {
    const event = grantAccessEvent.parse(rawEvent);

    await ssoClient.send(
      new CreateAccountAssignmentCommand({
        InstanceArn: instanceArn,
        PermissionSetArn: event.role,
        PrincipalType: "USER",
        PrincipalId: event.principal,
        TargetId: event.accountId,
        TargetType: "AWS_ACCOUNT",
      }),
    );

    console.log("assigned access");
  };
}
