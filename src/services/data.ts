
import type { Fixture, Season, Standing, Team } from "../types";
import { requireSupabase } from "../lib/supabase";
import { calculateStandings } from "../lib/fixtures";

/* =========================================================
   GENERATED FIXTURE TYPE
========================================================= */

export type GeneratedFixture = {
  matchday: number;
  home_team_id: string;
  away_team_id: string;
};

/* =========================================================
   SEASONS
========================================================= */

export async function getSeasons(): Promise<Season[]> {
  const client = requireSupabase();

  const { data, error } = await client
    .from("seasons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as Season[];
}

export async function getActiveSeason(): Promise<Season | null> {
  const client = requireSupabase();

  const { data, error } = await client
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;

  return (data as Season | null) ?? null;
}

export async function saveSeason(name: string): Promise<void> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Enter a season name.");
  }

  const client = requireSupabase();

  const { error } = await client.from("seasons").insert({
    name: trimmedName,
    status: "upcoming",
  });

  if (error) throw error;
}

export async function activateSeason(id: string): Promise<void> {
  if (!id) {
    throw new Error("Select a season to activate.");
  }

  const client = requireSupabase();

  // First deactivate the current active season.
  const { error: deactivateError } = await client
    .from("seasons")
    .update({ status: "upcoming" })
    .eq("status", "active");

  if (deactivateError) throw deactivateError;

  // Then activate the selected season.
  const { error: activateError } = await client
    .from("seasons")
    .update({ status: "active" })
    .eq("id", id);

  if (activateError) throw activateError;
}

/* =========================================================
   TEAMS
========================================================= */

export async function getTeams(
  seasonId?: string
): Promise<Team[]> {
  const client = requireSupabase();

  let query = client
    .from("teams")
    .select("*")
    .order("name", { ascending: true });

  if (seasonId) {
    query = query.eq("season_id", seasonId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as Team[];
}

export async function saveTeam(
  input: Partial<Team> & Pick<Team, "name" | "season_id">
): Promise<Team> {
  const client = requireSupabase();

  const name = input.name.trim();

  if (!name) {
    throw new Error("Enter a team name.");
  }

  if (!input.season_id) {
    throw new Error("Select a season for this team.");
  }

  const payload = {
    name,
    season_id: input.season_id,
    manager_name: input.manager_name || null,
    ign: input.ign || null,
    logo_url: input.logo_url || null,
  };

  if (input.id) {
    const { data, error } = await client
      .from("teams")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();

    if (error) throw error;

    return data as Team;
  }

  const { data, error } = await client
    .from("teams")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  return data as Team;
}

export async function deleteTeam(id: string): Promise<void> {
  if (!id) {
    throw new Error("Select a team to delete.");
  }

  const client = requireSupabase();

  const { error } = await client
    .from("teams")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/* =========================================================
   FIXTURES
========================================================= */

export async function getFixtures(
  seasonId?: string
): Promise<Fixture[]> {
  const client = requireSupabase();

  let query = client
    .from("fixtures")
    .select(`
      *,
      home_team:teams!fixtures_home_team_id_fkey(*),
      away_team:teams!fixtures_away_team_id_fkey(*)
    `)
    .order("matchday", { ascending: true })
    .order("scheduled_at", { ascending: true });

  if (seasonId) {
    query = query.eq("season_id", seasonId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as Fixture[];
}

export async function saveFixture(
  input: Partial<Fixture> &
    Pick<
      Fixture,
      "season_id" | "matchday" | "home_team_id" | "away_team_id"
    >
): Promise<void> {
  if (!input.season_id) {
    throw new Error("Select a season.");
  }

  if (
    !input.home_team_id ||
    !input.away_team_id ||
    input.home_team_id === input.away_team_id
  ) {
    throw new Error("A fixture must have two different teams.");
  }

  if (!Number.isInteger(input.matchday) || input.matchday < 1) {
    throw new Error("Matchday must be a positive whole number.");
  }

  const client = requireSupabase();
  const status = input.status ?? "scheduled";

  const payload = {
    season_id: input.season_id,
    matchday: input.matchday,
    home_team_id: input.home_team_id,
    away_team_id: input.away_team_id,
    scheduled_at: input.scheduled_at || null,
    status,
    home_score:
      status === "completed" ? input.home_score ?? null : null,
    away_score:
      status === "completed" ? input.away_score ?? null : null,
    notes: input.notes || null,
  };

  if (
    status === "completed" &&
    (
      payload.home_score === null ||
      payload.away_score === null ||
      !Number.isInteger(payload.home_score) ||
      !Number.isInteger(payload.away_score) ||
      payload.home_score < 0 ||
      payload.away_score < 0
    )
  ) {
    throw new Error(
      "A completed fixture must have valid, non-negative scores."
    );
  }

  const query = input.id
    ? client
        .from("fixtures")
        .update(payload)
        .eq("id", input.id)
    : client.from("fixtures").insert(payload);

  const { error } = await query;

  if (error) throw error;
}

/* =========================================================
   BULK FIXTURE GENERATION
========================================================= */

export async function saveFixturesBulk(
  seasonId: string,
  fixtures: GeneratedFixture[]
): Promise<void> {
  if (!seasonId) {
    throw new Error("Select a season before generating fixtures.");
  }

  if (fixtures.length === 0) {
    throw new Error("There are no fixtures to save.");
  }

  const client = requireSupabase();

  // Prevent a team from playing more than once in a matchday.
  const teamsPerMatchday = new Map<number, Set<string>>();

  // Prevent duplicate home/away pairings in the submitted schedule.
  const pairings = new Set<string>();

  for (const fixture of fixtures) {
    if (
      !Number.isInteger(fixture.matchday) ||
      fixture.matchday < 1
    ) {
      throw new Error("Every fixture must have a valid matchday.");
    }

    if (
      !fixture.home_team_id ||
      !fixture.away_team_id ||
      fixture.home_team_id === fixture.away_team_id
    ) {
      throw new Error(
        "A fixture must have two different teams."
      );
    }

    const pairingKey = [
      fixture.matchday,
      fixture.home_team_id,
      fixture.away_team_id,
    ].join(":");

    if (pairings.has(pairingKey)) {
      throw new Error("The generated schedule contains a duplicate fixture.");
    }

    pairings.add(pairingKey);

    if (!teamsPerMatchday.has(fixture.matchday)) {
      teamsPerMatchday.set(
        fixture.matchday,
        new Set<string>()
      );
    }

    const teams = teamsPerMatchday.get(fixture.matchday)!;

    if (
      teams.has(fixture.home_team_id) ||
      teams.has(fixture.away_team_id)
    ) {
      throw new Error(
        `A team appears more than once on matchday ${fixture.matchday}.`
      );
    }

    teams.add(fixture.home_team_id);
    teams.add(fixture.away_team_id);
  }

  const rows = fixtures.map((fixture) => ({
    season_id: seasonId,
    matchday: fixture.matchday,
    home_team_id: fixture.home_team_id,
    away_team_id: fixture.away_team_id,
    scheduled_at: null,
    status: "scheduled" as const,
    home_score: null,
    away_score: null,
    notes: null,
  }));

  // One bulk insert for the complete schedule.
  const { error } = await client
    .from("fixtures")
    .insert(rows);

  if (error) throw error;
}

/* =========================================================
   DELETE ALL FIXTURES FOR ONE SEASON
========================================================= */

export async function deleteAllFixtures(
  seasonId: string
): Promise<number> {
  if (!seasonId) {
    throw new Error("Select a season before deleting fixtures.");
  }

  const client = requireSupabase();

  const { data, error } = await client
    .from("fixtures")
    .delete()
    .eq("season_id", seasonId)
    .select("id");

  if (error) throw error;

  return data?.length ?? 0;
}

/* =========================================================
   LEAGUE STANDINGS
========================================================= */

export async function getStandings(
  seasonId: string
): Promise<Standing[]> {
  if (!seasonId) {
    return [];
  }

  const [teams, fixtures] = await Promise.all([
    getTeams(seasonId),
    getFixtures(seasonId),
  ]);

  return calculateStandings(teams, fixtures);
}