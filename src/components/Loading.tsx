export default function Loading({ label = "Loading league data…" }: { label?: string }) {
  return <div className="loading" role="status"><span className="spinner" />{label}</div>;
}
