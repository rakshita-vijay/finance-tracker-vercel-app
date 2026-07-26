import { createClient } from "@/lib/supabase/server";
import type { Report } from "@/lib/types";
import ReportGenerator from "./ReportGenerator";
import ReportHistoryItem from "./ReportHistoryItem";

export default async function GenerateReportPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, content, analysis, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1>📝 Generate AI Report</h1>
      <div className="divider" />
      <ReportGenerator />
      <div className="divider" />
      <h3>Report History</h3>
      <p style={{ color: "var(--muted)" }}>
        Every report you generate is saved here permanently - refreshing or coming back later won&apos;t lose it.
      </p>
      {(reports ?? []).length === 0 && <p>No reports generated yet.</p>}
      {(reports as Report[] | null)?.map((r) => (
        <ReportHistoryItem key={r.id} report={r} />
      ))}
    </div>
  );
}
