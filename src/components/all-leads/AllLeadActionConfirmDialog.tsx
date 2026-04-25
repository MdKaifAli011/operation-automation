"use client";

type ActionType = "course_brochure" | "bank_details" | "fee_details";

type Lead = {
  id: string;
  studentName: string;
  email?: string | null;
  targetExams: string[];
};

type Props = {
  lead: Lead;
  action: ActionType;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AllLeadActionConfirmDialog({ lead, action, loading = false, onConfirm, onCancel }: Props) {
  const getActionTitle = (act: ActionType) => {
    switch (act) {
      case "course_brochure":
        return "Send Course Brochure";
      case "bank_details":
        return "Send Bank Details";
      case "fee_details":
        return "Send Fee Details";
    }
  };

  const getActionMessage = (act: ActionType) => {
    switch (act) {
      case "course_brochure":
        return `Send the course brochure for ${lead.targetExams.join(", ")} to ${lead.studentName}.`;
      case "bank_details":
        return `Send the bank details for payment to ${lead.studentName}.`;
      case "fee_details":
        return `Send the fee structure details for ${lead.targetExams.join(", ")} to ${lead.studentName}.`;
    }
  };

  const getActionIcon = (act: ActionType) => {
    switch (act) {
      case "course_brochure":
        return <CourseBrochureIcon />;
      case "bank_details":
        return <BankDetailsIcon />;
      case "fee_details":
        return <FeeDetailsIcon />;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-none border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          {getActionTitle(action)}
        </h2>
        
        <div className="bg-slate-50 rounded-none border border-slate-200 p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 text-slate-500 mt-0.5">
              {getActionIcon(action)}
            </div>
            <div className="flex-1 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Student:</span>
                <span className="font-medium text-slate-900">{lead.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-medium text-slate-900">{lead.email || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Exams:</span>
                <span className="font-medium text-slate-900">{lead.targetExams.join(", ")}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-6">
          {getActionMessage(action)}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-9 px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 rounded-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
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
              "Send"
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
