import { z } from "zod";

export const linkPreviewQuerySchema = z.object({
  url: z.string().url().max(2000),
});
