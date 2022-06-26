import * as crypto from "crypto";
import {
  DeleteParametersCommand,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { CachedSSM } from "./CachedSSM";

describe("CachedSSM", () => {
  describe("getParameter", () => {
    const paramName = `/break-glass-access-integration-tests-${crypto
      .randomBytes(8)
      .toString("hex")}`;

    const secureParamName = paramName.replace("tests-", "tests-secure-");

    const ssmClient = new SSMClient({});

    beforeAll(async () => {
      await ssmClient.send(
        new PutParameterCommand({
          Name: paramName,
          Type: "String",
          Value: "hello world!",
        }),
      );

      await ssmClient.send(
        new PutParameterCommand({
          Name: secureParamName,
          Type: "SecureString",
          Value: "hello secure world!",
        }),
      );
    });

    afterAll(async () => {
      await ssmClient.send(
        new DeleteParametersCommand({
          Names: [paramName, secureParamName],
        }),
      );
    });

    describe("when fetching a parameter for the first time", () => {
      it("retrieves it from SSM", async () => {
        const cachedSSM = new CachedSSM(ssmClient);

        await expect(cachedSSM.getParameter(paramName)).resolves.toEqual(
          "hello world!",
        );
      });
    });

    describe("when fetching a previously fetched parameter", () => {
      it("uses the cache", async () => {
        const ssmClientWeCanMangle = new SSMClient({});

        const cachedSSM = new CachedSSM(ssmClientWeCanMangle);

        await expect(cachedSSM.getParameter(paramName)).resolves.toEqual(
          "hello world!",
        );

        // Prevent send ever being called again
        delete (ssmClientWeCanMangle as { send?: any })["send"];

        await expect(cachedSSM.getParameter(paramName)).resolves.toEqual(
          "hello world!",
        );
      });
    });

    describe("when the parameter is a secure string", () => {
      it("fetches the parameter", async () => {
        const cachedSSM = new CachedSSM(ssmClient);

        await expect(cachedSSM.getParameter(secureParamName)).resolves.toEqual(
          "hello secure world!",
        );
      });
    });
  });
});
