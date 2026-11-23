import { z } from "zod";
export const automationInput = z.object({
  name: z.string().trim().min(1).max(100),
  ig_account_id: z.string().uuid(),
  keyword: z.string().trim().min(1).max(200),
  match_type: z.enum(["contains", "exact", "starts_with"]),
  case_sensitive: z.boolean().default(false),
  message: z.string().trim().min(1).max(1000),
  enabled: z.boolean().default(false),
});
