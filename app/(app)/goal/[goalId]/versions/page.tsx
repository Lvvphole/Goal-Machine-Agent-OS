import VersionHistory from "@/components/goal/VersionHistory";

export default function VersionsPage({ params }: { params: { goalId: string } }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Versions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Version history for goal {params.goalId}.
        </p>
      </div>

      <VersionHistory goalId={params.goalId} />
    </div>
  );
}
