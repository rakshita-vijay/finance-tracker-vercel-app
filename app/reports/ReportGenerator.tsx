"use client";

import { useState, useTransition } from "react";
import { generateReport } from "./actions";
import type { Report } from "@/lib/types";

export default function ReportGenerator() {
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<Report | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    setLatest(null);
    startTransition(async () => {
      const result = await generateReport();
      if (result.error) setError(result.error);
      if (result.success) setLatest(result.report as Report);
    });
  }

  return (
    <div>
      <button onClick={handleGenerate} disabled={isPending}>
        {isPending ? "Generating your report..." : "Generate Report"}
      </button>
      {error && <div className="msg-error">{error}</div>}
      {latest && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="report-body">{latest.content}</div>
          <a href={`/api/download/report/${latest.id}`} download>
            <button style={{ marginTop: 12 }}>Download Report (.md)</button>
          </a>
        </div>
      )}
    </div>
  );
}
