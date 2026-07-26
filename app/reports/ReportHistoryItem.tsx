"use client";

import { useState, useTransition } from "react";
import { deleteReport } from "./actions";
import type { Report } from "@/lib/types";
import Markdown from "@/app/components/Markdown";

export default function ReportHistoryItem({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (hidden) return null;

  return (
    <div className="report-list-item">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="pill">{new Date(report.created_at).toLocaleString()}</span>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="secondary" onClick={() => setOpen(!open)}>
            {open ? "Hide" : "View"}
          </button>
          <a href={`/api/download/report/${report.id}`} download>
            <button className="secondary">Download</button>
          </a>
          <button
            className="danger"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteReport(report.id);
                if (res.success) setHidden(true);
              })
            }
          >
            Delete
          </button>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <Markdown content={report.content} />
        </div>
      )}
      {open && report.analysis && (
        <details style={{ marginTop: 12 }}>
          <summary>Analyst notes (raw agent output, saved as an audit trail)</summary>
          <div style={{ marginTop: 8 }}>
            <Markdown content={report.analysis} />
          </div>
        </details>
      )}
    </div>
  );
}
