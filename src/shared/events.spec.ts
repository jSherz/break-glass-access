import { breakGlassEvent } from "./events";
import { SafeParseSuccess } from "zod";

describe("events", () => {
  describe("breakGlassEvent", () => {
    describe("when validating an object with missing fields", () => {
      it("returns an error", () => {
        const event = {
          accountId: "test",
          permissionSetArn: "test",
          principalUsername: "test",
        };

        const result = breakGlassEvent.safeParse(event);

        expect(result.success).toBe(false);
      });
    });

    describe("when validating an object with additional fields", () => {
      it("returns the fields", () => {
        const event = {
          accountId: "test",
          permissionSetArn: "test",
          principalId: "test",
          principalUsername: "test",
          extraField: "hello",
        };

        const result = breakGlassEvent.safeParse(event);

        expect(result.success).toBe(true);
        expect((result as SafeParseSuccess<any>).data.extraField).toEqual(
          "hello",
        );
      });
    });
  });
});
