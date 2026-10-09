export type Role = "admin" | "viewer";
export type SeasonStatus = "active" | "archived" | "upcoming";
export type FixtureStatus = "scheduled" | "completed" | "postponed" | "cancelled";

export interface Profile {
  id: string;
  display_name: string | null;
  role: Role;
}
export interface Season {
  id: string;
  name: string;
  status: SeasonStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}
export interface Team {
  id: string;
  season_id: string;
  name: string;
  manager_name: string | null;
  ign: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}
export interface Fixture {
  id: string;
  season_id: string;
  matchday: number;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string | null;
  status: FixtureStatus;
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  home_team?: Team;
  away_team?: Team;
}
export interface Standing {
  position: number;
  team_id: string;
  team_name: string;
  logo_url: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: Array<"W" | "D" | "L">;
}
