import { Context } from "aws-lambda/handler";
import {
  CreateAccountAssignmentCommand,
  DeleteAccountAssignmentCommand,
  SSOAdminClient,
  UpdatePermissionSetCommand,
} from "@aws-sdk/client-sso-admin";
import * as z from "zod";
import { DataStorage } from "../shared/DataStorage";

const revokeAccessEvent = z
  .object({
    accountId: z.string(),
    role: z.string(),
    principal: z.string(),
  })
  .passthrough();

type RevokeAccessEvent = z.infer<typeof revokeAccessEvent>;

export function buildRevokeAccessHandler(
  ssoClient: SSOAdminClient,
  instanceArn: string,
) {
  return async function (
    rawEvent: unknown,
    context: Context,
    callback: unknown,
  ): Promise<void> {
    const event = revokeAccessEvent.parse(rawEvent);

    await ssoClient.send(
      new DeleteAccountAssignmentCommand({
        InstanceArn: instanceArn,
        PermissionSetArn: event.role,
        PrincipalType: "USER",
        PrincipalId: event.principal,
        TargetId: event.accountId,
        TargetType: "AWS_ACCOUNT",
      }),
    );

    console.log("removed access");
  };
}
