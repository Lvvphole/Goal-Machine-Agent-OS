export default function GoalPage({ params }: { params: { goalId: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Goal</h1>
      <p className="mt-1 text-sm text-gray-500">Goal ID: {params.goalId}</p>
    </div>
  );
}
