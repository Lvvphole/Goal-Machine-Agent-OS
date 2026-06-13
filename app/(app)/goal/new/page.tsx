import GoalIntakeForm from "@/components/goal/GoalIntakeForm";

export default function NewGoalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          New Goal
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Define a new goal for the agent.
        </p>
      </div>

      <GoalIntakeForm />
    </div>
  );
}
