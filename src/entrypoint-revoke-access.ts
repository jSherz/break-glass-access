import { SSOAdminClient } from "@aws-sdk/client-sso-admin";
import { buildRevokeAccessHandler } from "./handlers/revoke-access";

if (!process.env.INSTANCE_ARN) {
  throw new Error("You must specify a INSTANCE_ARN.");
}

export const revokeAccessHandler = buildRevokeAccessHandler(
  new SSOAdminClient({}),
  process.env.INSTANCE_ARN,
);
