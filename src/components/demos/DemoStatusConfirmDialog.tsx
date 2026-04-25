"use client";

import type { DemoStatus } from "./DemoIndexPage";

type Demo = {
  leadId: string;
  studentName: string;
  email: string | null;
  phone: string;
  targetExams: string[];
  grade: string;
  subject: string;
  teacher: string;
  isoDate: string;
  timeHmIST: string;
  meetLinkUrl: string;
};

type Props = {
  demo: Demo;
  newStatus: DemoStatus;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DemoStatusConfirmDialog({ demo, newStatus, loading = false, onConfirm, onCancel }: Props) {
  const getStatusColor = (status: DemoStatus) => {
    switch (status) {
      case "Scheduled":
        return "text-sky-600";
      case "Cancelled":
        return "text-rose-600";
      case "Completed":
        return "text-emerald-600";
    }
  };

  const getStatusMessage = (status: DemoStatus) => {
    switch (status) {
      case "Scheduled":
        return "Mark this demo as scheduled. The student will be notified of the demo details.";
      case "Cancelled":
        return "Mark this demo as cancelled. The student will be notified of the cancellation.";
      case "Completed":
        return "Mark this demo as completed. The student will be notified of the completion.";
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-none border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Confirm Status Change
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          Are you sure you want to mark this demo as{" "}
          <span className={cn("font-semibold", getStatusColor(newStatus))}>
            {newStatus}
          </span>
          ?
        </p>
        
        <div className="bg-slate-50 rounded-none border border-slate-200 p-4 mb-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Student:</span>
              <span className="font-medium text-slate-900">{demo.studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Subject:</span>
              <span className="font-medium text-slate-900">{demo.subject}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Teacher:</span>
              <span className="font-medium text-slate-900">{demo.teacher}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span className="font-medium text-slate-900">{demo.isoDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Time:</span>
              <span className="font-medium text-slate-900">{demo.timeHmIST}</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-6">
          {getStatusMessage(newStatus)}
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
              "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
