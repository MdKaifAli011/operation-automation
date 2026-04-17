import { useEffect, useMemo, useState } from "react";
import type { BankAccountRecord } from "@/lib/instituteProfileTypes";
import { StudentReportModal } from "@/components/student/StudentReportModal";
import { StudentReportVersionsModal } from "@/components/student/StudentReportVersionsModal";
import { listStudentReportFiles } from "@/lib/studentReportVersions";
import type { LeadPipelineStudentReport } from "@/lib/leadPipelineMetaTypes";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { sendLeadPipelineEmail } from "@/lib/leadPipelineEmailClient";
import { appendActivity, mergePipelineMeta } from "@/lib/pipeline";
import { PipelineMessageDialog } from "./PipelineMessageDialog";
import { PipelineStepFrame } from "./PipelineStepFrame";
import type { DocumentsStepPanelProps } from "./pipelineStepTypes";

type BrochureOption = {
  key: string;
  title: string;
  href: string;
};

type DocumentRow = {
  key: string;
  title: string;
  countLabel: string;
  statusText: string;
  isSent: boolean;
  actionLabel: string;
  isCustom?: boolean;
};

type DocumentItemPersisted = {
  key?: string;
  title?: string;
  countLabel?: string;
  status?: string;
  sentAt?: string | null;
  isCustom?: boolean;
  documentUrl?: string | null;
  storedFileUrl?: string | null;
  fileName?: string | null;
};

type MessageDialogState =
  | { open: false }
  | {
      open: true;
      mode: "alert";
      variant: "default" | "error";
      title: string;
      description: string;
      highlight?: string;
      meta?: string;
      okLabel?: string;
    }
  | {
      open: true;
      mode: "confirm";
      variant: "default" | "error";
      title: string;
      description: string;
      highlight?: string;
      meta?: string;
      confirmLabel: string;
      cancelLabel?: string;
      onConfirm: () => void;
    };

function norm(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

function absOrBlank(input: string | undefined): string {
  const t = String(input ?? "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/")) return t;
  return "";
}

function accountLabel(a: BankAccountRecord): string {
  const lab = a.label.trim();
  const bank = a.bankName.trim();
  if (lab && bank) return `${lab} · ${bank}`;
  return lab || bank || "Bank account";
}

function sentAtLabel(iso: string | null | undefined): string {
  const t = String(iso ?? "").trim();
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function DocumentsStepPanel({
  lead,
  onPatchLead,
  refreshLead,
}: DocumentsStepPanelProps) {
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [addingOpen, setAddingOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSourceMode, setNewSourceMode] = useState<"url" | "file">("url");
  const [newUrl, setNewUrl] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [msgDlg, setMsgDlg] = useState<MessageDialogState>({ open: false });

  const [brochureOptions, setBrochureOptions] = useState<BrochureOption[]>([]);
  const [brochureLoading, setBrochureLoading] = useState(false);
  const [brochureModalOpen, setBrochureModalOpen] = useState(false);
  const [selectedBrochureKeys, setSelectedBrochureKeys] = useState<string[]>(
    [],
  );

  const [bankOptions, setBankOptions] = useState<BankAccountRecord[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [reportVersionsModalOpen, setReportVersionsModalOpen] = useState(false);

  const docsMetaItems = useMemo(() => {
    const raw = (lead.pipelineMeta as Record<string, unknown> | undefined)
      ?.documents as { items?: DocumentItemPersisted[] } | undefined;
    return Array.isArray(raw?.items) ? raw.items : [];
  }, [lead.pipelineMeta]);

  const pushToast = (message: string) => {
    setToastMsg(message);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === message ? null : cur));
    }, 2200);
  };

  const closeAddDocumentModal = () => {
    if (savingKey) return;
    setAddingOpen(false);
    setNewTitle("");
    setNewSourceMode("url");
    setNewUrl("");
    setNewFile(null);
  };

  const docsByKey = useMemo(() => {
    const m = new Map<string, DocumentItemPersisted>();
    for (const d of docsMetaItems) {
      const k = String(d?.key ?? "").trim();
      if (!k) continue;
      m.set(k, d);
    }
    return m;
  }, [docsMetaItems]);

  const studentReport = ((
    lead.pipelineMeta as Record<string, unknown> | undefined
  )?.studentReport ?? {}) as LeadPipelineStudentReport;
  const brochure = ((lead.pipelineMeta as Record<string, unknown> | undefined)
    ?.brochure ?? {}) as {
    sentEmail?: boolean;
    sentEmailAt?: string | null;
    lastSentSelectionKeys?: string[];
  };
  const fees = ((lead.pipelineMeta as Record<string, unknown> | undefined)
    ?.fees ?? {}) as {
    enrollmentSent?: boolean;
    enrollmentSentAt?: string | null;
    feeSentEmail?: boolean;
    feeSentEmailAt?: string | null;
    feeSelectedBankAccountId?: string | null;
  };

  const reportSentRaw = !!docsByKey.get("report")?.sentAt;
  const brochureSent = !!brochure.sentEmail || !!brochure.sentEmailAt;
  const enrollmentSent = !!fees.enrollmentSent || !!fees.enrollmentSentAt;
  const bankSent = !!docsByKey.get("bank")?.sentAt;
  const courierSent = !!docsByKey.get("courier")?.sentAt;
  const rankingSent = !!docsByKey.get("ranking")?.sentAt;

  const reportFileList = useMemo(
    () => listStudentReportFiles(studentReport),
    [studentReport],
  );
  const reportGenerated = reportFileList.length > 0;
  const reportSent = reportSentRaw;
  const reportCountLabel = String(reportFileList.length);

  const lastReportEmailedHint = useMemo(() => {
    const multi = Array.isArray(studentReport.lastSentPdfUrls)
      ? studentReport.lastSentPdfUrls.map((u) => String(u ?? "").trim()).filter(Boolean)
      : [];
    const urls =
      multi.length > 0
        ? multi
        : String(studentReport.lastSentPdfUrl ?? "").trim()
          ? [String(studentReport.lastSentPdfUrl).trim()]
          : [];
    if (urls.length === 0) return "";
    const names = urls
      .map(
        (u) =>
          reportFileList.find((f) => f.pdfUrl === u)?.fileName?.trim() ||
          "Report PDF",
      )
      .join(", ");
    const at = sentAtLabel(studentReport.lastSentAt ?? null);
    if (urls.length > 1) {
      return at
        ? `Last emailed ${urls.length} PDFs: ${names} · ${at}`
        : `Last emailed ${urls.length} PDFs: ${names}`;
    }
    return at ? `Last emailed: ${names} · ${at}` : `Last emailed: ${names}`;
  }, [studentReport, reportFileList]);

  const lastBrochureEmailedHint = useMemo(() => {
    const keys = brochure.lastSentSelectionKeys;
    if (!Array.isArray(keys) || keys.length === 0) return "";
    const titles = keys
      .map((k) => brochureOptions.find((b) => b.key === k)?.title ?? k)
      .filter(Boolean);
    if (titles.length === 0) return "";
    return `Last emailed: ${titles.join(" · ")}`;
  }, [brochure.lastSentSelectionKeys, brochureOptions]);

  useEffect(() => {
    setSelectedBankId(fees.feeSelectedBankAccountId ?? null);
  }, [fees.feeSelectedBankAccountId]);

  useEffect(() => {
    if (!brochureModalOpen) return;
    const prev = brochure.lastSentSelectionKeys;
    if (!Array.isArray(prev) || prev.length === 0) return;
    if (brochureOptions.length === 0) return;
    const valid = prev.filter((k) => brochureOptions.some((o) => o.key === k));
    if (valid.length > 0) setSelectedBrochureKeys(valid);
  }, [brochureModalOpen, brochure.lastSentSelectionKeys, brochureOptions]);

  const loadBrochureOptions = async () => {
    setBrochureLoading(true);
    try {
      const res = await fetch("/api/exam-brochure-templates", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load brochure list.");
      const data = (await res.json()) as Array<{
        exam?: string;
        brochures?: Array<{
          key?: string;
          title?: string;
          linkUrl?: string;
          storedFileUrl?: string | null;
        }>;
      }>;
      const want = new Set(lead.targetExams.map((x) => norm(x)));
      const out: BrochureOption[] = [];
      for (const row of data) {
        const exam = norm(row?.exam ?? "");
        if (!exam || (want.size > 0 && !want.has(exam))) continue;
        for (const b of row.brochures ?? []) {
          const key = String(b?.key ?? "").trim();
          if (!key) continue;
          const href = absOrBlank(String(b?.storedFileUrl ?? b?.linkUrl ?? ""));
          if (!href) continue;
          const title = String(b?.title ?? "").trim() || "Course brochure";
          const composite = `${row.exam}-${key}`;
          if (out.some((x) => x.key === composite)) continue;
          out.push({
            key: composite,
            title: `${row.exam} · ${title}`,
            href,
          });
        }
      }
      setBrochureOptions(out);
      setSelectedBrochureKeys((prev) =>
        prev.filter((k) => out.some((x) => x.key === k)),
      );
    } catch (e) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Could not load brochures",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBrochureLoading(false);
    }
  };

  const loadBankOptions = async () => {
    setBankLoading(true);
    try {
      const res = await fetch("/api/settings/bank-profile", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not load bank accounts.");
      const data = (await res.json()) as { bankAccounts?: BankAccountRecord[] };
      const list = Array.isArray(data.bankAccounts)
        ? data.bankAccounts.filter((a) => a.isActive)
        : [];
      setBankOptions(list);
      setSelectedBankId((prev) => prev ?? list[0]?.id ?? null);
    } catch (e) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Could not load banks",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBankLoading(false);
    }
  };

  useEffect(() => {
    void loadBrochureOptions();
    void loadBankOptions();
  }, [lead.id]);

  const brochureCountLabel = String(brochureOptions.length || 0);
  const bankCountLabel =
    bankOptions.length > 0 ? `${bankOptions.length} (Pvt.)` : "0";
  const firstExam =
    lead.targetExams.find((x) => String(x ?? "").trim()) ?? "Course";

  const baseRows: DocumentRow[] = [
    {
      key: "report",
      title: "Demo Session Report - Feedback",
      countLabel: reportCountLabel,
      statusText: reportSent
        ? "Sent"
        : reportGenerated
          ? "Ready to send"
          : "Not Generated",
      isSent: reportSent,
      actionLabel: reportSent ? "Sent" : "Generate",
    },
    {
      key: "brochure",
      title: `"${firstExam}" Course Brochure`,
      countLabel: brochureCountLabel,
      statusText: brochureSent ? "Sent" : "Not Sent",
      isSent: brochureSent,
      actionLabel: brochureSent ? "Send again" : "Select & send",
    },
    {
      key: "enrollment",
      title: "Enrollment Form Link",
      countLabel: "1",
      statusText: enrollmentSent ? "Sent" : "Not Sent",
      isSent: enrollmentSent,
      actionLabel: enrollmentSent ? "Send again" : "Send now",
    },
    {
      key: "courier",
      title: "Courier Address",
      countLabel: "1",
      statusText: courierSent ? "Sent" : "Not Sent",
      isSent: courierSent,
      actionLabel: courierSent ? "Sent" : "Send now",
    },
    {
      key: "ranking",
      title: "Current Ranking & Top Medical Colleges",
      countLabel: "1",
      statusText: rankingSent ? "Sent" : "Not Sent",
      isSent: rankingSent,
      actionLabel: rankingSent ? "Sent" : "Send now",
    },
    {
      key: "bank",
      title: "Bank & Account Details",
      countLabel: bankCountLabel,
      statusText: bankSent ? "Sent" : "Not Sent",
      isSent: bankSent,
      actionLabel: bankSent ? "Send again" : "Select & send",
    },
  ];

  const customRows: DocumentRow[] = docsMetaItems
    .filter((d) => d?.isCustom)
    .map((d, i) => {
      const sent = !!d.sentAt;
      return {
        key: String(d.key || `custom-${i}`),
        title: String(d.title || "Custom document"),
        countLabel: String(d.countLabel || "1"),
        statusText: sent ? "Sent" : "Not Sent",
        isSent: sent,
        actionLabel: sent ? "Sent" : "Send now",
        isCustom: true,
      };
    });

  const rows = [...baseRows, ...customRows];

  const patchDocsItem = async (
    key: string,
    patch: Partial<DocumentItemPersisted>,
    activity: string,
    extraMeta?: Record<string, unknown>,
  ) => {
    const list = [...docsMetaItems];
    const idx = list.findIndex((x) => String(x?.key ?? "").trim() === key);
    if (idx >= 0) list[idx] = { ...list[idx], ...patch };
    else list.push({ key, ...patch });
    await onPatchLead({
      pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
        documents: { items: list },
        ...(extraMeta ?? {}),
      }),
      activityLog: appendActivity(lead.activityLog, "brochure", activity),
    });
  };

  const markSentSimple = (row: DocumentRow) => {
    setMsgDlg({
      open: true,
      mode: "confirm",
      variant: "default",
      title: "Mark document as sent?",
      description: `Mark "${row.title}" as sent in this lead's Step 2 table.`,
      confirmLabel: "Mark sent",
      cancelLabel: "Cancel",
      onConfirm: () => {
        void (async () => {
          setSavingKey(row.key);
          try {
            const now = new Date().toISOString();
            await patchDocsItem(
              row.key,
              {
                key: row.key,
                title: row.title,
                countLabel: row.countLabel,
                sentAt: now,
              },
              `Document sent: ${row.title}`,
            );
            await refreshLead();
            pushToast(`${row.title} marked as sent.`);
          } catch (e) {
            setMsgDlg({
              open: true,
              mode: "alert",
              variant: "error",
              title: "Could not mark sent",
              description: e instanceof Error ? e.message : "Please try again.",
            });
          } finally {
            setSavingKey(null);
          }
        })();
      },
    });
  };

  const sendEnrollment = () => {
    const row = rows.find((r) => r.key === "enrollment");
    if (!row) return;
    setMsgDlg({
      open: true,
      mode: "confirm",
      variant: "default",
      title: row.isSent ? "Send again?" : "Send now?",
      description: `Send "${row.title}" to the lead email now.`,
      confirmLabel: row.isSent ? "Send again" : "Send now",
      cancelLabel: "Cancel",
      onConfirm: () => {
        void (async () => {
          setSavingKey(row.key);
          try {
            const now = new Date().toISOString();
            await sendLeadPipelineEmail(lead.id, { templateKey: "enrollment" });
            await patchDocsItem(
              "enrollment",
              {
                key: "enrollment",
                title: row.title,
                countLabel: row.countLabel,
                sentAt: now,
              },
              "Enrollment form link sent from Step 2.",
              { fees: { enrollmentSent: true, enrollmentSentAt: now } },
            );
            await refreshLead();
            pushToast("Enrollment form sent.");
          } catch (e) {
            setMsgDlg({
              open: true,
              mode: "alert",
              variant: "error",
              title: "Send failed",
              description: e instanceof Error ? e.message : "Please try again.",
            });
          } finally {
            setSavingKey(null);
          }
        })();
      },
    });
  };

  const sendCourierAddressRequest = () => {
    const row = rows.find((r) => r.key === "courier");
    if (!row) return;
    setMsgDlg({
      open: true,
      mode: "confirm",
      variant: "default",
      title: row.isSent ? "Send again?" : "Send now?",
      description:
        "Email the family to collect complete courier address details for document dispatch.",
      confirmLabel: row.isSent ? "Send again" : "Send now",
      cancelLabel: "Cancel",
      onConfirm: () => {
        void (async () => {
          setSavingKey(row.key);
          try {
            const now = new Date().toISOString();
            await sendLeadPipelineEmail(lead.id, {
              templateKey: "courier_address",
            });
            await patchDocsItem(
              "courier",
              {
                key: "courier",
                title: row.title,
                countLabel: row.countLabel,
                sentAt: now,
              },
              "Courier address request emailed from Step 2.",
            );
            await refreshLead();
            pushToast("Courier address request sent.");
          } catch (e) {
            setMsgDlg({
              open: true,
              mode: "alert",
              variant: "error",
              title: "Send failed",
              description: e instanceof Error ? e.message : "Please try again.",
            });
          } finally {
            setSavingKey(null);
          }
        })();
      },
    });
  };

  const sendBrochureSelection = async () => {
    if (selectedBrochureKeys.length === 0) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Select brochure(s)",
        description: "Choose at least one brochure before sending.",
      });
      return;
    }
    setSavingKey("brochure");
    try {
      const now = new Date().toISOString();
      await sendLeadPipelineEmail(lead.id, {
        templateKey: "brochure",
        brochureEmail: {
          selectionKeys: selectedBrochureKeys,
          includeStudentReportPdf: false,
        },
      });
      const row = rows.find((r) => r.key === "brochure");
      await patchDocsItem(
        "brochure",
        {
          key: "brochure",
          title: row?.title || "Course Brochure",
          countLabel: String(selectedBrochureKeys.length),
          sentAt: now,
        },
        `Brochure bundle sent (${selectedBrochureKeys.length} selected).`,
        {
          brochure: {
            sentEmail: true,
            sentEmailAt: now,
            lastSentSelectionKeys: [...selectedBrochureKeys],
          },
        },
      );
      setBrochureModalOpen(false);
      await refreshLead();
      pushToast("Selected brochures sent.");
    } catch (e) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Brochure send failed",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const sendBankSelection = async () => {
    if (!selectedBankId?.trim()) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Select bank account",
        description: "Choose one bank account before sending.",
      });
      return;
    }
    setSavingKey("bank");
    try {
      const now = new Date().toISOString();
      const row = rows.find((r) => r.key === "bank");
      await onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          fees: { feeSelectedBankAccountId: selectedBankId },
          documents: {
            items: docsMetaItems.map((x) =>
              String(x?.key ?? "").trim() === "bank"
                ? { ...x, sentAt: now, countLabel: bankCountLabel }
                : x,
            ),
          },
        }),
        activityLog: appendActivity(
          lead.activityLog,
          "brochure",
          "Selected bank account from Step 2 for fee email.",
        ),
      });
      await sendLeadPipelineEmail(lead.id, { templateKey: "bank_details" });
      await patchDocsItem(
        "bank",
        {
          key: "bank",
          title: row?.title || "Bank & Account Details",
          countLabel: bankCountLabel,
          sentAt: now,
        },
        "Bank details sent from Step 2.",
        { fees: { feeSelectedBankAccountId: selectedBankId } },
      );
      setBankModalOpen(false);
      await refreshLead();
      pushToast("Selected bank details sent.");
    } catch (e) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Bank details send failed",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const uploadNewFile = async (): Promise<{
    storedFileUrl: string;
    fileName: string;
  } | null> => {
    if (!newFile) return null;
    const fd = new FormData();
    fd.set("file", newFile);
    const res = await fetch(
      `/api/leads/${encodeURIComponent(lead.id)}/documents-upload`,
      {
        method: "POST",
        body: fd,
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      storedFileUrl?: string;
      fileName?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || "Upload failed.");
    }
    const storedFileUrl = String(data.storedFileUrl ?? "").trim();
    const fileName = String(data.fileName ?? "").trim();
    if (!storedFileUrl) throw new Error("Upload failed.");
    return { storedFileUrl, fileName: fileName || newFile.name || "document" };
  };

  const addCustomDocument = async () => {
    const title = newTitle.trim();
    const url = newUrl.trim();
    if (!title) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Document name required",
        description: "Enter a document name before adding.",
      });
      return;
    }
    if (newSourceMode === "url") {
      if (!url) {
        setMsgDlg({
          open: true,
          mode: "alert",
          variant: "error",
          title: "URL required",
          description: "Enter a document URL.",
        });
        return;
      }
      if (!/^https?:\/\/|^\//i.test(url)) {
        setMsgDlg({
          open: true,
          mode: "alert",
          variant: "error",
          title: "Invalid URL",
          description:
            "Use a full http(s) URL or an app path starting with '/'.",
        });
        return;
      }
    } else if (!newFile) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "File required",
        description: "Upload a document file.",
      });
      return;
    }
    const key = `custom-${Date.now()}`;
    setSavingKey(key);
    try {
      const uploaded = await uploadNewFile();
      const list = [
        ...docsMetaItems,
        {
          key,
          title,
          countLabel: "1",
          isCustom: true,
          sentAt: null,
          documentUrl: newSourceMode === "url" ? url : null,
          storedFileUrl: uploaded?.storedFileUrl ?? null,
          fileName: uploaded?.fileName ?? null,
        },
      ];
      await onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          documents: { items: list },
        }),
        activityLog: appendActivity(
          lead.activityLog,
          "brochure",
          `Document added: ${title}`,
        ),
      });
      await refreshLead();
      pushToast(`Document added: ${title}`);
      setNewTitle("");
      setNewSourceMode("url");
      setNewUrl("");
      setNewFile(null);
      setAddingOpen(false);
    } catch (e) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Could not add document",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const customDocLink = (key: string): string => {
    const row = docsByKey.get(key);
    return absOrBlank(String(row?.storedFileUrl ?? row?.documentUrl ?? ""));
  };

  return (
    <PipelineStepFrame stepNumber={2} leadId={lead.id}>
      <div className="border-b border-slate-100 bg-white px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className={SX.sectionTitle}>Step 2 - Documents</h2>
          <button
            type="button"
            className={cn(SX.btnGhost, "font-semibold text-primary")}
            onClick={() => setAddingOpen(true)}
          >
            ADD Document
          </button>
        </div>
      </div>

      <div className="bg-white px-2 py-2 sm:px-3">
        <div className="w-full overflow-x-auto">
          <table
            className={cn(SX.dataTable, "w-full min-w-[760px] table-fixed")}
          >
            <colgroup>
              <col className="w-[7%]" />
              <col className="w-[36%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[17%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={SX.dataTh}>No.</th>
                <th className={SX.dataTh}>Document Name:</th>
                <th className={SX.dataTh}>Documents</th>
                <th className={SX.dataTh}>Status:</th>
                <th className={SX.dataTh}>Action:</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const busy = savingKey === r.key;
                const customLink = r.isCustom ? customDocLink(r.key) : "";
                const docsSentAt = String(
                  docsByKey.get(r.key)?.sentAt ?? "",
                ).trim();
                const rowSentAt =
                  docsSentAt ||
                  (r.key === "brochure"
                    ? String(brochure.sentEmailAt ?? "").trim()
                    : r.key === "enrollment"
                      ? String(fees.enrollmentSentAt ?? "").trim()
                      : r.key === "bank"
                        ? String(fees.feeSentEmailAt ?? "").trim()
                        : "");
                const sentMetaLabel = sentAtLabel(rowSentAt);
                return (
                  <tr
                    key={r.key}
                    className={idx % 2 === 0 ? "bg-sky-50/40" : "bg-white"}
                  >
                    <td className={SX.dataTd}>{idx + 1}</td>
                    <td className={cn(SX.dataTd, "font-medium text-slate-900")}>
                      {customLink && r.isSent ? (
                        <a
                          href={customLink}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-primary"
                        >
                          {r.title}
                        </a>
                      ) : (
                        r.title
                      )}
                      {sentMetaLabel ? (
                        <p className="mt-1 text-[11px] font-normal text-slate-500">
                          Sent: {sentMetaLabel}
                        </p>
                      ) : null}
                      {r.key === "report" && lastReportEmailedHint ? (
                        <p className="mt-1 text-[11px] text-slate-600">
                          {lastReportEmailedHint}
                        </p>
                      ) : null}
                      {r.key === "brochure" && lastBrochureEmailedHint ? (
                        <p className="mt-1 text-[11px] text-slate-600">
                          {lastBrochureEmailedHint}
                        </p>
                      ) : null}
                    </td>
                    <td className={SX.dataTd}>
                      {r.key === "report" ? (
                        <button
                          type="button"
                          className="font-semibold text-primary underline"
                          onClick={() => setReportVersionsModalOpen(true)}
                        >
                          {r.countLabel}
                        </button>
                      ) : r.key === "brochure" ? (
                        <button
                          type="button"
                          className="font-semibold text-primary underline"
                          onClick={() => setBrochureModalOpen(true)}
                        >
                          {r.countLabel}
                        </button>
                      ) : r.key === "bank" ? (
                        <button
                          type="button"
                          className="font-semibold text-primary underline"
                          onClick={() => setBankModalOpen(true)}
                        >
                          {r.countLabel}
                        </button>
                      ) : (
                        r.countLabel
                      )}
                    </td>
                    <td className={SX.dataTd}>
                      <span
                        className={cn(
                          "inline-flex rounded-none px-1.5 py-0.5 text-[11px] ring-1",
                          r.isSent
                            ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                            : "bg-slate-50 text-slate-700 ring-slate-200",
                        )}
                      >
                        {r.statusText}
                      </span>
                    </td>
                    <td className={SX.dataTd}>
                      {r.key === "report" ? (
                        <button
                          type="button"
                          className={cn(
                            r.isSent ? SX.leadBtnGreen : SX.btnPrimary,
                            "h-8 w-30 justify-center px-2 text-[12px]",
                          )}
                          disabled={busy}
                          onClick={() => setReportOpen(true)}
                        >
                          {r.actionLabel}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {r.isCustom && customLink && r.isSent ? (
                            <a
                              href={customLink}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                SX.btnSecondary,
                                "h-8 w-16 justify-center px-2 text-[12px]",
                              )}
                            >
                              View
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className={cn(
                              r.isSent ? SX.leadBtnGreen : SX.btnPrimary,
                              "h-8 w-30 justify-center px-2 text-[12px]",
                            )}
                            disabled={busy}
                            onClick={() => {
                              if (r.key === "brochure")
                                setBrochureModalOpen(true);
                              else if (r.key === "bank") setBankModalOpen(true);
                              else if (r.key === "enrollment") sendEnrollment();
                              else if (r.key === "courier")
                                sendCourierAddressRequest();
                              else markSentSimple(r);
                            }}
                          >
                            {busy ? "Sending..." : r.actionLabel}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {brochureModalOpen ? (
        <dialog
          open
          className="fixed left-1/2 top-1/2 z-250 w-[min(100vw-1rem,660px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40"
        >
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Select brochure documents
            </h3>
            <p className="mt-1 text-[12px] text-slate-600">
              Choose one or more brochures, then send in one email.
            </p>
            {lastBrochureEmailedHint ? (
              <p className="mt-2 text-[11px] text-slate-600">
                {lastBrochureEmailedHint}
              </p>
            ) : null}
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
            {brochureLoading ? (
              <p className="text-[13px] text-slate-600">Loading brochures...</p>
            ) : brochureOptions.length === 0 ? (
              <p className="text-[13px] text-slate-600">
                No brochure documents available for this lead's exams.
              </p>
            ) : (
              <div className="space-y-2">
                {brochureOptions.map((b) => (
                  <label
                    key={b.key}
                    className="flex items-start gap-2 rounded border border-slate-200 bg-white px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={selectedBrochureKeys.includes(b.key)}
                      onChange={(e) =>
                        setSelectedBrochureKeys((prev) =>
                          e.target.checked
                            ? [...prev, b.key]
                            : prev.filter((k) => k !== b.key),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-slate-900">
                        {b.title}
                      </span>
                    </span>
                    <a
                      href={b.href}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        SX.btnSecondary,
                        "h-8 shrink-0 px-2 text-[11px] whitespace-nowrap",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open
                    </a>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <button
              type="button"
              className={SX.btnSecondary}
              onClick={() => setBrochureModalOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className={SX.btnPrimary}
              disabled={
                savingKey === "brochure" || selectedBrochureKeys.length === 0
              }
              onClick={() => void sendBrochureSelection()}
            >
              {savingKey === "brochure" ? "Sending..." : "Send selected"}
            </button>
          </div>
        </dialog>
      ) : null}

      {bankModalOpen ? (
        <dialog
          open
          className="fixed left-1/2 top-1/2 z-250 w-[min(100vw-1rem,620px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40"
        >
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Select bank account details
            </h3>
            <p className="mt-1 text-[12px] text-slate-600">
              Pick one bank account. Fee email will include this account
              details.
            </p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
            {bankLoading ? (
              <p className="text-[13px] text-slate-600">
                Loading bank accounts...
              </p>
            ) : bankOptions.length === 0 ? (
              <p className="text-[13px] text-slate-600">
                No active bank accounts found. Add them in Bank &amp; A/c
                Details.
              </p>
            ) : (
              <div className="space-y-2">
                {bankOptions.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-start gap-2 rounded border border-slate-200 bg-white px-3 py-2"
                  >
                    <input
                      type="radio"
                      name="bank-select-doc-step"
                      className="mt-1 h-4 w-4"
                      checked={selectedBankId === a.id}
                      onChange={() => setSelectedBankId(a.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-slate-900">
                        {accountLabel(a)}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        A/C: {a.accountNumber} · IFSC: {a.ifsc}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <button
              type="button"
              className={SX.btnSecondary}
              onClick={() => setBankModalOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className={SX.btnPrimary}
              disabled={savingKey === "bank" || !selectedBankId}
              onClick={() => void sendBankSelection()}
            >
              {savingKey === "bank" ? "Sending..." : "Send selected"}
            </button>
          </div>
        </dialog>
      ) : null}

      {addingOpen ? (
        <dialog
          open
          className="fixed left-1/2 top-1/2 z-250 w-[min(100vw-1rem,620px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40"
        >
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h3 className="text-[15px] font-semibold text-slate-900">
              Add document
            </h3>
            <p className="mt-1 text-[12px] text-slate-600">
              Enter document name and provide URL or upload file (any one).
            </p>
          </div>
          <div className="space-y-3 px-4 py-3">
            <label className="block text-[12px] font-medium text-slate-700">
              Document name
              <input
                className={cn(SX.input, "mt-1")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Admission checklist"
              />
            </label>

            <div>
              <p className="mb-1 text-[12px] font-medium text-slate-700">
                Document source
              </p>
              <div className="inline-flex border border-slate-200 bg-white">
                <button
                  type="button"
                  className={cn(
                    "h-9 px-3 text-[12px] font-medium",
                    newSourceMode === "url"
                      ? "bg-primary text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => setNewSourceMode("url")}
                >
                  URL
                </button>
                <button
                  type="button"
                  className={cn(
                    "h-9 border-l border-slate-200 px-3 text-[12px] font-medium",
                    newSourceMode === "file"
                      ? "bg-primary text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => setNewSourceMode("file")}
                >
                  Upload file
                </button>
              </div>
            </div>
            {newSourceMode === "url" ? (
              <label className="block text-[12px] font-medium text-slate-700">
                Document URL
                <input
                  className={cn(SX.input, "mt-1")}
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                />
              </label>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={cn(
                    SX.btnSecondary,
                    "h-9 cursor-pointer px-3 text-[12px]",
                  )}
                >
                  Choose file
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {newFile ? (
                  <p className="text-[12px] text-slate-600">
                    File: <span className="font-medium">{newFile.name}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">No file selected</p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <button
              type="button"
              className={SX.btnSecondary}
              disabled={savingKey !== null}
              onClick={closeAddDocumentModal}
            >
              Cancel
            </button>
            <button
              type="button"
              className={SX.btnPrimary}
              disabled={savingKey !== null}
              onClick={() => void addCustomDocument()}
            >
              {savingKey?.startsWith("custom-") ? "Adding..." : "Add document"}
            </button>
          </div>
        </dialog>
      ) : null}

      <StudentReportVersionsModal
        open={reportVersionsModalOpen}
        onClose={() => setReportVersionsModalOpen(false)}
        lead={lead}
        onPatchLead={onPatchLead}
        refreshLead={refreshLead}
        onToast={pushToast}
      />

      <StudentReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        lead={lead}
        onPatchLead={onPatchLead}
        refreshLead={refreshLead}
        onToast={pushToast}
      />

      {msgDlg.open ? (
        <PipelineMessageDialog
          {...msgDlg}
          onClose={() => setMsgDlg({ open: false })}
        />
      ) : null}

      {toastMsg ? (
        <div className="pointer-events-none fixed right-4 top-4 z-260 w-[min(92vw,420px)] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-semibold leading-relaxed text-emerald-900 shadow-lg sm:right-6 sm:top-6">
          {toastMsg}
        </div>
      ) : null}
    </PipelineStepFrame>
  );
}
