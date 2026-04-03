/**
 * Shared Excel / worksheet chrome for student detail — borders, header grays, tight typography.
 */
export const SX = {
  pageWrap: "flex flex-col gap-0 pb-10",

  outerSheet:
    "overflow-hidden rounded-[2px] border border-[#c6c6c6] bg-[#f5f5f5] shadow-[0_1px_4px_rgba(0,0,0,0.07)]",

  toolbar:
    "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#c6c6c6] bg-[linear-gradient(180deg,#fafafa_0%,#f0f0f0_100%)] px-3 py-2",

  toolbarTitle: "text-[13px] font-semibold tracking-tight text-[#212121]",
  toolbarMeta: "text-[12px] text-[#757575]",

  /** CRM-style student hero (reference: name + badge + icon row) */
  studentHero:
    "border-b border-[#e8eaed] bg-white",
  studentHeroTop:
    "flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 sm:px-6",
  studentHeroBack:
    "text-[13px] font-medium text-[#1565c0] transition-colors hover:text-[#0d47a1] hover:underline",
  studentHeroMetaTop: "text-[13px] text-[#5f6368]",
  studentHeroBody: "px-4 pb-6 pt-1 sm:px-6",
  studentHeroTitleRow:
    "flex flex-wrap items-start justify-between gap-4 gap-y-2",
  studentHeroName:
    "text-[22px] font-bold leading-tight tracking-tight text-[#202124] sm:text-[26px]",
  studentHeroIconRow:
    "mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 text-[14px]",
  studentHeroIconItem: "inline-flex items-center gap-2.5 text-[#5f6368]",
  studentHeroIcon: "h-5 w-5 shrink-0",
  studentHeroCourseBadge:
    "rounded-full bg-[#e3f2fd] px-3 py-0.5 text-[13px] font-semibold text-[#1565c0]",
  studentHeroSubline: "mt-4 text-[13px] leading-relaxed text-[#5f6368]",
  studentHeroSubLabel: "text-[#80868b]",
  studentHeroSubVal: "font-medium text-[#202124]",

  kvWrap: "border-b border-[#d0d0d0] bg-white",
  kvTable: "w-full border-collapse text-[13px]",
  kvTh:
    "w-[min(32%,160px)] whitespace-nowrap border border-[#d0d0d0] bg-[#f2f2f2] px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#424242]",
  kvTd:
    "border border-[#d0d0d0] bg-white px-2.5 py-1.5 text-[#212121] align-middle",

  /** Lead summary ribbon — labels are chips (field names), values read as data. */
  summaryRow:
    "flex min-h-[40px] w-full min-w-0 flex-nowrap items-stretch overflow-x-auto border-b border-[#d0d0d0] bg-[#fafafa] text-[13px] leading-tight [scrollbar-width:thin]",
  summarySeg:
    "flex shrink-0 items-center gap-2 border-r border-[#d0d0d0] bg-white px-2.5 py-2 last:border-r-0",
  /** Excel “column header” pill — distinct from cell values */
  summaryLblChip:
    "shrink-0 rounded-[2px] bg-[#e8eaf0] px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-[#455a64]",
  summaryLbl:
    "shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#616161]",
  summaryVal: "min-w-0 text-[13px] text-[#212121]",
  summaryValStrong: "min-w-0 font-medium text-[#212121]",
  summaryValMuted: "min-w-0 whitespace-nowrap text-[12px] text-[#757575]",

  /** Pipeline stepper — one system block: steps + status strip (no floating gap). */
  stepperShell: "border-b border-[#d0d0d0] bg-white",
  stepperTrack: "bg-[#eceff1] px-px pt-px",
  stepperGrid: "grid grid-cols-5 gap-px bg-[#b0bec5] p-px",
  stepperStatusBar:
    "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#d0d0d0] bg-[#f5f7fa] px-3 py-2 text-[12px] text-[#546e7a]",

  mainSplit: "flex flex-col bg-[#eceff1] lg:flex-row lg:items-stretch",
  /** Main step workspace — grey “sheet well” like Excel page margin */
  mainPane:
    "flex min-h-0 min-w-0 flex-[1] flex-col bg-[#eceff1] p-2 lg:border-r lg:border-[#d0d0d0]",
  /** Right column — same workbook grid language */
  asidePane:
    "w-full shrink-0 bg-white lg:w-[min(30%,340px)] lg:min-w-[272px] lg:border-l lg:border-[#d0d0d0]",

  section: "scroll-mt-20 overflow-hidden border border-[#d0d0d0] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
  sectionHead:
    "flex flex-wrap items-center justify-between gap-2 border-b border-[#d0d0d0] bg-[#f2f2f2] px-2.5 py-1.5",
  sectionTitle: "text-[13px] font-bold tracking-tight text-[#212121]",
  sectionBody: "p-2",

  dataTable: "w-full border-collapse text-[13px]",
  dataTh:
    "border border-[#d0d0d0] bg-[#f2f2f2] px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#424242]",
  dataTd:
    "border border-[#d0d0d0] bg-white px-2 py-1.5 align-middle text-[13px] text-[#212121]",
  dataTdMuted:
    "border border-[#d0d0d0] bg-white px-2 py-1.5 align-middle text-[13px] text-[#757575]",

  zebraRow: "bg-[#fafafa]",

  input:
    "h-8 w-full rounded-[2px] border border-[#d0d0d0] bg-white px-2 text-[13px] text-[#212121] shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] focus:border-[#1565c0] focus:outline-none focus:ring-1 focus:ring-[#1565c0]",
  textarea:
    "w-full rounded-[2px] border border-[#d0d0d0] bg-white px-2 py-1.5 text-[13px] leading-relaxed shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] focus:border-[#1565c0] focus:outline-none focus:ring-1 focus:ring-[#1565c0]",
  select:
    "h-8 rounded-[2px] border border-[#d0d0d0] bg-white px-2 text-[13px] shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] focus:border-[#1565c0] focus:outline-none focus:ring-1 focus:ring-[#1565c0]",

  sidePanel: "border-b border-[#d0d0d0] bg-white last:border-b-0",
  sideHead:
    "border-b border-[#d0d0d0] bg-[#f2f2f2] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#424242]",
  sideBody: "p-2",
  asideIntro:
    "border-b border-[#d0d0d0] bg-[#f5f7fa] px-2.5 py-1.5 text-[11px] leading-snug text-[#546e7a]",

  btnPrimary:
    "inline-flex items-center justify-center rounded-[2px] border border-[#12579e] bg-[#1565c0] px-3 py-1.5 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-colors hover:bg-[#12579e]",
  btnSecondary:
    "inline-flex items-center justify-center rounded-[2px] border border-[#d0d0d0] bg-[#fafafa] px-3 py-1.5 text-[13px] font-medium text-[#212121] transition-colors hover:bg-[#f0f0f0]",
  btnGhost:
    "inline-flex items-center justify-center rounded-[2px] border border-transparent px-2 py-1 text-[13px] font-medium text-[#1565c0] underline-offset-2 hover:underline",

  footerBar:
    "grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-[#d0d0d0] bg-white px-2 py-1.5",

  /** Lead Management (home grid) — same workbook language as student detail */
  leadPageRoot: "flex flex-col gap-0",
  leadWorkbook:
    "overflow-hidden rounded-[2px] border border-[#c6c6c6] bg-[#ebebeb] shadow-[0_1px_4px_rgba(0,0,0,0.07)]",
  leadToolbar:
    "flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-[#c6c6c6] bg-[linear-gradient(180deg,#fafafa_0%,#f0f0f0_100%)] px-2.5 py-1.5",
  leadToolbarIconBtn:
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] border border-[#d0d0d0] bg-white text-[#424242] transition-colors hover:bg-[#fafafa]",
  leadSearch:
    "h-8 min-w-[140px] max-w-[min(100%,320px)] flex-1 rounded-[2px] border border-[#d0d0d0] bg-white px-2.5 text-[13px] shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] placeholder:text-[#9e9e9e] focus:border-[#1565c0] focus:outline-none focus:ring-1 focus:ring-[#1565c0]",
  leadSelectSm:
    "h-8 rounded-[2px] border border-[#d0d0d0] bg-white px-2 text-[13px] disabled:opacity-45",
  leadStatBar:
    "flex flex-wrap items-center gap-x-6 gap-y-0.5 border-b border-[#d0d0d0] bg-white px-3 py-1.5 text-[12px] leading-tight",
  leadTabBar: "flex min-h-[38px] w-full gap-px bg-[#c6c6c6] p-px",
  leadTabBtn:
    "flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2 text-center text-[12px] font-semibold transition-colors sm:px-3",
  leadTabActive:
    "bg-white text-[#1565c0] shadow-[inset_0_-2px_0_0_#1565c0]",
  leadTabIdle: "bg-[#f5f5f5] text-[#616161] hover:bg-[#ececec]",
  leadTabCount:
    "rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
  leadTabCountActive: "bg-[#e3f2fd] text-[#1565c0]",
  leadTabCountIdle: "bg-[#e0e0e0] text-[#616161]",
  leadSheetBody: "border-x border-b border-[#d0d0d0] bg-white",
  leadSectionHead:
    "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-[#d0d0d0] bg-[#f2f2f2] px-2 py-1.5",
  leadSectionTitle: "text-[13px] font-bold tracking-tight text-[#212121]",
  leadSectionMeta: "text-[11px] text-[#757575]",
  leadGridFlush: "rounded-none border-t-0",
  leadPopover:
    "absolute left-0 top-full z-50 mt-1 w-[280px] rounded-[2px] border border-[#d0d0d0] bg-white p-3 text-[#212121] shadow-[0_4px_16px_rgba(0,0,0,0.1)]",
  leadBtnGreen:
    "inline-flex h-8 items-center rounded-[2px] border border-[#2e7d32] bg-[#2e7d32] px-3 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[#27692a]",
  leadBtnOutline:
    "inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-[#d0d0d0] bg-white px-3 text-[13px] font-medium text-[#212121] hover:bg-[#fafafa]",
} as const;
