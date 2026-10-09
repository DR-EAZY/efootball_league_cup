import type { Fixture, Season, Standing, Team } from "../types";
import { requireSupabase } from "../lib/supabase";
import { calculateStandings } from "../lib/fixtures";

export async function getSeasons(): Promise<Season[]> {
  const { data, error } = await requireSupabase().from("seasons").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Season[];
}
export async function getActiveSeason(): Promise<Season | null> {
  const { data, error } = await requireSupabase().from("seasons").select("*").eq("status", "active").maybeSingle();
  if (error) throw error;
  return data as Season | null;
}
export async function getTeams(seasonId?: string): Promise<Team[]> {
  let query = requireSupabase().from("teams").select("*").order("name");
  if (seasonId) query = query.eq("season_id", seasonId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Team[];
}
export async function getFixtures(seasonId?: string): Promise<Fixture[]> {
  let query = requireSupabase().from("fixtures")
    .select("*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)")
    .order("matchday").order("scheduled_at", { ascending: true, nullsFirst: false });
  if (seasonId) query = query.eq("season_id", seasonId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Fixture[];
}
export async function getStandings(seasonId: string): Promise<Standing[]> {
  const [teams, fixtures] = await Promise.all([getTeams(seasonId), getFixtures(seasonId)]);
  return calculateStandings(teams, fixtures);
}
export async function saveTeam(input: Partial<Team> & Pick<Team, "name" | "season_id">): Promise<Team> {
  const client = requireSupabase();
  const payload = { ...input, name: input.name.trim() };
  const query = input.id
    ? client.from("teams").update(payload).eq("id", input.id).select().single()
    : client.from("teams").insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data as Team;
}
export async function deleteTeam(id: string): Promise<void> {
  const client = requireSupabase();
  const { count, error: checkError } = await client.from("fixtures").select("id", { count: "exact", head: true })
    .or(`home_team_id.eq.${id},away_team_id.eq.${id}`);
  if (checkError) throw checkError;
  if ((count ?? 0) > 0) throw new Error("This team has fixtures attached. Remove or reassign those fixtures before deleting the team.");
  const { error } = await client.from("teams").delete().eq("id", id);
  if (error) throw error;
}
export async function saveFixture(input: Partial<Fixture> & Pick<Fixture, "season_id" | "matchday" | "home_team_id" | "away_team_id">): Promise<void> {
  if (input.home_team_id === input.away_team_id) throw new Error("A team cannot play against itself.");
  const client = requireSupabase();
  const payload = {
    season_id: input.season_id, matchday: input.matchday,
    home_team_id: input.home_team_id, away_team_id: input.away_team_id,
    scheduled_at: input.scheduled_at || null, status: input.status ?? "scheduled",
    home_score: input.status === "completed" ? input.home_score : null,
    away_score: input.status === "completed" ? input.away_score : null,
    notes: input.notes ?? null
  };
  const query = input.id
    ? client.from("fixtures").update(payload).eq("id", input.id)
    : client.from("fixtures").insert(payload);
  const { error } = await query;
  if (error) throw error;
}
export async function saveSeason(name: string): Promise<void> {
  const { error } = await requireSupabase().from("seasons").insert({ name: name.trim(), status: "upcoming" });
  if (error) throw error;
}
export async function activateSeason(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc("activate_season", { target_season_id: id });
  if (error) throw error;
}
