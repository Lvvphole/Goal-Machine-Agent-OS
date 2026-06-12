import { z } from "zod";

export const GoalInputSchema = z.object({
  goal: z.string().min(1),
  deadline: z.string().datetime({ message: "Must be an ISO 8601 datetime" }),
  current_value: z.number(),
  target_value: z.number(),
  metric: z.string().min(1),
  context: z.string().min(1),
  why: z.string().min(1),
  other_active_goals: z.array(z.string()),
});

export type GoalInput = z.infer<typeof GoalInputSchema>;
