import { useState, useEffect } from "react";
import type { Team } from "../types";

export default function TeamMark({
  team,
  size = "md",
}: {
  team?: Pick<Team, "name" | "logo_url"> | null;
  size?: "sm" | "md" | "lg";
}) {
  const [imageError, setImageError] = useState(false);

  // Reset error state when team or logo URL changes
  useEffect(() => {
    setImageError(false);
  }, [team?.logo_url]);

  if (!team) return <span className={`team-mark ${size}`}>?</span>;

  const hasValidLogo = Boolean(team.logo_url && team.logo_url.trim() !== "");
  const initials = team.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <span className={`team-mark ${size}`}>
      {hasValidLogo && !imageError ? (
        <img
          src={team.logo_url!}
          alt={`${team.name} logo`}
          onError={() => setImageError(true)}
        />
      ) : (
        initials || "?"
      )}
    </span>
  );
}