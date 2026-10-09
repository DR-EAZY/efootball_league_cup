import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Plus, Trash2, Pencil, CalendarPlus, Trophy, Users, CalendarDays, CheckCircle2 } from "lucide-react";
import type { Fixture, Season, Team } from "../types";
import { activateSeason, deleteTeam, getActiveSeason, getFixtures, getSeasons, getTeams, saveFixture, saveSeason, saveTeam } from "../services/data";
import { generateRoundRobin } from "../lib/fixtures";
import { readableError } from "../lib/errors";
import { isSupabaseConfigured, requireSupabase } from "../lib/supabase";
import Notice from "../components/Notice";
import Loading from "../components/Loading";
import TeamMark from "../components/TeamMark";
import StatusPill from "../components/StatusPill";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  if (!isSupabaseConfigured) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <span className="eyebrow">LEAGUE OFFICE</span>
          <h1>Admin sign in</h1>
          <Notice kind="error">Supabase is not configured. Add your environment variables before signing in.</Notice>
          <Link to="/" className="back-link">Return to public site</Link>
        </div>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/admin");
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <Link to="/" className="back-link">← Public website</Link>
        <span className="eyebrow">SECURE ACCESS / LEAGUE OFFICE</span>
        <h1>Welcome back.</h1>
        <p>Sign in with your authorized administrator account.</p>
        {error && <Notice kind="error">{error}</Notice>}
        <label>
          Email address
          <input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button className="button button-dark full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in securely"}
        </button>
      </form>
    </div>
  );
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "admin" | "denied">("loading");

  useEffect(() => {
    let alive = true;
    const client = isSupabaseConfigured ? requireSupabase() : null;
    if (!client) {
      setState("denied");
      return;
    }
    client.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      if (!data.session) {
        setState("denied");
        return;
      }
      const { data: profile, error } = await client
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!alive) return;
      setState(!error && profile?.role === "admin" ? "admin" : "denied");
    });
    return () => {
      alive = false;
    };
  }, []);

  if (state === "loading") return <Loading label="Verifying administrator access…" />;
  if (state !== "admin") return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export function AdminOverviewPage() {
  const [state, setState] = useState<{
    teams: Team[];
    fixtures: Fixture[];
    season: Season | null;
    loading: boolean;
    error: string;
  }>({ teams: [], fixtures: [], season: null, loading: true, error: "" });

  useEffect(() => {
    (async () => {
      try {
        const season = await getActiveSeason();
        const [teams, fixtures] = await Promise.all([
          getTeams(season?.id),
          getFixtures(season?.id)
        ]);
        setState({ teams, fixtures, season, loading: false, error: "" });
      } catch (e) {
        setState(s => ({ ...s, loading: false, error: readableError(e) }));
      }
    })();
  }, []);

  if (state.loading) return <Loading />;
  const completed = state.fixtures.filter(f => f.status === "completed").length;

  return (
    <>
      <AdminHeading eyebrow="LEAGUE OFFICE" title="Overview" description="A live operational view of the competition." />
      <>
        {state.error && <Notice kind="error">{state.error}</Notice>}
        {!state.season && (
          <Notice kind="info">
            There is no active season yet. Create a season in Season management, then activate it.
          </Notice>
        )}
      </>
      <div className="admin-stat-grid">
        <AdminStat icon={<Users />} label="Registered teams" value={state.teams.length} />
        <AdminStat icon={<CalendarDays />} label="Total fixtures" value={state.fixtures.length} />
        <AdminStat icon={<CheckCircle2 />} label="Completed matches" value={completed} />
        <AdminStat icon={<CalendarPlus />} label="Need attention" value={state.fixtures.filter(f => f.status === "scheduled").length} />
      </div>
      <div className="admin-action-grid">
        <Link to="/admin/teams" className="admin-action-card">
          <Users />
          <strong>Manage teams</strong>
          <span>Add clubs, update managers and maintain team details.</span>
          <b>Open team management →</b>
        </Link>
        <Link to="/admin/fixtures" className="admin-action-card">
          <CalendarDays />
          <strong>Fixtures & results</strong>
          <span>Build the schedule, set dates and publish scores.</span>
          <b>Open match centre →</b>
        </Link>
        <Link to="/admin/seasons" className="admin-action-card">
          <Trophy />
          <strong>Season management</strong>
          <span>Create a new season or choose the active competition.</span>
          <b>Manage seasons →</b>
        </Link>
      </div>
    </>
  );
}

function AdminHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="admin-page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

function AdminStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="admin-stat">
      <span>{icon}</span>
      <label>{label}</label>
      <strong>{value.toString().padStart(2, "0")}</strong>
    </div>
  );
}

export function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [season, setSeason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Team | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [manager, setManager] = useState("");
  const [ign, setIgn] = useState("");
  const [logo, setLogo] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [ss, ts] = await Promise.all([getSeasons(), getTeams()]);
      setSeasons(ss);
      const active = ss.find(s => s.status === "active");
      const current = season || active?.id || ss[0]?.id || "";
      setSeason(current);
      setTeams(ts.filter(t => !current || t.season_id === current));
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openForm(team?: Team) {
    setEditing(team || null);
    setName(team?.name || "");
    setManager(team?.manager_name || "");
    setIgn(team?.ign || "");
    setLogo(team?.logo_url || "");
    setSeason(team?.season_id || season || "");
    setShowForm(true);
    setMessage("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!season) {
      setError("Create a season before adding teams.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await saveTeam({
        id: editing?.id,
        name,
        manager_name: manager || null,
        ign: ign || null,
        logo_url: logo || null,
        season_id: season
      });
      setMessage(editing ? "Team updated successfully." : "Team created successfully.");
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(team: Team) {
    if (!confirm(`Delete ${team.name}? This cannot be undone. Teams with fixtures cannot be deleted.`)) return;
    setError("");
    setMessage("");
    try {
      await deleteTeam(team.id);
      setMessage("Team deleted.");
      await refresh();
    } catch (e) {
      setError(readableError(e));
    }
  }

  async function refreshForSeason(id: string) {
    setLoading(true);
    try {
      setTeams(await getTeams(id));
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AdminHeading eyebrow="COMPETITION SETUP" title="Team management" description="Keep club identities and manager information up to date." />
      <div className="admin-toolbar">
        <label className="compact-label">
          Season
          <select value={season} onChange={e => { setSeason(e.target.value); void refreshForSeason(e.target.value); }}>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <button className="button button-dark" onClick={() => openForm()}><Plus size={16} /> Add team</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}
      {showForm && (
        <form className="panel admin-form" onSubmit={submit}>
          <div className="section-head">
            <div>
              <span className="eyebrow">{editing ? "EDIT CLUB" : "NEW CLUB"}</span>
              <h2>{editing ? "Update team" : "Add a team"}</h2>
            </div>
            <button type="button" className="text-button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div className="form-grid">
            <label>Team name *<input required maxLength={70} value={name} onChange={e => setName(e.target.value)} /></label>
            <label>Manager / captain<input maxLength={100} value={manager} onChange={e => setManager(e.target.value)} /></label>
            <label>In-game username (IGN)<input maxLength={70} value={ign} onChange={e => setIgn(e.target.value)} /></label>
            <label>Logo image URL<input type="url" placeholder="https://…" value={logo} onChange={e => setLogo(e.target.value)} /></label>
          </div>
          <button className="button button-dark" disabled={busy}>{busy ? "Saving…" : "Save team"}</button>
        </form>
      )}
      {loading ? (
        <Loading />
      ) : teams.length ? (
        <div className="panel admin-list">
          {teams.map(t => (
            <div className="admin-team-row" key={t.id}>
              <TeamMark team={t} />
              <div className="grow">
                <strong>{t.name}</strong>
                <span>{t.manager_name || "No manager"} · {t.ign || "No IGN"}</span>
              </div>
              <button className="icon-button" aria-label={`Edit ${t.name}`} onClick={() => openForm(t)}><Pencil size={17} /></button>
              <button className="icon-button danger" aria-label={`Delete ${t.name}`} onClick={() => void remove(t)}><Trash2 size={17} /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel empty-state">
          <Users />
          <strong>No teams in this season</strong>
          <p>Add the competing teams to get started.</p>
        </div>
      )}
    </>
  );
}

export function AdminFixturesPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [season, setSeason] = useState("");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Fixture | null>(null);
  const [preview, setPreview] = useState<{ matchday: number; home_team_id: string; away_team_id: string }[] | null>(null);
  const [double, setDouble] = useState(false);

  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [matchday, setMatchday] = useState("1");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<Fixture["status"]>("scheduled");
  const [homeScore, setHomeScore] = useState("0");
  const [awayScore, setAwayScore] = useState("0");
  const [notes, setNotes] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const ss = await getSeasons();
      setSeasons(ss);
      const active = ss.find(s => s.status === "active");
      const sid = season || active?.id || ss[0]?.id || "";
      setSeason(sid);
      const [tt, ff] = await Promise.all([getTeams(sid), getFixtures(sid)]);
      setTeams(tt);
      setFixtures(ff);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openForm(f?: Fixture) {
    setEditing(f || null);
    setHome(f?.home_team_id || teams[0]?.id || "");
    setAway(f?.away_team_id || teams.find(t => t.id !== teams[0]?.id)?.id || "");
    setMatchday(String(f?.matchday || 1));
    setDate(f?.scheduled_at ? f.scheduled_at.slice(0, 16) : "");
    setStatus(f?.status || "scheduled");
    setHomeScore(String(f?.home_score ?? 0));
    setAwayScore(String(f?.away_score ?? 0));
    setNotes(f?.notes || "");
    setShowForm(true);
    setMessage("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (home === away) {
      setError("A team cannot play against itself.");
      return;
    }
    if (status === "completed" && (!Number.isInteger(Number(homeScore)) || !Number.isInteger(Number(awayScore)) || Number(homeScore) < 0 || Number(awayScore) < 0)) {
      setError("Scores must be non-negative whole numbers.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await saveFixture({
        id: editing?.id,
        season_id: season,
        matchday: Number(matchday),
        home_team_id: home,
        away_team_id: away,
        scheduled_at: date ? new Date(date).toISOString() : null,
        status,
        home_score: status === "completed" ? Number(homeScore) : null,
        away_score: status === "completed" ? Number(awayScore) : null,
        notes
      });
      setMessage(editing ? "Fixture updated." : "Fixture created.");
      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (teams.length < 2) {
      setError("Add at least two teams before generating a schedule.");
      return;
    }
    const proposed = generateRoundRobin(teams, double);
    setPreview(proposed);
  }

  async function saveGenerated() {
    if (!preview) return;
    if (!confirm(`Save ${preview.length} generated fixtures for ${seasons.find(s => s.id === season)?.name || "this season"}? Existing fixtures will be preserved; this may create duplicates if a schedule already exists.`)) return;
    setBusy(true);
    setError("");
    try {
      for (const f of preview) {
        await saveFixture({ season_id: season, ...f, status: "scheduled" });
      }
      setMessage(`${preview.length} fixtures generated and saved.`);
      setPreview(null);
      await refresh();
    } catch (e) {
      setError(`Schedule save stopped: ${readableError(e)}. Some fixtures may already have been saved; review the schedule before retrying.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminHeading eyebrow="MATCH CENTRE" title="Fixtures & results" description="Create the schedule, update match status and publish accurate scores." />
      <div className="admin-toolbar">
        <label className="compact-label">
          Season
          <select value={season} onChange={async e => {
            const id = e.target.value;
            setSeason(id);
            setLoading(true);
            try {
              const [tt, ff] = await Promise.all([getTeams(id), getFixtures(id)]);
              setTeams(tt);
              setFixtures(ff);
            } catch (err) {
              setError(readableError(err));
            } finally {
              setLoading(false);
            }
          }}>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="toolbar-actions">
          <button className="button button-outline" onClick={() => void generate()}>Generate schedule</button>
          <button className="button button-dark" onClick={() => openForm()}><Plus size={16} /> Add fixture</button>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}

      {preview && (
        <div className="panel preview-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">SCHEDULE PREVIEW</span>
              <h2>{preview.length} fixtures proposed</h2>
            </div>
            <button className="text-button" onClick={() => setPreview(null)}>Discard</button>
          </div>
          <label className="check-label">
            <input type="checkbox" checked={double} onChange={e => { setDouble(e.target.checked); setPreview(generateRoundRobin(teams, e.target.checked)); }} /> Double round-robin (home and away)
          </label>
          <div className="preview-list">
            {preview.slice(0, 8).map(f => (
              <div key={`${f.matchday}-${f.home_team_id}-${f.away_team_id}`}>
                <span>MD {f.matchday}</span>
                <strong>{teams.find(t => t.id === f.home_team_id)?.name} vs {teams.find(t => t.id === f.away_team_id)?.name}</strong>
              </div>
            ))}
          </div>
          {preview.length > 8 && <p className="muted">And {preview.length - 8} more fixtures…</p>}
          <button className="button button-dark" disabled={busy} onClick={() => void saveGenerated()}>{busy ? "Saving schedule…" : "Confirm and save schedule"}</button>
        </div>
      )}

      {showForm && (
        <form className="panel admin-form" onSubmit={submit}>
          <div className="section-head">
            <div>
              <span className="eyebrow">{editing ? "EDIT MATCH" : "NEW MATCH"}</span>
              <h2>{editing ? "Edit fixture / result" : "Create fixture"}</h2>
            </div>
            <button type="button" className="text-button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div className="form-grid">
            <label>Home team<select required value={home} onChange={e => setHome(e.target.value)}>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label>Away team<select required value={away} onChange={e => setAway(e.target.value)}>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label>Matchday<input type="number" min="1" required value={matchday} onChange={e => setMatchday(e.target.value)} /></label>
            <label>Date and time<input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label>Match status<select value={status} onChange={e => setStatus(e.target.value as Fixture["status"])}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="postponed">Postponed</option><option value="cancelled">Cancelled</option></select></label>
            {status === "completed" && (
              <>
                <label>Home score<input type="number" min="0" step="1" required value={homeScore} onChange={e => setHomeScore(e.target.value)} /></label>
                <label>Away score<input type="number" min="0" step="1" required value={awayScore} onChange={e => setAwayScore(e.target.value)} /></label>
              </>
            )}
            <label className="span-two">Match notes<textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label>
          </div>
          <button className="button button-dark" disabled={busy}>{busy ? "Saving…" : "Save fixture"}</button>
        </form>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="panel admin-list">
          {fixtures.length ? (
            fixtures.map(f => (
              <div className="fixture-admin-row" key={f.id}>
                <div className="fixture-admin-meta">
                  <span>MD {f.matchday}</span>
                  <StatusPill status={f.status} />
                </div>
                <div className="fixture-admin-teams">
                  <span>{f.home_team?.name || "Unknown"}</span>
                  <strong>{f.status === "completed" ? `${f.home_score} – ${f.away_score}` : "vs"}</strong>
                  <span>{f.away_team?.name || "Unknown"}</span>
                </div>
                <button className="icon-button" aria-label="Edit fixture" onClick={() => openForm(f)}><Pencil size={17} /></button>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <CalendarDays />
              <strong>No fixtures yet</strong>
              <p>Create one manually or generate a round-robin schedule.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function AdminSeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      setSeasons(await getSeasons());
      setError("");
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await saveSeason(name);
      setName("");
      setMessage("Season created.");
      await refresh();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  async function activate(s: Season) {
    if (s.status === "active") return;
    if (!confirm(`Set "${s.name}" as the active season? The previous active season will become upcoming unless archived separately.`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await activateSeason(s.id);
      setMessage(`${s.name} is now active.`);
      await refresh();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminHeading eyebrow="COMPETITION SETUP" title="Season management" description="Keep current competition data separate from past and future seasons." />
      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}
      <form className="panel season-create" onSubmit={create}>
        <div>
          <span className="eyebrow">NEW COMPETITION</span>
          <h2>Create a season</h2>
          <p>Example: eFootball League 2026/27. New seasons start as upcoming and do not erase previous records.</p>
        </div>
        <div className="inline-form">
          <input required maxLength={80} placeholder="Season name" value={name} onChange={e => setName(e.target.value)} />
          <button className="button button-dark" disabled={busy}><Plus size={16} /> Create season</button>
        </div>
      </form>
      <div className="section-head season-list-head">
        <div>
          <span className="eyebrow">SEASON ARCHIVE</span>
          <h2>All seasons</h2>
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : (
        <div className="season-list">
          {seasons.map(s => (
            <div className="panel season-row" key={s.id}>
              <div className="season-icon"><Trophy /></div>
              <div className="grow">
                <strong>{s.name}</strong>
                <span>Created {new Date(s.created_at).toLocaleDateString()}</span>
              </div>
              <span className={`season-status ${s.status}`}>{s.status}</span>
              {s.status !== "active" && (
                <button className="button button-outline" disabled={busy} onClick={() => void activate(s)}>Make active</button>
              )}
            </div>
          ))}
        </div>
      )}
      {!seasons.length && !loading && (
        <div className="panel empty-state">
          <Trophy />
          <strong>No seasons yet</strong>
          <p>Create your first season above.</p>
        </div>
      )}
    </>
  );
}