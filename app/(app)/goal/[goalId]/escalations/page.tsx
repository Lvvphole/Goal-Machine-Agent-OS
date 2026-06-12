export default function EscalationsPage({ params }: { params: { goalId: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Escalations</h1>
      <p className="mt-1 text-sm text-gray-500">
        Escalations for goal {params.goalId}.
      </p>
    </div>
  );
}
