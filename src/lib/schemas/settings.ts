import { z } from "zod";

export const settingsSchema = z.object({
  organisation: z.string().min(2),
  email: z.string().email(),
});

export type SettingsForm = z.infer<typeof settingsSchema>;
