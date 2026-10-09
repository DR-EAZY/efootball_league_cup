import type { Fixture, Standing, Team } from "../types";

export interface GeneratedFixture {
  matchday: number;
  home_team_id: string;
  away_team_id: string;
}

export function generateRoundRobin(teams: Pick<Team, "id">[], doubleRoundRobin = false): GeneratedFixture[] {
  if (teams.length < 2) return [];
  const list: Array<string | null> = teams.map((team) => team.id);
  if (list.length % 2 === 1) list.push(null);
  const rounds = list.length - 1;
  const half = list.length / 2;
  const rotation = [...list];
  const firstLeg: GeneratedFixture[] = [];

  for (let round = 0; round < rounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const a = rotation[i];
      const b = rotation[rotation.length - 1 - i];
      if (a && b) {
        const flip = (round + i) % 2 === 1;
        firstLeg.push({
          matchday: round + 1,
          home_team_id: flip ? b : a,
          away_team_id: flip ? a : b
        });
      }
    }
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rest.unshift(rest.pop()!);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  if (!doubleRoundRobin) return firstLeg;
  return [
    ...firstLeg,
    ...firstLeg.map((fixture) => ({
      matchday: fixture.matchday + rounds,
      home_team_id: fixture.away_team_id,
      away_team_id: fixture.home_team_id
    }))
  ];
}

export function calculateStandings(teams: Team[], fixtures: Fixture[]): Standing[] {
  const rows = new Map<string, Standing>();
  for (const team of teams) {
    rows.set(team.id, {
      position: 0, team_id: team.id, team_name: team.name, logo_url: team.logo_url,
      played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0,
      goal_difference: 0, points: 0, form: []
    });
  }
  const completed = fixtures
    .filter((f) => f.status === "completed" && f.home_score !== null && f.away_score !== null)
    .sort((a, b) => (a.scheduled_at ?? a.created_at).localeCompare(b.scheduled_at ?? b.created_at));

  for (const fixture of completed) {
    const home = rows.get(fixture.home_team_id);
    const away = rows.get(fixture.away_team_id);
    if (!home || !away) continue;
    const hs = fixture.home_score!;
    const as = fixture.away_score!;
    home.played += 1; away.played += 1;
    home.goals_for += hs; home.goals_against += as;
    away.goals_for += as; away.goals_against += hs;
    if (hs > as) {
      home.won += 1; home.points += 3; away.lost += 1;
      home.form.push("W"); away.form.push("L");
    } else if (hs < as) {
      away.won += 1; away.points += 3; home.lost += 1;
      home.form.push("L"); away.form.push("W");
    } else {
      home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1;
      home.form.push("D"); away.form.push("D");
    }
  }
  const sorted = [...rows.values()].map((row) => ({
    ...row, goal_difference: row.goals_for - row.goals_against, form: row.form.slice(-5)
  })).sort((a, b) =>
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for ||
    a.team_name.localeCompare(b.team_name)
  );
  return sorted.map((row, index) => ({ ...row, position: index + 1 }));
}
