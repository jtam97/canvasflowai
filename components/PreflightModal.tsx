"use client";

interface PreflightModalProps {
  issues: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PreflightModal({
  issues,
  onConfirm,
  onCancel,
}: PreflightModalProps) {
  const hasIssues = issues.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {hasIssues ? "Pre-flight Check" : "Ready to Run"}
        </h2>

        {hasIssues ? (
          <>
            <p className="text-gray-600 mb-4">
              Claude found some potential issues with your analysis plan:
            </p>
            <ul className="space-y-2 mb-6">
              {issues.map((issue, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-amber-700 bg-amber-50 rounded-lg p-3"
                >
                  <span className="shrink-0 mt-0.5">&#9888;</span>
                  <span className="text-sm">{issue}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-gray-600 mb-6">
            Your analysis plan looks good. Ready to execute all steps?
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Go back and fix
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            {hasIssues ? "Run anyway" : "Looks good, run it"}
          </button>
        </div>
      </div>
    </div>
  );
}
