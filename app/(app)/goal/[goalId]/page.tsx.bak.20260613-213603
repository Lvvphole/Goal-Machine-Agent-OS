import ConfidencePanel from "@/components/goal/ConfidencePanel";
import ObservabilityDashboard from "@/components/goal/ObservabilityDashboard";
import StateMachineView from "@/components/goal/StateMachineView";

export default function GoalPage({ params }: { params: { goalId: string } }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Goal</h1>
        <p className="mt-1 text-sm text-gray-500">
          Goal ID: {params.goalId}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfidencePanel goalId={params.goalId} />
        <StateMachineView goalId={params.goalId} />
      </div>

      <ObservabilityDashboard goalId={params.goalId} />
    </div>
  );
}
