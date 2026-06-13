import EvidenceLedger from "@/components/goal/EvidenceLedger";

export default function EvidencePage({ params }: { params: { goalId: string } }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Evidence</h1>

        <p className="mt-1 text-sm text-gray-500">
          Evidence collected for goal {params.goalId}.
        </p>
      </div>

      <EvidenceLedger goalId={params.goalId} />
    </div>
  );
}
