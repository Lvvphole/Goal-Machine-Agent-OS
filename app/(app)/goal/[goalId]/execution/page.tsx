export default function ExecutionPage({ params }: { params: { goalId: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Execution</h1>
      <p className="mt-1 text-sm text-gray-500">
        Execution log for goal {params.goalId}.
      </p>
    </div>
  );
}
