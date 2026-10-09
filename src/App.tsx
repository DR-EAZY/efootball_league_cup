import { Route, Routes } from "react-router-dom";
import { PublicShell, AdminShell } from "./components/Shell";
import { OverviewPage, StandingsPage, FixturesPage, TeamsPage, TeamDetailPage } from "./pages/PublicPages";
import { LoginPage, AdminGate, AdminOverviewPage, AdminTeamsPage, AdminFixturesPage, AdminSeasonsPage } from "./pages/AdminPages";
import { supabase } from "./lib/supabase";

function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  return <AdminGate><AdminShell onLogout={() => { void supabase?.auth.signOut().then(() => { window.location.href = "/admin/login"; }); }}>{children}</AdminShell></AdminGate>;
}
function NotFound() { return <PublicShell><div className="not-found"><span className="eyebrow">404 / OFFSIDE</span><h1>Nothing here.</h1><p>The page you’re looking for isn’t part of this fixture.</p><a className="button button-dark" href="/">Back to overview</a></div></PublicShell>; }

export default function App() {
  return <Routes>
    <Route path="/" element={<PublicShell><OverviewPage/></PublicShell>}/>
    <Route path="/standings" element={<PublicShell><StandingsPage/></PublicShell>}/>
    <Route path="/fixtures" element={<PublicShell><FixturesPage/></PublicShell>}/>
    <Route path="/teams" element={<PublicShell><TeamsPage/></PublicShell>}/>
    <Route path="/teams/:id" element={<PublicShell><TeamDetailPage/></PublicShell>}/>
    <Route path="/admin/login" element={<LoginPage/>}/>
    <Route path="/admin" element={<ProtectedAdmin><AdminOverviewPage/></ProtectedAdmin>}/>
    <Route path="/admin/teams" element={<ProtectedAdmin><AdminTeamsPage/></ProtectedAdmin>}/>
    <Route path="/admin/fixtures" element={<ProtectedAdmin><AdminFixturesPage/></ProtectedAdmin>}/>
    <Route path="/admin/seasons" element={<ProtectedAdmin><AdminSeasonsPage/></ProtectedAdmin>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes>;
}
