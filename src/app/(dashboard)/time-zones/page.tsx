"use client";

import { useMemo, useState } from "react";
import { listCountryDefaultTimezoneRows } from "@/lib/timezones/countryDefaultTimeZone";
import {
  getGroupedTimeZoneSelectOptions,
  listIanaTimeZones,
} from "@/lib/timezones/ianaTimeZones";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";

export default function TimeZonesReferencePage() {
  const [countryFilter, setCountryFilter] = useState("");
  const [ianaFilter, setIanaFilter] = useState("");

  const countryRows = useMemo(() => listCountryDefaultTimezoneRows(), []);
  const filteredCountries = useMemo(() => {
    const q = countryFilter.trim().toLowerCase();
    if (!q) return countryRows;
    return countryRows.filter(
      (r) =>
        r.country.toLowerCase().includes(q) ||
        r.timeZone.toLowerCase().includes(q),
    );
  }, [countryRows, countryFilter]);

  const ianaZones = useMemo(() => listIanaTimeZones(), []);
  const filteredIana = useMemo(() => {
    const q = ianaFilter.trim().toLowerCase();
    if (!q) return ianaZones;
    return ianaZones.filter((z) => z.toLowerCase().includes(q));
  }, [ianaZones, ianaFilter]);

  const optCount = useMemo(() => getGroupedTimeZoneSelectOptions().length, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Time zones
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-600">
          When you open a student and schedule a demo, the{" "}
          <strong>Student timezone</strong> field defaults from that lead&apos;s{" "}
          <strong>Country</strong> column using the table below. Large countries
          use one representative zone (for example US → Eastern); pick a
          different zone from the full IANA list in the form anytime. Demo
          scheduling exposes{" "}
          <span className="font-medium text-slate-800">
            {optCount} time zones
          </span>{" "}
          grouped by region.
        </p>
      </header>

      <section className="rounded-none border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">
            Country → default timezone
          </h2>
          <p className="mt-1 text-[12px] text-slate-600">
            Aliases are supported (e.g. USA, UK, UAE, IN). Unknown text falls
            back to Asia/Kolkata.
          </p>
          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Filter
          </label>
          <input
            type="search"
            className={cn(SX.input, "mt-1 max-w-md")}
            placeholder="Country or IANA…"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            aria-label="Filter country table"
          />
        </div>
        <div className="max-h-[min(55vh,420px)] overflow-auto">
          <table className={cn(SX.dataTable, "w-full min-w-[320px]")}>
            <thead>
              <tr>
                <th className={SX.dataTh}>Country / label</th>
                <th className={SX.dataTh}>Default IANA</th>
              </tr>
            </thead>
            <tbody>
              {filteredCountries.map((r) => (
                <tr key={`${r.country}|${r.timeZone}`}>
                  <td className={SX.dataTd}>{r.country}</td>
                  <td className={cn(SX.dataTd, "font-mono text-[12px]")}>
                    {r.timeZone}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-none border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">
            All IANA time zones ({ianaZones.length})
          </h2>
          <p className="mt-1 text-[12px] text-slate-600">
            Same identifiers as in the student scheduling dropdown. Search to
            copy a zone name.
          </p>
          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Filter
          </label>
          <input
            type="search"
            className={cn(SX.input, "mt-1 max-w-md")}
            placeholder="e.g. Kolkata, Chicago, London…"
            value={ianaFilter}
            onChange={(e) => setIanaFilter(e.target.value)}
            aria-label="Filter IANA zones"
          />
        </div>
        <div className="max-h-[min(50vh,360px)] overflow-auto px-4 py-3">
          <ul className="columns-1 gap-x-8 text-[12px] text-slate-700 sm:columns-2 md:columns-3">
            {filteredIana.map((z) => (
              <li key={z} className="break-inside-avoid py-0.5 font-mono">
                {z}
              </li>
            ))}
          </ul>
          {filteredIana.length === 0 ? (
            <p className="text-[13px] text-slate-500">No matches.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
