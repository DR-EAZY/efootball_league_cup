import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays, ChevronRight, CircleDot, Trophy, Users, Search, Crown, Sparkles, Flame, ShieldCheck } from "lucide-react";
import type { Fixture, Season, Standing, Team } from "../types";
import { getActiveSeason, getFixtures, getStandings, getTeams, getSeasons } from "../services/data";
import { isSupabaseConfigured } from "../lib/supabase";
import { readableError } from "../lib/errors";
import TeamMark from "../components/TeamMark";
import StatusPill from "../components/StatusPill";
import Notice from "../components/Notice";
import Loading from "../components/Loading";

function useLeagueData() {
  const [state, setState] = useState<{ loading: boolean; error: string; season: Season | null; teams: Team[]; fixtures: Fixture[]; standings: Standing[]; allSeasons: Season[] }>({
    loading: true, error: "", season: null, teams: [], fixtures: [], standings: [], allSeasons: []
  });
  const refresh = async () => {
    if (!isSupabaseConfigured) { setState(s => ({ ...s, loading: false })); return; }
    try {
      const [season, allSeasons] = await Promise.all([getActiveSeason(), getSeasons()]);
      if (!season) { setState({ loading: false, error: "", season: null, teams: [], fixtures: [], standings: [], allSeasons }); return; }
      const [teams, fixtures, standings] = await Promise.all([getTeams(season.id), getFixtures(season.id), getStandings(season.id)]);
      setState({ loading: false, error: "", season, teams, fixtures, standings, allSeasons });
    } catch (error) { setState(s => ({ ...s, loading: false, error: readableError(error) })); }
  };
  useEffect(() => { void refresh(); }, []);
  return { ...state, refresh };
}

function ConfigNotice() {
  return <Notice kind="error">Database not configured. Copy <code>.env.example</code> to <code>.env.local</code>, add your Supabase URL and publishable key, then restart the dev server.</Notice>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div></div>;
}

function MatchRow({ fixture }: { fixture: Fixture }) {
  return (
    <div className="match-row">
      <div className="match-meta">
        <span>MD {fixture.matchday}</span>
        <span>{fixture.scheduled_at ? new Date(fixture.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date TBC"}</span>
      </div>
      <div className="match-team home">
        <strong>{fixture.home_team?.name ?? "Unknown team"}</strong>
        <TeamMark team={fixture.home_team} />
      </div>
      <div className="match-score">
        {fixture.status === "completed" ? `${fixture.home_score} – ${fixture.away_score}` : <span>VS</span>}
      </div>
      <div className="match-team away">
        <TeamMark team={fixture.away_team} />
        <strong>{fixture.away_team?.name ?? "Unknown team"}</strong>
      </div>
      <StatusPill status={fixture.status}/>
    </div>
  );
}

function getTeamForm(teamId: string, fixtures: Fixture[]): ("W" | "D" | "L")[] {
  const completed = fixtures
    .filter(f => f.status === "completed" && (f.home_team_id === teamId || f.away_team_id === teamId))
    .reverse();

  return completed.slice(0, 5).map(f => {
    const isHome = f.home_team_id === teamId;
    const teamScore = isHome ? (f.home_score ?? 0) : (f.away_score ?? 0);
    const oppScore = isHome ? (f.away_score ?? 0) : (f.home_score ?? 0);

    if (teamScore > oppScore) return "W";
    if (teamScore === oppScore) return "D";
    return "L";
  });
}

function getPositionBadgeStyle(pos: number, totalTeams: number) {
  if (pos === 1) return { borderLeft: "4px solid #eab308", background: "rgba(234, 179, 8, 0.08)" };
  if (pos <= 4) return { borderLeft: "4px solid #3b82f6", background: "rgba(59, 130, 246, 0.08)" };
  if (pos === 5) return { borderLeft: "4px solid #f59e0b", background: "rgba(245, 158, 11, 0.08)" };
  if (totalTeams > 5 && pos > totalTeams - 3) return { borderLeft: "4px solid #ef4444", background: "rgba(239, 68, 68, 0.08)" };
  return { borderLeft: "4px solid transparent" };
}

function StandingsTable({ standings, fixtures = [], compact = false }: { standings: Standing[]; fixtures?: Fixture[]; compact?: boolean }) {
  const data = compact ? standings.slice(0, 5) : standings;

  return (
    <div className="table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>PL</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>GD</th>
            <th>PTS</th>
            {!compact && <th>Form</th>}
          </tr>
        </thead>
        <tbody>
          {data.map(row => {
            const form = getTeamForm(row.team_id, fixtures);
            const spotStyle = getPositionBadgeStyle(row.position, standings.length);

            return (
              <tr key={row.team_id} style={spotStyle}>
                <td className="position" style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                  {row.position === 1 && (
                    <span title="Premier League Cup Holders" style={{ display: "inline-flex", color: "#eab308" }}>
                      <Crown size={15} fill="#eab308" />
                    </span>
                  )}
                  {String(row.position).padStart(2, "0")}
                </td>
                <td>
                  <Link to={`/teams/${row.team_id}`} className="table-team">
                    <TeamMark team={{ name: row.team_name, logo_url: row.logo_url }} size="sm"/>
                    <strong>{row.team_name}</strong>
                    {row.position === 1 && (
                      <span style={{ fontSize: "0.65rem", background: "#eab308", color: "#000", padding: "1px 6px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase", marginLeft: 4 }}>
                        Champion
                      </span>
                    )}
                  </Link>
                </td>
                <td>{row.played}</td>
                <td>{row.won}</td>
                <td>{row.drawn}</td>
                <td>{row.lost}</td>
                <td className={row.goal_difference > 0 ? "positive" : row.goal_difference < 0 ? "negative" : ""}>
                  {row.goal_difference > 0 ? "+" : ""}{row.goal_difference}
                </td>
                <td className="points">{row.points}</td>
                {!compact && (
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      {form.length > 0 ? form.map((res, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: "#fff",
                            background: res === "W" ? "#10b981" : res === "D" ? "#64748b" : "#ef4444"
                          }}
                        >
                          {res}
                        </span>
                      )) : <span className="muted" style={{ fontSize: "0.75rem" }}>—</span>}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {!compact && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "12px 16px", background: "#f8fafc", fontSize: "0.8rem", color: "#64748b", borderTop: "1px solid #e2e8f0" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#eab308" }} /> 1st Place / Champions
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6" }} /> Champions League
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} /> Europa League
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} /> Relegation Zone
          </span>
        </div>
      )}

      {data.length === 0 && (
        <div className="empty-state">
          <Trophy/>
          <strong>No standings yet</strong>
          <p>Add teams and publish completed results to build the table.</p>
        </div>
      )}
    </div>
  );
}

export function OverviewPage() {
  const data = useLeagueData();
  const completed = data.fixtures.filter(f => f.status === "completed");
  const upcoming = data.fixtures.filter(f => f.status === "scheduled").slice(0, 3);
  const latest = [...completed].reverse().slice(0, 3);
  const leader = data.standings.length > 0 ? data.standings[0] : null;

  const isSeasonFinished = data.fixtures.length > 0 && data.fixtures.every(f => f.status === "completed");

  const statsMap: Record<string, { team: Team; goalsFor: number; goalsAgainst: number }> = {};
  data.teams.forEach(t => {
    statsMap[t.id] = { team: t, goalsFor: 0, goalsAgainst: 0 };
  });

  completed.forEach(f => {
    const hs = f.home_score ?? 0;
    const as = f.away_score ?? 0;
    if (f.home_team_id && statsMap[f.home_team_id]) {
      statsMap[f.home_team_id].goalsFor += hs;
      statsMap[f.home_team_id].goalsAgainst += as;
    }
    if (f.away_team_id && statsMap[f.away_team_id]) {
      statsMap[f.away_team_id].goalsFor += as;
      statsMap[f.away_team_id].goalsAgainst += hs;
    }
  });

  const teamStatsArr = Object.values(statsMap);
  const topScorers = [...teamStatsArr].sort((a, b) => b.goalsFor - a.goalsFor).slice(0, 3);
  const bestDefense = [...teamStatsArr].filter(s => s.goalsFor > 0 || s.goalsAgainst > 0).sort((a, b) => a.goalsAgainst - b.goalsAgainst).slice(0, 3);

  if (data.loading) return <Loading />;

  return (
    <>
      {!isSupabaseConfigured && <ConfigNotice/>}
      {data.error && <Notice kind="error">{data.error}</Notice>}

      {isSeasonFinished && leader && (
        <section className="panel" style={{ background: "linear-gradient(135deg, #ca8a04 0%, #a16207 100%)", color: "#ffffff", padding: "32px", textAlign: "center", marginBottom: 24, border: "2px solid #fde047", boxShadow: "0 10px 25px rgba(202, 138, 4, 0.3)" }}>
          <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.2)", padding: "8px 16px", borderRadius: 20, marginBottom: 12, alignItems: "center", gap: 8, fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <Sparkles size={16} /> Official Season Champions Crowned
          </div>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 900, marginBottom: 8, color: "#fff" }}>{leader.team_name}</h1>
          <p style={{ fontSize: "1.1rem", opacity: 0.9, maxWidth: 600, margin: "0 auto 20px auto" }}>
            Congratulations to {leader.team_name} for winning the {data.season?.name} championship with an incredible {leader.points} points!
          </p>
          <div style={{ display: "inline-flex", gap: 24, background: "rgba(0,0,0,0.2)", padding: "12px 24px", borderRadius: 12, fontSize: "0.9rem" }}>
            <span>Played: <strong>{leader.played}</strong></span>
            <span>Won: <strong>{leader.won}</strong></span>
            <span>Goal Diff: <strong>{leader.goal_difference > 0 ? `+${leader.goal_difference}` : leader.goal_difference}</strong></span>
          </div>
        </section>
      )}

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow light"><CircleDot size={12}/> PREMIER eFOOTBALL LEAGUE</span>
          <h1>Every match.<br/><em>Every moment.</em></h1>
          <p>The premier destination for elite club fixtures, live title races, and tournament standings.</p>
          <div className="hero-actions">
            <Link className="button button-light" to="/standings">View standings <ArrowRight size={16}/></Link>
            <Link className="hero-text-link" to="/fixtures">Explore fixtures <ChevronRight size={16}/></Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one"/>
          <div className="orbit orbit-two"/>
          <div className="hero-ball">T</div>
          <span className="hero-number">01</span>
          <span className="hero-vertical">PREMIER DIVISION</span>
        </div>
        <div className="hero-season">
          <span>ACTIVE SEASON</span>
          <strong>{data.season?.name ?? "Season not set"}</strong>
          <span className="season-dot">{isSeasonFinished ? "★ Season Completed" : data.season ? "● Competition active" : "○ Waiting for setup"}</span>
        </div>
      </section>

      <section className="stat-strip">
        <div><span>REGISTERED CLUBS</span><strong>{data.teams.length.toString().padStart(2, "0")}</strong><Users/></div>
        <div><span>MATCHES PLAYED</span><strong>{completed.length.toString().padStart(2, "0")}</strong><CircleDot/></div>
        <div><span>FIXTURES AHEAD</span><strong>{data.fixtures.filter(f => f.status === "scheduled").length.toString().padStart(2, "0")}</strong><CalendarDays/></div>
        <div><span>CUP HOLDER</span><strong className="season-stat">{leader?.team_name ?? "—"}</strong><Crown size={16} style={{ color: "#eab308", display: "inline" }}/></div>
      </section>

      <div className="content-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {leader && !isSeasonFinished && (
            <section className="panel" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", color: "#ffffff", border: "1px solid #4338ca" }}>
              <div className="section-head" style={{ borderBottomColor: "rgba(255,255,255,0.1)" }}>
                <div>
                  <span className="eyebrow" style={{ color: "#fbbf24", display: "flex", alignItems: "center", gap: 4 }}>
                    <Crown size={14} fill="#fbbf24" /> PREMIER CUP LEADERS (#1)
                  </span>
                  <h2 style={{ color: "#ffffff" }}>{leader.team_name}</h2>
                </div>
                <Link to="/standings" className="subtle-link" style={{ color: "#fbbf24" }}>Full table <ArrowRight size={15}/></Link>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0" }}>
                <TeamMark team={{ name: leader.team_name, logo_url: leader.logo_url }} size="lg"/>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: "1.1rem", display: "block", marginBottom: 4 }}>Current Cup Crown Holder</strong>
                  <span style={{ color: "#cbd5e1", fontSize: "0.875rem" }}>Played: {leader.played} · Won: {leader.won} · GD: {leader.goal_difference > 0 ? `+${leader.goal_difference}` : leader.goal_difference}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ display: "block", fontSize: "1.75rem", fontWeight: 800, color: "#fbbf24" }}>{leader.points}</span>
                  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#cbd5e1" }}>Points</span>
                </div>
              </div>
            </section>
          )}

          <section className="panel">
            <div className="section-head">
              <div><span className="eyebrow">PREMIER TABLE</span><h2>League standings</h2></div>
              <Link to="/standings" className="subtle-link">Full table <ArrowRight size={15}/></Link>
            </div>
            <StandingsTable standings={data.standings} fixtures={data.fixtures} compact/>
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <section className="panel" style={{ padding: 20 }}>
              <div className="section-head" style={{ marginBottom: 12 }}>
                <div>
                  <span className="eyebrow" style={{ color: "#ea580c", display: "flex", alignItems: "center", gap: 4 }}>
                    <Flame size={14} /> GOLDEN BOOT
                  </span>
                  <h3 style={{ fontSize: "1.1rem" }}>Top Scorers</h3>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topScorers.map((s, i) => (
                  <div key={s.team.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b" }}>#{i + 1}</span>
                      <TeamMark team={s.team} size="sm" />
                      <div>
                        <strong style={{ fontSize: "0.85rem", display: "block" }}>{s.team.name}</strong>
                        <span style={{ fontSize: "0.7rem", color: "#64748b" }}>{s.team.manager_name || "Manager TBC"}</span>
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, color: "#ea580c", fontSize: "0.95rem" }}>{s.goalsFor} ⚽</span>
                  </div>
                ))}
                {topScorers.length === 0 && <span className="muted" style={{ fontSize: "0.85rem" }}>No goals recorded yet.</span>}
              </div>
            </section>

            <section className="panel" style={{ padding: 20 }}>
              <div className="section-head" style={{ marginBottom: 12 }}>
                <div>
                  <span className="eyebrow" style={{ color: "#0284c7", display: "flex", alignItems: "center", gap: 4 }}>
                    <ShieldCheck size={14} /> BEST DEFENSE
                  </span>
                  <h3 style={{ fontSize: "1.1rem" }}>Fewest Conceded</h3>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {bestDefense.map((s, i) => (
                  <div key={s.team.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b" }}>#{i + 1}</span>
                      <TeamMark team={s.team} size="sm" />
                      <div>
                        <strong style={{ fontSize: "0.85rem", display: "block" }}>{s.team.name}</strong>
                        <span style={{ fontSize: "0.7rem", color: "#64748b" }}>{s.team.manager_name || "Manager TBC"}</span>
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, color: "#0284c7", fontSize: "0.95rem" }}>{s.goalsAgainst} 🛡️</span>
                  </div>
                ))}
                {bestDefense.length === 0 && <span className="muted" style={{ fontSize: "0.85rem" }}>No defense stats yet.</span>}
              </div>
            </section>
          </div>

          {data.allSeasons.length > 1 && (
            <section className="panel">
              <div className="section-head">
                <div><span className="eyebrow">HALL OF FAME</span><h2>Past seasons archive</h2></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.allSeasons.filter(s => s.id !== data.season?.id).map(s => (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <strong>{s.name}</strong>
                    <span className="season-status archived" style={{ fontSize: "0.75rem", background: "#e2e8f0", padding: "2px 8px", borderRadius: 4 }}>Archived</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="panel">
          <div className="section-head">
            <div><span className="eyebrow">COMING UP</span><h2>Next fixtures</h2></div>
            <Link to="/fixtures" className="subtle-link">All fixtures <ArrowRight size={15}/></Link>
          </div>
          {upcoming.length ? upcoming.map(f => <MatchRow key={f.id} fixture={f}/>) : <div className="empty-inline">No upcoming fixtures scheduled or season has concluded.</div>}
          
          <div className="section-head latest-head" style={{ marginTop: 24 }}>
            <div><span className="eyebrow">JUST FINISHED</span><h2>Latest results</h2></div>
            <Link to="/fixtures" className="subtle-link">All results <ArrowRight size={15}/></Link>
          </div>
          {latest.length ? latest.map(f => <MatchRow key={f.id} fixture={f}/>) : <div className="empty-inline">Completed results will appear here.</div>}
        </section>
      </div>

      <section className="bottom-cta">
        <div>
          <span className="eyebrow">THE ROAD TO THE CUP</span>
          <h2>One league. One championship cup.</h2>
          <p>Follow every points battle, goal difference, and match day.</p>
        </div>
        <Link className="button button-dark" to="/fixtures">See full schedule <ArrowRight size={16}/></Link>
      </section>
    </>
  );
}

export function StandingsPage() {
  const data = useLeagueData();
  if (data.loading) return <Loading/>;

  return (
    <>
      <PageHeading
        eyebrow="PREMIER DIVISION"
        title="Official Standings"
        description={`League table for ${data.season ? data.season.name : "active season"}. The 1st place crown holder automatically leads the Premier League Cup race.`}
      />
      {!isSupabaseConfigured && <ConfigNotice/>}
      {data.error && <Notice kind="error">{data.error}</Notice>}

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">LEAGUE RACE</span>
            <h2>{data.season?.name ?? "No active season"}</h2>
          </div>
          <span className="rules-note">W 3 pts · D 1 pt · L 0 pts</span>
        </div>
        <StandingsTable standings={data.standings} fixtures={data.fixtures}/>
      </section>
    </>
  );
}

export function FixturesPage() {
  const data = useLeagueData();
  const [selectedMatchday, setSelectedMatchday] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (data.loading) return <Loading/>;

  const matchdays = Array.from(new Set(data.fixtures.map(f => f.matchday))).sort((a, b) => a - b);

  const filteredFixtures = data.fixtures.filter(f => {
    if (selectedMatchday !== "all" && f.matchday !== selectedMatchday) return false;
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const homeName = f.home_team?.name?.toLowerCase() || "";
      const awayName = f.away_team?.name?.toLowerCase() || "";
      if (!homeName.includes(q) && !awayName.includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <PageHeading
        eyebrow="MATCH CENTRE"
        title="Fixtures & results"
        description="The full league schedule, matchday kickoff times, and scores."
      />

      {matchdays.length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16 }}>
          <button
            type="button"
            className={`filter-chip ${selectedMatchday === "all" ? "active" : ""}`}
            onClick={() => setSelectedMatchday("all")}
          >
            All Matchdays ({data.fixtures.length})
          </button>
          {matchdays.map(md => (
            <button
              key={md}
              type="button"
              className={`filter-chip ${selectedMatchday === md ? "active" : ""}`}
              onClick={() => setSelectedMatchday(md)}
            >
              Matchday {md}
            </button>
          ))}
        </div>
      )}

      <div className="filter-row" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Search team..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "8px 12px 8px 36px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.9rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {[
            ["all", "All Statuses"],
            ["scheduled", "Upcoming"],
            ["completed", "Results"],
            ["postponed", "Postponed"],
            ["cancelled", "Cancelled"]
          ].map(([val, lbl]) => (
            <button
              key={val}
              className={`filter-chip ${statusFilter === val ? "active" : ""}`}
              onClick={() => setStatusFilter(val)}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {!isSupabaseConfigured && <ConfigNotice/>}
      {data.error && <Notice kind="error">{data.error}</Notice>}

      <section className="panel">
        {filteredFixtures.length ? (
          filteredFixtures.map(f => <MatchRow key={f.id} fixture={f}/>)
        ) : (
          <div className="empty-state">
            <CalendarDays size={32}/>
            <strong>No matches found</strong>
            <p>No fixtures match your selected matchday or filters.</p>
          </div>
        )}
      </section>
    </>
  );
}

export function TeamsPage() {
  const data = useLeagueData();
  if (data.loading) return <Loading/>;

  return (
    <>
      <PageHeading
        eyebrow="CLUB DIRECTORY"
        title="The teams"
        description="Meet the teams and managers competing this season."
      />
      {!isSupabaseConfigured && <ConfigNotice/>}
      {data.error && <Notice kind="error">{data.error}</Notice>}

      <div className="team-grid">
        {data.teams.map(team => (
          <Link to={`/teams/${team.id}`} className="team-card" key={team.id}>
            <TeamMark team={team} size="lg"/>
            <span className="eyebrow">COMPETING CLUB</span>
            <h2>{team.name}</h2>
            <p>{team.manager_name || "Manager not listed"}</p>
            <div className="team-card-bottom">
              <span>{team.ign || "IGN not listed"}</span>
              <ArrowRight size={17}/>
            </div>
          </Link>
        ))}
      </div>

      {!data.teams.length && (
        <div className="panel empty-state">
          <Users/>
          <strong>No teams registered</strong>
          <p>The team directory will populate once the administrator adds teams.</p>
        </div>
      )}
    </>
  );
}

export function TeamDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState<{
    team: Team | null;
    fixtures: Fixture[];
    standings: Standing[];
    loading: boolean;
    error: string;
  }>({ team: null, fixtures: [], standings: [], loading: true, error: "" });

  useEffect(() => {
    (async () => {
      try {
        const [teams, allFixtures, season] = await Promise.all([getTeams(), getFixtures(), getActiveSeason()]);
        const team = teams.find(t => t.id === id) || null;
        const fixtures = allFixtures.filter(f => f.home_team_id === id || f.away_team_id === id);
        const standings = season ? await getStandings(season.id) : [];
        setState({ team, fixtures, standings, loading: false, error: "" });
      } catch (e) {
        setState(s => ({ ...s, loading: false, error: readableError(e) }));
      }
    })();
  }, [id]);

  if (state.loading) return <Loading/>;
  if (!state.team) {
    return (
      <>
        <PageHeading eyebrow="TEAM PROFILE" title="Team not found"/>
        <Notice kind="error">{state.error || "This team may have been removed or is not publicly available."}</Notice>
        <Link to="/teams" className="button button-dark">Back to teams</Link>
      </>
    );
  }

  const rank = state.standings.find(s => s.team_id === id);

  return (
    <>
      <Link to="/teams" className="back-link">← All teams</Link>
      <section className="team-profile panel">
        <TeamMark team={state.team} size="lg"/>
        <div>
          <span className="eyebrow">TEAM PROFILE</span>
          <h1>{state.team.name}</h1>
          <p>Manager: {state.team.manager_name || "Not listed"} · IGN: {state.team.ign || "Not listed"}</p>
        </div>
        <div className="profile-rank">
          <span>LEAGUE POSITION</span>
          <strong>{rank?.position ? `#${rank.position}` : "—"}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">MATCH CENTRE</span>
            <h2>Fixture history</h2>
          </div>
        </div>
        {state.fixtures.length > 0 ? (
          state.fixtures.map(f => <MatchRow key={f.id} fixture={f}/>)
        ) : (
          <div className="empty-inline">No fixtures recorded for this team.</div>
        )}
      </section>
    </>
  );
}