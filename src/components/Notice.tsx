import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
export default function Notice({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: React.ReactNode }) {
  const Icon = kind === "error" ? AlertTriangle : kind === "success" ? CheckCircle2 : Info;
  return <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}><Icon size={18} /> <span>{children}</span></div>;
}
