import * as z from "zod";

export const breakGlassEvent = z
  .object({
    accountId: z.string(),
    permissionSetArn: z.string(),
    principalId: z.string(),
    principalUsername: z.string(),
  })
  .passthrough();

export type BreakGlassEvent = z.infer<typeof breakGlassEvent>;
