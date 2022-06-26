import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import crypto from "crypto";
import { DDBDataStorage } from "./DataStorage";

describe("DDBDataStorage", () => {
  // Table creation takes a while!
  jest.setTimeout(60000);

  const ddbClient = new DynamoDBClient({});

  const tableName = `break-glass-access-integration-tests-${crypto
    .randomBytes(8)
    .toString("hex")}`;

  beforeAll(async () => {
    const createResponse = await ddbClient.send(
      new CreateTableCommand({
        TableName: tableName,
        KeySchema: [
          {
            KeyType: "HASH",
            AttributeName: "id",
          },
        ],
        AttributeDefinitions: [
          {
            AttributeName: "id",
            AttributeType: "S",
          },
        ],
        BillingMode: "PAY_PER_REQUEST",
      }),
    );

    let created = createResponse.TableDescription?.TableStatus === "ACTIVE";
    let attempt = 0;

    while (!created) {
      const description = await ddbClient.send(
        new DescribeTableCommand({
          TableName: tableName,
        }),
      );

      created = description.Table?.TableStatus === "ACTIVE";

      if (!created) {
        // Wait with some jitter and backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.round(Math.random() * 50 + attempt * 50)),
        );
      }
    }
  });

  afterAll(async () => {
    await ddbClient.send(
      new DeleteTableCommand({
        TableName: tableName,
      }),
    );
  });

  describe("userCanAccess", () => {
    describe("when the user does not have access", () => {
      it("returns null", async () => {
        const dataStorage = new DDBDataStorage(tableName, ddbClient);

        await expect(
          dataStorage.userCanAccess(
            "my-test-account",
            "arn:aws:sso:::permissionSet/ssoins-12345/ps-12345",
            crypto.randomBytes(8).toString("hex"),
          ),
        ).resolves.toBe(false);
      });
    });

    describe("when the user does have access", () => {
      it("returns the user", async () => {
        const dataStorage = new DDBDataStorage(tableName, ddbClient);

        const principal = crypto.randomBytes(8).toString("hex");

        await ddbClient.send(
          new PutItemCommand({
            TableName: tableName,
            Item: {
              id: {
                S: `access#my-test-account#arn:aws:sso:::permissionSet/ssoins-12345/ps-12345#${principal}`,
              },
            },
          }),
        );

        await expect(
          dataStorage.userCanAccess(
            "my-test-account",
            "arn:aws:sso:::permissionSet/ssoins-12345/ps-12345",
            principal,
          ),
        ).resolves.toBe(true);
      });
    });
  });

  describe("resolvePrincipal", () => {
    describe("when the principal does not exist", () => {
      it("returns null", async () => {
        const dataStorage = new DDBDataStorage(tableName, ddbClient);

        const principal = crypto.randomBytes(8).toString("hex");

        await expect(
          dataStorage.resolvePrincipal(principal),
        ).resolves.toBeNull();
      });
    });

    describe("when the principal does exist", () => {
      it("returns the principal", async () => {
        const dataStorage = new DDBDataStorage(tableName, ddbClient);

        const principal = crypto.randomBytes(8).toString("hex");

        await ddbClient.send(
          new PutItemCommand({
            TableName: tableName,
            Item: {
              id: {
                S: `principal#${principal}`,
              },
              ssoPrincipal: {
                S: "test!!!",
              },
            },
          }),
        );

        await expect(dataStorage.resolvePrincipal(principal)).resolves.toEqual(
          "test!!!",
        );
      });
    });
  });
});
