import { buildAccessRequestedHandler } from "./handlers/access-requested";
import { DDBDataStorage } from "./shared/DataStorage";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SFNClient } from "@aws-sdk/client-sfn";
import { CachedSSM } from "./shared/CachedSSM";
import { IdentitystoreClient } from "@aws-sdk/client-identitystore";
import { SSOUserLookup } from "./shared/SSOUserLookup";

if (!process.env.TABLE_NAME) {
  throw new Error("You must specify a TABLE_NAME.");
}

if (!process.env.STATE_MACHINE_ARN) {
  throw new Error("You must specify a STATE_MACHINE_ARN.");
}

if (!process.env.IDENTITY_STORE_ID) {
  throw new Error("You must specify a IDENTITY_STORE_ID.");
}

const ssoUserLookup = new SSOUserLookup(
  new IdentitystoreClient({}),
  process.env.IDENTITY_STORE_ID,
);

export const accessRequestedHandler = buildAccessRequestedHandler(
  new DDBDataStorage(process.env.TABLE_NAME, new DynamoDBClient({})),
  process.env.STATE_MACHINE_ARN,
  new SFNClient({}),
  new CachedSSM(),
  ssoUserLookup,
);
