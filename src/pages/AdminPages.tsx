import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  Pencil,
  CalendarPlus,
  Trophy,
  Users,
  CalendarDays,
  CheckCircle2,
  Search,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import type { Fixture, Season, Team } from "../types";
import {
  activateSeason,
  deleteAllFixtures,
  deleteTeam,
  getActiveSeason,
  getFixtures,
  getSeasons,
  getTeams,
  saveFixture,
  saveFixturesBulk,
  saveSeason,
  saveTeam,
} from "../services/data";
import { generateRoundRobin } from "../lib/fixtures";
import { readableError } from "../lib/errors";
import { isSupabaseConfigured, requireSupabase } from "../lib/supabase";
import Notice from "../components/Notice";
import Loading from "../components/Loading";
import TeamMark from "../components/TeamMark";
import StatusPill from "../components/StatusPill";
import "../styles/admin-fixtures.css";

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
          <Notice kind="error">
            Supabase is not configured. Add your environment variables before
            signing in.
          </Notice>
          <Link to="/" className="back-link">
            Return to public site
          </Link>
        </div>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const { error } = await requireSupabase().auth.signInWithPassword({
        email,
        password,
      });

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
        <Link to="/" className="back-link">
          ← Public website
        </Link>

        <span className="eyebrow">SECURE ACCESS / LEAGUE OFFICE</span>
        <h1>Welcome back.</h1>
        <p>Sign in with your authorized administrator account.</p>

        {error && <Notice kind="error">{error}</Notice>}

        <label>
          Email address
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button className="button button-dark full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in securely"}
        </button>
      </form>
    </div>
  );
}

export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "admin" | "denied">(
    "loading"
  );

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

  if (state === "loading") {
    return <Loading label="Verifying administrator access…" />;
  }

  if (state !== "admin") {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

export function AdminOverviewPage() {
  const [state, setState] = useState<{
    teams: Team[];
    fixtures: Fixture[];
    season: Season | null;
    loading: boolean;
    error: string;
  }>({
    teams: [],
    fixtures: [],
    season: null,
    loading: true,
    error: "",
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const season = await getActiveSeason();

        const [teams, fixtures] = await Promise.all([
          getTeams(season?.id),
          getFixtures(season?.id),
        ]);

        if (alive) {
          setState({
            teams,
            fixtures,
            season,
            loading: false,
            error: "",
          });
        }
      } catch (e) {
        if (alive) {
          setState((s) => ({
            ...s,
            loading: false,
            error: readableError(e),
          }));
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) return <Loading />;

  const completed = state.fixtures.filter(
    (f) => f.status === "completed"
  ).length;

  return (
    <>
      <AdminHeading
        eyebrow="LEAGUE OFFICE"
        title="Overview"
        description="A live operational view of the competition."
      />

      {state.error && <Notice kind="error">{state.error}</Notice>}

      {!state.season && (
        <Notice kind="info">
          There is no active season yet. Create a season in Season management,
          then activate it.
        </Notice>
      )}

      <div className="admin-stat-grid">
        <AdminStat
          icon={<Users />}
          label="Registered teams"
          value={state.teams.length}
        />
        <AdminStat
          icon={<CalendarDays />}
          label="Total fixtures"
          value={state.fixtures.length}
        />
        <AdminStat
          icon={<CheckCircle2 />}
          label="Completed matches"
          value={completed}
        />
        <AdminStat
          icon={<CalendarPlus />}
          label="Need attention"
          value={
            state.fixtures.filter((f) => f.status === "scheduled").length
          }
        />
      </div>

      <div className="admin-action-grid">
        <Link to="/admin/teams" className="admin-action-card">
          <Users />
          <strong>Manage teams</strong>
          <span>
            Add clubs, update managers and maintain team details.
          </span>
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
          <span>
            Create a new season or choose the active competition.
          </span>
          <b>Manage seasons →</b>
        </Link>
      </div>
    </>
  );
}

function AdminHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
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

function AdminStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(logo);
      return;
    }

    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [logoFile, logo]);

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      const [ss, ts] = await Promise.all([getSeasons(), getTeams()]);

      setSeasons(ss);

      const active = ss.find((s) => s.status === "active");
      const current = season || active?.id || ss[0]?.id || "";

      setSeason(current);
      setTeams(ts.filter((t) => !current || t.season_id === current));
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
    setLogoFile(null);
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
      let logoUrl: string | null = logo.trim() || null;

      if (logoFile) {
        const supabase = requireSupabase();
        const bucket = "team-logos";

        const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const filePath = `${season}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, logoFile, {
            contentType: logoFile.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        logoUrl = data.publicUrl;
      }

      await saveTeam({
        id: editing?.id,
        name,
        manager_name: manager || null,
        ign: ign || null,
        logo_url: logoUrl,
        season_id: season,
      });

      setLogo(logoUrl || "");
      setLogoFile(null);

      setMessage(
        editing ? "Team updated successfully." : "Team created successfully."
      );

      setShowForm(false);
      await refresh();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(team: Team) {
    if (
      !confirm(
        `Delete ${team.name}? This cannot be undone. Teams with fixtures cannot be deleted.`
      )
    ) {
      return;
    }

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
    setError("");

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
      <AdminHeading
        eyebrow="COMPETITION SETUP"
        title="Team management"
        description="Keep club identities and manager information up to date."
      />

      <div className="admin-toolbar">
        <label className="compact-label">
          Season
          <select
            value={season}
            onChange={(e) => {
              setSeason(e.target.value);
              void refreshForSeason(e.target.value);
            }}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <button className="button button-dark" onClick={() => openForm()}>
          <Plus size={16} /> Add team
        </button>
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}

      {showForm && (
        <form className="panel admin-form" onSubmit={submit}>
          <div className="section-head">
            <div>
              <span className="eyebrow">
                {editing ? "EDIT CLUB" : "NEW CLUB"}
              </span>
              <h2>{editing ? "Update team" : "Add a team"}</h2>
            </div>

            <button
              type="button"
              className="text-button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>

          <div className="form-grid">
            <label>
              Team name *
              <input
                required
                maxLength={70}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label>
              Manager / captain
              <input
                maxLength={100}
                value={manager}
                onChange={(e) => setManager(e.target.value)}
              />
            </label>

            <label>
              In-game username (IGN)
              <input
                maxLength={70}
                value={ign}
                onChange={(e) => setIgn(e.target.value)}
              />
            </label>

            <label className="span-two">
              Team logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;

                  if (!file) {
                    setLogoFile(null);
                    return;
                  }

                  if (file.size > 5 * 1024 * 1024) {
                    setError("Logo must be 5 MB or smaller.");
                    e.target.value = "";
                    return;
                  }

                  setError("");
                  setLogoFile(file);
                }}
              />

              <span className="muted">
                Choose a PNG, JPG, WebP or GIF image. Maximum size: 5 MB.
              </span>

              {logoPreview && (
                <div style={{ marginTop: 12 }}>
                  <img
                    src={logoPreview}
                    alt="Team logo preview"
                    style={{
                      width: 96,
                      height: 96,
                      objectFit: "contain",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      padding: 8,
                    }}
                  />
                </div>
              )}

              <span>Or paste an existing logo URL</span>

              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
              />
            </label>
          </div>

          <button className="button button-dark" disabled={busy}>
            {busy ? "Saving…" : "Save team"}
          </button>
        </form>
      )}

      {loading ? (
        <Loading />
      ) : teams.length ? (
        <div className="panel admin-list">
          {teams.map((t) => (
            <div className="admin-team-row" key={t.id}>
              <TeamMark team={t} />

              <div className="grow">
                <strong>{t.name}</strong>
                <span>
                  {t.manager_name || "No manager"} · {t.ign || "No IGN"}
                </span>
              </div>

              <button
                className="icon-button"
                aria-label={`Edit ${t.name}`}
                onClick={() => openForm(t)}
              >
                <Pencil size={17} />
              </button>

              <button
                className="icon-button danger"
                aria-label={`Delete ${t.name}`}
                onClick={() => void remove(t)}
              >
                <Trash2 size={17} />
              </button>
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

  // Match Centre specific UI states
  const [selectedMatchday, setSelectedMatchday] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal controls
  const [showFixtureModal, setShowFixtureModal] = useState(false);
  const [editing, setEditing] = useState<Fixture | null>(null);

  // Round-robin generator state & preview
  const [preview, setPreview] = useState<
    {
      matchday: number;
      home_team_id: string;
      away_team_id: string;
    }[] | null
  >(null);
  const [double, setDouble] = useState(false);
  const [showGeneratorPreview, setShowGeneratorPreview] = useState(false);

  // Fixture edit fields
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [matchday, setMatchday] = useState("1");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<Fixture["status"]>("scheduled");
  const [notes, setNotes] = useState("");

  // Inline scores state map: fixtureId -> { home: string, away: string }
  const [inlineScores, setInlineScores] = useState<
    Record<string, { home: string; away: string }>
  >({});
  const [savingFixtureId, setSavingFixtureId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      const ss = await getSeasons();
      setSeasons(ss);

      const active = ss.find((s) => s.status === "active");
      const sid = season || active?.id || ss[0]?.id || "";

      setSeason(sid);

      const [tt, ff] = await Promise.all([
        getTeams(sid),
        getFixtures(sid),
      ]);

      setTeams(tt);
      setFixtures(ff);

      // Initialize inline score inputs from loaded fixtures
      const initialScores: Record<string, { home: string; away: string }> = {};
      ff.forEach((f) => {
        initialScores[f.id] = {
          home: f.home_score !== null && f.home_score !== undefined ? String(f.home_score) : "",
          away: f.away_score !== null && f.away_score !== undefined ? String(f.away_score) : "",
        };
      });
      setInlineScores(initialScores);

      // Auto-select matchday if available
      const matchdays = Array.from(new Set(ff.map((f) => f.matchday))).sort((a, b) => a - b);
      if (matchdays.length > 0 && selectedMatchday !== "all" && !matchdays.includes(selectedMatchday as number)) {
        setSelectedMatchday(matchdays[0]);
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openEditFixtureModal(f?: Fixture) {
    setEditing(f || null);
    setHome(f?.home_team_id || teams[0]?.id || "");
    setAway(
      f?.away_team_id ||
        teams.find((t) => t.id !== teams[0]?.id)?.id ||
        ""
    );
    setMatchday(String(f?.matchday || 1));
    setDate(f?.scheduled_at ? f.scheduled_at.slice(0, 16) : "");
    setStatus(f?.status || "scheduled");
    setNotes(f?.notes || "");
    setShowFixtureModal(true);
    setMessage("");
  }

  async function submitFixtureEdit(e: FormEvent) {
    e.preventDefault();

    if (!season) {
      setError("Select a season first.");
      return;
    }

    if (!home || !away || home === away) {
      setError("Choose two different teams for the fixture.");
      return;
    }

    const parsedMatchday = Number(matchday);

    if (!Number.isInteger(parsedMatchday) || parsedMatchday < 1) {
      setError("Matchday must be a positive whole number.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await saveFixture({
        id: editing?.id,
        season_id: season,
        matchday: parsedMatchday,
        home_team_id: home,
        away_team_id: away,
        scheduled_at: date ? new Date(date).toISOString() : null,
        status,
        home_score: editing?.home_score ?? null,
        away_score: editing?.away_score ?? null,
        notes,
      });

      setMessage(editing ? "Fixture details updated successfully." : "Fixture created successfully.");
      setShowFixtureModal(false);
      await refresh();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveInlineResult(f: Fixture) {
    const scores = inlineScores[f.id];
    if (!scores) return;

    const hs = Number(scores.home);
    const as = Number(scores.away);

    if (
      scores.home.trim() === "" ||
      scores.away.trim() === "" ||
      !Number.isInteger(hs) ||
      !Number.isInteger(as) ||
      hs < 0 ||
      as < 0
    ) {
      setError(`Scores for matchday ${f.matchday} must be non-negative whole numbers.`);
      return;
    }

    setSavingFixtureId(f.id);
    setError("");
    setMessage("");

    try {
      await saveFixture({
        ...f,
        status: "completed",
        home_score: hs,
        away_score: as,
      });

      setMessage(`Match result saved for Matchday ${f.matchday}.`);
      await refresh();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setSavingFixtureId(null);
    }
  }

  function generate() {
    setError("");
    setMessage("");

    if (!season) {
      setError("Create or select a season before generating fixtures.");
      return;
    }

    if (teams.length < 2) {
      setError("Add at least two teams before generating a schedule.");
      return;
    }

    if (fixtures.length > 0) {
      setError(
        "This season already has fixtures. Delete the existing schedule before generating a new one."
      );
      return;
    }

    const proposed = generateRoundRobin(teams, double);

    if (proposed.length === 0) {
      setError("No fixtures could be generated.");
      return;
    }

    setPreview(proposed);
    setShowGeneratorPreview(true);
  }

  async function saveGenerated() {
    if (!preview || preview.length === 0) return;

    if (fixtures.length > 0) {
      setError(
        "Existing fixtures found. Delete the current schedule before saving a new schedule."
      );
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await saveFixturesBulk(season, preview);

      setMessage(`${preview.length} fixtures generated and saved in bulk.`);
      setPreview(null);
      setShowGeneratorPreview(false);

      await refresh();
    } catch (e) {
      setError(`Bulk save failed: ${readableError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAllFixtures() {
    if (!season || fixtures.length === 0 || busy) return;

    const seasonName = seasons.find((s) => s.id === season)?.name || "this season";

    if (
      !confirm(
        `Are you sure you want to delete ALL ${fixtures.length} fixtures and recorded results for "${seasonName}"?\n\nThis will remove all scheduled games and scorelines for this season. Registered teams and the season record will NOT be deleted.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const deletedCount = await deleteAllFixtures(season);

      setMessage(`Successfully deleted ${deletedCount} fixtures for ${seasonName}.`);

      setPreview(null);
      setSelectedMatchday("all");
      await refresh();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  // Filter and matchday computations
  const availableMatchdays = Array.from(new Set(fixtures.map((f) => f.matchday))).sort(
    (a, b) => a - b
  );

  const filteredFixtures = fixtures.filter((f) => {
    // Matchday filter
    if (selectedMatchday !== "all" && f.matchday !== selectedMatchday) {
      return false;
    }
    // Status filter
    if (statusFilter !== "all" && f.status !== statusFilter) {
      return false;
    }
    // Search query (home or away team name)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const homeName = f.home_team?.name?.toLowerCase() || "";
      const awayName = f.away_team?.name?.toLowerCase() || "";
      if (!homeName.includes(q) && !awayName.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const completedCount = fixtures.filter((f) => f.status === "completed").length;
  const scheduledCount = fixtures.filter((f) => f.status === "scheduled").length;
  const remainingCount = fixtures.length - completedCount;

  return (
    <div className="match-centre">
      {/* Header */}
      <div className="match-centre-header">
        <div>
          <span className="eyebrow">MATCH CENTRE</span>
          <h1>Fixtures & Results</h1>
          <p>Manage match schedules, publish scores, and oversee matchdays.</p>
        </div>

        <div className="toolbar-actions-flex">
          <button
            type="button"
            className="button button-outline"
            onClick={generate}
            disabled={busy || loading}
          >
            <CalendarPlus size={16} /> Generate schedule
          </button>

          <button
            type="button"
            className="button button-dark"
            onClick={() => openEditFixtureModal()}
            disabled={busy || loading || teams.length < 2}
          >
            <Plus size={16} /> Add fixture
          </button>

          {fixtures.length > 0 && (
            <button
              type="button"
              className="button button-danger"
              onClick={() => void handleClearAllFixtures()}
              disabled={busy || loading}
            >
              <Trash2 size={16} /> Delete all fixtures
            </button>
          )}
        </div>
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}

      {/* Season Selector Toolbar */}
      <div className="match-centre-toolbar">
        <div className="toolbar-group">
          <label className="compact-label" style={{ marginBottom: 0 }}>
            Active season:
            <select
              value={season}
              onChange={async (e) => {
                const id = e.target.value;
                setSeason(id);
                setPreview(null);
                setSelectedMatchday("all");
                setError("");
                setMessage("");
                setLoading(true);

                try {
                  const [tt, ff] = await Promise.all([
                    getTeams(id),
                    getFixtures(id),
                  ]);

                  setTeams(tt);
                  setFixtures(ff);

                  const initialScores: Record<string, { home: string; away: string }> = {};
                  ff.forEach((f) => {
                    initialScores[f.id] = {
                      home: f.home_score !== null && f.home_score !== undefined ? String(f.home_score) : "",
                      away: f.away_score !== null && f.away_score !== undefined ? String(f.away_score) : "",
                    };
                  });
                  setInlineScores(initialScores);
                } catch (err) {
                  setError(readableError(err));
                } finally {
                  setLoading(false);
                }
              }}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="muted" style={{ fontSize: "0.875rem" }}>
          Total Teams: <strong>{teams.length}</strong>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="match-centre-stats">
        <div className="match-stat-card">
          <span>Total fixtures</span>
          <strong>{fixtures.length}</strong>
        </div>
        <div className="match-stat-card">
          <span>Completed matches</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="match-stat-card">
          <span>Scheduled matches</span>
          <strong>{scheduledCount}</strong>
        </div>
        <div className="match-stat-card">
          <span>Remaining matches</span>
          <strong>{remainingCount}</strong>
        </div>
      </div>

      {/* Matchday Navigation Bar */}
      {availableMatchdays.length > 0 && (
        <div className="matchday-nav-bar">
          <button
            type="button"
            className={`matchday-pill ${selectedMatchday === "all" ? "active" : ""}`}
            onClick={() => setSelectedMatchday("all")}
          >
            All Matchdays
            <span className="count-badge">{fixtures.length}</span>
          </button>

          {availableMatchdays.map((md) => {
            const count = fixtures.filter((f) => f.matchday === md).length;
            return (
              <button
                key={md}
                type="button"
                className={`matchday-pill ${selectedMatchday === md ? "active" : ""}`}
                onClick={() => setSelectedMatchday(md)}
              >
                Matchday {md}
                <span className="count-badge">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search and Status Filter */}
      <div className="fixtures-filter-bar">
        <div className="fixtures-search-input">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search team name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <label className="compact-label" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
          Status:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      {/* Generator Preview Modal / Panel */}
      {showGeneratorPreview && preview && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog" style={{ maxWidth: 700 }}>
            <div className="section-head">
              <div>
                <span className="eyebrow">SCHEDULE PREVIEW</span>
                <h2>{preview.length} fixtures proposed</h2>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setPreview(null);
                  setShowGeneratorPreview(false);
                }}
                disabled={busy}
              >
                Cancel
              </button>
            </div>

            <label className="check-label" style={{ margin: "16px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={double}
                disabled={busy}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDouble(checked);
                  setPreview(generateRoundRobin(teams, checked));
                }}
              />
              Double round-robin (home and away)
            </label>

            <div className="preview-list" style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", marginBottom: "16px", background: "#f8fafc" }}>
              {preview.map((f, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e2e8f0", fontSize: "0.875rem" }}>
                  <span className="muted">MD {f.matchday}</span>
                  <strong>
                    {teams.find((t) => t.id === f.home_team_id)?.name} vs{" "}
                    {teams.find((t) => t.id === f.away_team_id)?.name}
                  </strong>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setPreview(null);
                  setShowGeneratorPreview(false);
                }}
                disabled={busy}
              >
                Discard
              </button>
              <button
                type="button"
                className="button button-dark"
                disabled={busy || loading}
                onClick={() => void saveGenerated()}
              >
                {busy ? "Saving schedule…" : "Confirm and save schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Fixture Details */}
      {showFixtureModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog">
            <form onSubmit={submitFixtureEdit}>
              <div className="section-head">
                <div>
                  <span className="eyebrow">
                    {editing ? "EDIT DETAILS" : "NEW FIXTURE"}
                  </span>
                  <h2>{editing ? "Edit fixture details" : "Create fixture"}</h2>
                </div>

                <button
                  type="button"
                  className="text-button"
                  onClick={() => setShowFixtureModal(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>

              <div className="form-grid" style={{ marginTop: 16 }}>
                <label>
                  Home team
                  <select
                    required
                    value={home}
                    onChange={(e) => setHome(e.target.value)}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Away team
                  <select
                    required
                    value={away}
                    onChange={(e) => setAway(e.target.value)}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Matchday
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={matchday}
                    onChange={(e) => setMatchday(e.target.value)}
                  />
                </label>

                <label>
                  Date and time
                  <input
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>

                <label className="span-two">
                  Match status
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as Fixture["status"])
                    }
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="postponed">Postponed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>

                <label className="span-two">
                  Match notes
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setShowFixtureModal(false)}
                >
                  Cancel
                </button>
                <button className="button button-dark" disabled={busy}>
                  {busy ? "Saving…" : "Save fixture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Fixtures List with Inline Score Entry */}
      {loading ? (
        <Loading />
      ) : filteredFixtures.length > 0 ? (
        <div className="fixtures-grid">
          {filteredFixtures.map((f) => {
            const currentScores = inlineScores[f.id] || { home: "", away: "" };
            const isSaving = savingFixtureId === f.id;

            return (
              <div className="fixture-match-card" key={f.id}>
                {/* Meta / Matchday & Status */}
                <div className="fixture-card-meta">
                  <span className="md-tag">MD {f.matchday}</span>
                  <StatusPill status={f.status} />
                  {f.scheduled_at && (
                    <span className="muted" style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={12} /> {new Date(f.scheduled_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>

                {/* Teams & Inline Score Inputs */}
                <div className="fixture-card-teams">
                  <div className="team-side home">
                    <span>{f.home_team?.name || "Unknown Team"}</span>
                    <TeamMark team={f.home_team} />
                  </div>

                  {/* Inline Score Entry Box */}
                  <div className="inline-score-form">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="inline-score-input"
                      value={currentScores.home}
                      onChange={(e) =>
                        setInlineScores((prev) => ({
                          ...prev,
                          [f.id]: { ...currentScores, home: e.target.value },
                        }))
                      }
                      placeholder="–"
                    />
                    <span className="score-divider">:</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="inline-score-input"
                      value={currentScores.away}
                      onChange={(e) =>
                        setInlineScores((prev) => ({
                          ...prev,
                          [f.id]: { ...currentScores, away: e.target.value },
                        }))
                      }
                      placeholder="–"
                    />

                    <button
                      type="button"
                      className="button button-dark button-small"
                      disabled={isSaving}
                      onClick={() => void saveInlineResult(f)}
                      title="Save Result"
                      style={{ marginLeft: 6, padding: "6px 12px" }}
                    >
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                  </div>

                  <div className="team-side away">
                    <TeamMark team={f.away_team} />
                    <span>{f.away_team?.name || "Unknown Team"}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="fixture-card-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit fixture details for matchday ${f.matchday}`}
                    onClick={() => openEditFixtureModal(f)}
                    disabled={busy}
                    title="Edit fixture details & notes"
                  >
                    <Pencil size={17} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel empty-state">
          <CalendarDays size={32} />
          <strong>No fixtures found</strong>
          <p>
            {fixtures.length === 0
              ? "Create fixtures manually or generate a round-robin schedule to get started."
              : "No fixtures match your current search or status filter."}
          </p>
        </div>
      )}
    </div>
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

    if (
      !confirm(
        `Set "${s.name}" as the active season? The previous active season will become upcoming unless archived separately.`
      )
    ) {
      return;
    }

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
      <AdminHeading
        eyebrow="COMPETITION SETUP"
        title="Season management"
        description="Keep current competition data separate from past and future seasons."
      />

      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}

      <form className="panel season-create" onSubmit={create}>
        <div>
          <span className="eyebrow">NEW COMPETITION</span>
          <h2>Create a season</h2>
          <p>
            Example: eFootball League 2026/27. New seasons start as upcoming
            and do not erase previous records.
          </p>
        </div>

        <div className="inline-form">
          <input
            required
            maxLength={80}
            placeholder="Season name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <button className="button button-dark" disabled={busy}>
            <Plus size={16} /> Create season
          </button>
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
          {seasons.map((s) => (
            <div className="panel season-row" key={s.id}>
              <div className="season-icon">
                <Trophy />
              </div>

              <div className="grow">
                <strong>{s.name}</strong>
                <span>
                  Created {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>

              <span className={`season-status ${s.status}`}>{s.status}</span>

              {s.status !== "active" && (
                <button
                  type="button"
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => void activate(s)}
                >
                  Make active
                </button>
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