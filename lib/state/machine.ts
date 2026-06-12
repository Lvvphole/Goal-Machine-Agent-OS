import { createServiceClient } from "@/lib/db/supabase";
import {
  GoalState,
  GoalMachineState,
  GoalMachineStateSchema,
  StateTransition,
  TRANSITIONS,
} from "@/lib/schemas";

export class GoalStateMachine {
  private readonly db = createServiceClient();

  canTransition(current: GoalState, trigger: GoalState): boolean {
    return TRANSITIONS[current].includes(trigger);
  }

  async getState(goalId: string): Promise<GoalMachineState> {
    const { data, error } = await this.db
      .from("goal_states")
      .select("*")
      .eq("goal_id", goalId)
      .single();

    if (error) throw new Error(`getState failed for ${goalId}: ${error.message}`);
    return GoalMachineStateSchema.parse(data);
  }

  async transition(
    goalId: string,
    trigger: GoalState,
    reason = "system",
  ): Promise<GoalMachineState> {
    const current = await this.getState(goalId);

    if (!this.canTransition(current.current_state, trigger)) {
      throw new Error(
        `Invalid transition: ${current.current_state} → ${trigger}`,
      );
    }

    const now = new Date().toISOString();
    const entry: StateTransition = {
      from: current.current_state,
      to: trigger,
      timestamp: now,
      reason,
    };
    const history = [...current.history, entry];

    const { error: updateError } = await this.db
      .from("goal_states")
      .update({ current_state: trigger, entered_at: now, history })
      .eq("goal_id", goalId);

    if (updateError) {
      throw new Error(`State update failed: ${updateError.message}`);
    }

    const { error: logError } = await this.db
      .from("state_transitions")
      .insert({
        goal_id: goalId,
        from_state: entry.from,
        to_state: entry.to,
        timestamp: now,
        reason,
      });

    if (logError) {
      throw new Error(`Transition log failed: ${logError.message}`);
    }

    return { ...current, current_state: trigger, entered_at: now, history };
  }
}
