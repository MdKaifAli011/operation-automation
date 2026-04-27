"use client";

import { useState } from "react";

type SendAction = "brochure" | "bank_details" | "fee_details";

interface SendActionModalProps {
  isOpen: boolean;
  selectedCount: number;
  targetExams: string[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (actions: SendAction[], selectedBrochures?: string[]) => void;
}

export function SendActionModal({
  isOpen,
  selectedCount,
  targetExams,
  loading = false,
  onClose,
  onConfirm,
}: SendActionModalProps) {
  const [selectedActions, setSelectedActions] = useState<SendAction[]>([]);
  const [selectedBrochures, setSelectedBrochures] = useState<string[]>(targetExams);

  if (!isOpen) return null;

  const actions: { key: SendAction; label: string; icon: React.ReactNode }[] = [
    {
      key: "brochure",
      label: "Course Brochure",
      icon: <CourseBrochureIcon />,
    },
    {
      key: "bank_details",
      label: "Bank Details",
      icon: <BankDetailsIcon />,
    },
    {
      key: "fee_details",
      label: "Fee Details",
      icon: <FeeDetailsIcon />,
    },
  ];

  const toggleAction = (action: SendAction) => {
    setSelectedActions((prev) =>
      prev.includes(action)
        ? prev.filter((a) => a !== action)
        : [...prev, action]
    );
  };

  const toggleBrochure = (exam: string) => {
    setSelectedBrochures((prev) =>
      prev.includes(exam)
        ? prev.filter((e) => e !== exam)
        : [...prev, exam]
    );
  };

  const handleConfirm = () => {
    if (selectedActions.length > 0) {
      const brochureData = selectedActions.includes("brochure") ? selectedBrochures : undefined;
      onConfirm(selectedActions, brochureData);
      setSelectedActions([]);
      setSelectedBrochures(targetExams);
    }
  };

  const showBrochureSelection = selectedActions.includes("brochure");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-none border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Send to {selectedCount} lead{selectedCount !== 1 ? "s" : ""}
        </h2>
        
        <div className="bg-slate-50 rounded-none border border-slate-200 p-4 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Selected leads:</span>
            <span className="font-medium text-slate-900">{selectedCount}</span>
          </div>
        </div>

        <p className="text-sm font-medium text-slate-700 mb-2">Select what to send:</p>
        <div className="space-y-2 mb-4">
          {actions.map((action) => (
            <label
              key={action.key}
              className="flex items-center gap-2.5 p-2.5 border border-slate-200 rounded-none bg-white hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedActions.includes(action.key)}
                onChange={() => toggleAction(action.key)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700 flex items-center gap-2">
                <span className="shrink-0 text-slate-500">{action.icon}</span>
                {action.label}
              </span>
            </label>
          ))}
        </div>

        {showBrochureSelection && (
          <div className="mb-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Select Brochures:</p>
            <div className="space-y-2">
              {targetExams.map((exam) => (
                <label
                  key={exam}
                  className="flex items-center gap-2.5 p-2.5 border border-slate-200 rounded-none bg-white hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedBrochures.includes(exam)}
                    onChange={() => toggleBrochure(exam)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">{exam}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-9 px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 rounded-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedActions.length === 0 || (showBrochureSelection && selectedBrochures.length === 0) || loading}
            className="h-9 px-4 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Sending...
              </>
            ) : (
              "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseBrochureIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function BankDetailsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function FeeDetailsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
