import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays, ChevronRight, CircleDot, Trophy, Users } from "lucide-react";
import type { Fixture, Season, Standing, Team } from "../types";
import { getActiveSeason, getFixtures, getStandings, getTeams } from "../services/data";
import { isSupabaseConfigured } from "../lib/supabase";
import { readableError } from "../lib/errors";
import TeamMark from "../components/TeamMark";
import StatusPill from "../components/StatusPill";
import Notice from "../components/Notice";
import Loading from "../components/Loading";

function useLeagueData() {
  const [state, setState] = useState<{ loading: boolean; error: string; season: Season | null; teams: Team[]; fixtures: Fixture[]; standings: Standing[] }>({
    loading: true, error: "", season: null, teams: [], fixtures: [], standings: []
  });
  const refresh = async () => {
    if (!isSupabaseConfigured) { setState(s => ({ ...s, loading: false })); return; }
    try {
      const season = await getActiveSeason();
      if (!season) { setState({ loading: false, error: "", season: null, teams: [], fixtures: [], standings: [] }); return; }
      const [teams, fixtures, standings] = await Promise.all([getTeams(season.id), getFixtures(season.id), getStandings(season.id)]);
      setState({ loading: false, error: "", season, teams, fixtures, standings });
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
  return <div className="match-row">
    <div className="match-meta"><span>MD {fixture.matchday}</span><span>{fixture.scheduled_at ? new Date(fixture.scheduled_at).toLocaleDateString() : "Date TBC"}</span></div>
    <div className="match-team home"><TeamMark team={fixture.home_team} /><strong>{fixture.home_team?.name ?? "Unknown team"}</strong></div>
    <div className="match-score">{fixture.status === "completed" ? `${fixture.home_score} – ${fixture.away_score}` : <span>VS</span>}</div>
    <div className="match-team away"><TeamMark team={fixture.away_team} /><strong>{fixture.away_team?.name ?? "Unknown team"}</strong></div>
    <StatusPill status={fixture.status}/>
  </div>;
}
function StandingsTable({ standings, compact = false }: { standings: Standing[]; compact?: boolean }) {
  const data = compact ? standings.slice(0, 5) : standings;
  return <div className="table-wrap"><table className="standings-table">
    <thead><tr><th>#</th><th>Team</th><th>PL</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>PTS</th></tr></thead>
    <tbody>{data.map(row => <tr key={row.team_id}><td className="position">{String(row.position).padStart(2, "0")}</td><td><Link to={`/teams/${row.team_id}`} className="table-team"><TeamMark team={{ name: row.team_name, logo_url: row.logo_url }} size="sm"/><strong>{row.team_name}</strong></Link></td><td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td><td className={row.goal_difference > 0 ? "positive" : row.goal_difference < 0 ? "negative" : ""}>{row.goal_difference > 0 ? "+" : ""}{row.goal_difference}</td><td className="points">{row.points}</td></tr>)}</tbody>
  </table>{data.length === 0 && <div className="empty-state"><Trophy/><strong>No standings yet</strong><p>Add teams and publish completed results to build the table.</p></div>}</div>;
}
export function OverviewPage() {
  const data = useLeagueData();
  const completed = data.fixtures.filter(f => f.status === "completed");
  const upcoming = data.fixtures.filter(f => f.status === "scheduled").slice(0, 3);
  const latest = [...completed].reverse().slice(0, 3);
  if (data.loading) return <Loading />;
  return <>{!isSupabaseConfigured && <ConfigNotice/>}{data.error && <Notice kind="error">{data.error}</Notice>}
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow light"><CircleDot size={12}/> THE COMPETITION DESK</span><h1>Every match.<br/><em>Every moment.</em></h1><p>Fixtures, form and the race for the top — all in one place.</p><div className="hero-actions"><Link className="button button-light" to="/standings">View standings <ArrowRight size={16}/></Link><Link className="hero-text-link" to="/fixtures">Explore fixtures <ChevronRight size={16}/></Link></div></div>
      <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-ball">T</div><span className="hero-number">01</span><span className="hero-vertical">COMPETE WITH PURPOSE</span></div>
      <div className="hero-season"><span>ACTIVE SEASON</span><strong>{data.season?.name ?? "Season not set"}</strong><span className="season-dot">{data.season ? "● Competition active" : "○ Waiting for setup"}</span></div>
    </section>
    <section className="stat-strip">
      <div><span>REGISTERED TEAMS</span><strong>{data.teams.length.toString().padStart(2, "0")}</strong><Users/></div>
      <div><span>MATCHES PLAYED</span><strong>{completed.length.toString().padStart(2, "0")}</strong><CircleDot/></div>
      <div><span>FIXTURES TO COME</span><strong>{data.fixtures.filter(f => f.status === "scheduled").length.toString().padStart(2, "0")}</strong><CalendarDays/></div>
      <div><span>SEASON</span><strong className="season-stat">{data.season?.name ?? "—"}</strong><Trophy/></div>
    </section>
    <div className="content-grid">
      <section className="panel"><div className="section-head"><div><span className="eyebrow">THE TABLE</span><h2>League standings</h2></div><Link to="/standings" className="subtle-link">Full table <ArrowRight size={15}/></Link></div><StandingsTable standings={data.standings} compact/></section>
      <section className="panel"><div className="section-head"><div><span className="eyebrow">COMING UP</span><h2>Next fixtures</h2></div><Link to="/fixtures" className="subtle-link">All fixtures <ArrowRight size={15}/></Link></div>
        {upcoming.length ? upcoming.map(f => <MatchRow key={f.id} fixture={f}/>) : <div className="empty-inline">No upcoming fixtures have been scheduled.</div>}
        <div className="section-head latest-head"><div><span className="eyebrow">JUST FINISHED</span><h2>Latest results</h2></div></div>
        {latest.length ? latest.map(f => <MatchRow key={f.id} fixture={f}/>) : <div className="empty-inline">Completed results will appear here.</div>}
      </section>
    </div>
    <section className="bottom-cta"><div><span className="eyebrow">THE ROAD TO THE TOP</span><h2>One table. One champion.</h2><p>Follow every point as the season unfolds.</p></div><Link className="button button-dark" to="/fixtures">See the schedule <ArrowRight size={16}/></Link></section>
  </>;
}
export function StandingsPage() {
  const data = useLeagueData();
  if (data.loading) return <Loading/>;
  return <><PageHeading eyebrow="THE LEAGUE" title="Standings" description={`The live table${data.season ? ` for ${data.season.name}` : ""}. Results update points, goal difference and positions.`}/>{!isSupabaseConfigured && <ConfigNotice/>}{data.error && <Notice kind="error">{data.error}</Notice>}<section className="panel"><div className="section-head"><div><span className="eyebrow">OFFICIAL TABLE</span><h2>{data.season?.name ?? "No active season"}</h2></div><span className="rules-note">W 3 pts · D 1 pt · L 0 pts</span></div><StandingsTable standings={data.standings}/></section></>;
}
export function FixturesPage() {
  const data = useLeagueData();
  const [filter, setFilter] = useState("all");
  if (data.loading) return <Loading/>;
  const fixtures = data.fixtures.filter(f => filter === "all" || f.status === filter);
  return <><PageHeading eyebrow="MATCH CENTRE" title="Fixtures & results" description="The full match schedule, from kick-off to full time."/><div className="filter-row">{[["all","All matches"],["scheduled","Upcoming"],["completed","Results"],["postponed","Postponed"],["cancelled","Cancelled"]].map(([value,label])=><button key={value} className={`filter-chip ${filter===value?"active":""}`} onClick={()=>setFilter(value)}>{label}</button>)}</div>{!isSupabaseConfigured && <ConfigNotice/>}{data.error && <Notice kind="error">{data.error}</Notice>}<section className="panel">{fixtures.length ? fixtures.map(f=><MatchRow key={f.id} fixture={f}/>) : <div className="empty-state"><CalendarDays/><strong>No matches found</strong><p>Fixtures matching this filter will appear here.</p></div>}</section></>;
}
export function TeamsPage() {
  const data = useLeagueData();
  if (data.loading) return <Loading/>;
  return <><PageHeading eyebrow="CLUB DIRECTORY" title="The teams" description="Meet the teams and managers competing this season."/><>{!isSupabaseConfigured && <ConfigNotice/>}{data.error && <Notice kind="error">{data.error}</Notice>}</><div className="team-grid">{data.teams.map(team=><Link to={`/teams/${team.id}`} className="team-card" key={team.id}><TeamMark team={team} size="lg"/><span className="eyebrow">COMPETING CLUB</span><h2>{team.name}</h2><p>{team.manager_name || "Manager not listed"}</p><div className="team-card-bottom"><span>{team.ign || "IGN not listed"}</span><ArrowRight size={17}/></div></Link>)}</div>{!data.teams.length && <div className="panel empty-state"><Users/><strong>No teams registered</strong><p>The team directory will populate once the administrator adds teams.</p></div>}</>;
}
export function TeamDetailPage() {
  const { id } = useParams();
  const [state, setState] = useState<{team:Team|null;fixtures:Fixture[];standings:Standing[];loading:boolean;error:string}>({team:null,fixtures:[],standings:[],loading:true,error:""});
  useEffect(()=>{(async()=>{try{const [teams,allFixtures,season]=await Promise.all([getTeams(),getFixtures(),getActiveSeason()]);const team=teams.find(t=>t.id===id)||null;const fixtures=allFixtures.filter(f=>f.home_team_id===id||f.away_team_id===id);const standings=season?await getStandings(season.id):[];setState({team,fixtures,standings,loading:false,error:""});}catch(e){setState(s=>({...s,loading:false,error:readableError(e)}));}})();},[id]);
  if(state.loading)return <Loading/>;
  if(!state.team)return <><PageHeading eyebrow="TEAM PROFILE" title="Team not found"/><Notice kind="error">{state.error||"This team may have been removed or is not publicly available."}</Notice><Link to="/teams" className="button button-dark">Back to teams</Link></>;
  const rank=state.standings.find(s=>s.team_id===id);
  return <><Link to="/teams" className="back-link">← All teams</Link><section className="team-profile panel"><TeamMark team={state.team} size="lg"/><div><span className="eyebrow">TEAM PROFILE</span><h1>{state.team.name}</h1><p>Manager: {state.team.manager_name||"Not listed"} · IGN: {state.team.ign||"Not listed"}</p></div><div className="profile-rank"><span>LEAGUE POSITION</span><strong>{rank?.position ? `#${rank.position}` : "—"}</strong></div></section><section className="panel"><div className="section-head"><div><span className="eyebrow">MATCH CENTRE</span><h2>Fixture history</h2></div></div>{state.fixtures.length?state.fixtures.map(f=><MatchRow key={f.id} fixture={f}/>):<div className="empty-inline">No fixtures recorded for this team.</div>}</section></>;
}
