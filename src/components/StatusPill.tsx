import type { FixtureStatus } from "../types";
export default function StatusPill({ status }: { status: FixtureStatus }) {
  const labels: Record<FixtureStatus, string> = {
    scheduled: "Scheduled", completed: "Full time", postponed: "Postponed", cancelled: "Cancelled"
  };
  return <span className={`status status-${status}`}>{labels[status]}</span>;
}
