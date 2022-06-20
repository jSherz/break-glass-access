import { buildGrantAccessHandler } from "./handlers/grant-access";
import { SSOAdminClient } from "@aws-sdk/client-sso-admin";

if (!process.env.INSTANCE_ARN) {
  throw new Error("You must specify a INSTANCE_ARN.");
}

export const grantAccessHandler = buildGrantAccessHandler(
  new SSOAdminClient({}),
  process.env.INSTANCE_ARN,
);
