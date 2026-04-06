"use client";

import {
  brochurePathLooksLikeImage,
  brochureSrcIsLikelyEmbeddable,
  brochureUrlLooksLikeImage,
} from "@/lib/brochurePreview";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  fileLabel: string;
  className?: string;
};

export function BrochureInlinePreviewFrame({ src, fileLabel, className }: Props) {
  const isImg =
    brochurePathLooksLikeImage(src) || brochureUrlLooksLikeImage(src);
  const canEmbed = brochureSrcIsLikelyEmbeddable(src);

  return (
    <div
      className={cn(
        "flex w-full max-w-full flex-col overflow-hidden rounded-2xl border border-slate-300/75 bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/5",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/90 bg-gradient-to-r from-slate-50 to-white px-3 py-2.5 sm:px-4">
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight text-slate-800">
          {fileLabel}
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-primary shadow-sm transition-colors hover:bg-slate-50"
        >
          Open tab
        </a>
      </div>
      <div className="bg-slate-200/80 p-2 sm:p-3">
        <div className="overflow-hidden rounded-xl bg-white shadow-[inset_0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-slate-300/50">
          {!canEmbed ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 bg-slate-50 px-4 py-10 text-center">
              <p className="max-w-sm text-[13px] leading-relaxed text-slate-600">
                Inline preview isn&apos;t available for this file type. Open the
                file in a new tab or download it.
              </p>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-semibold text-primary underline"
              >
                Open or download
              </a>
            </div>
          ) : isImg ? (
            <div className="flex max-h-[min(58vh,520px)] min-h-[240px] items-center justify-center overflow-auto bg-slate-50/50 p-3">
              <img
                src={src}
                alt=""
                className="max-h-[min(58vh,500px)] w-full max-w-full object-contain"
              />
            </div>
          ) : (
            <iframe
              title={fileLabel}
              src={src}
              className="block h-[min(58vh,520px)] min-h-[280px] w-full border-0 bg-white"
            />
          )}
        </div>
      </div>
      <p className="border-t border-slate-100 bg-slate-50/90 px-3 py-2 text-center text-[11px] leading-snug text-slate-500 sm:px-4">
        If this area is empty, the host may block embedding — use{" "}
        <span className="font-medium text-slate-600">Open tab</span>.
      </p>
    </div>
  );
}
