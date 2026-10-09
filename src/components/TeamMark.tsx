import type { Team } from "../types";
export default function TeamMark({ team, size = "md" }: { team?: Pick<Team, "name" | "logo_url"> | null; size?: "sm" | "md" | "lg" }) {
  if (!team) return <span className={`team-mark ${size}`}>?</span>;
  return <span className={`team-mark ${size}`}>{team.logo_url
    ? <img src={team.logo_url} alt={`${team.name} logo`} />
    : team.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</span>;
}
