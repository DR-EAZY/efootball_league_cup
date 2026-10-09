import { NavLink, Link } from "react-router-dom";
import { Activity, CalendarDays, Shield, Trophy, Users, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { supabase } from "../lib/supabase";

const publicLinks = [
  { to: "/", label: "Overview", icon: Activity },
  { to: "/standings", label: "Standings", icon: Trophy },
  { to: "/fixtures", label: "Fixtures", icon: CalendarDays },
  { to: "/teams", label: "Teams", icon: Users }
];

export function PublicShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand"><span className="brand-mark">T</span><span>TOUCHLINE<small>eFOOTBALL LEAGUE</small></span></Link>
      <button className="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      <nav className={`public-nav ${open ? "is-open" : ""}`}>
        {publicLinks.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}><Icon size={16}/>{label}</NavLink>)}
        <Link to="/admin/login" className="admin-link"><Shield size={16}/> Admin</Link>
      </nav>
    </header>
    <main className="public-main">{children}</main>
    <footer className="footer"><span>TOUCHLINE / COMPETITIVE eFOOTBALL</span><span>Every match counts.</span></footer>
  </div>;
}

export function AdminShell({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) {
  const links = [
    { to: "/admin", label: "Overview", icon: Activity, end: true },
    { to: "/admin/teams", label: "Teams", icon: Users },
    { to: "/admin/fixtures", label: "Fixtures & results", icon: CalendarDays },
    { to: "/admin/seasons", label: "Seasons", icon: Trophy }
  ];
  return <div className="admin-layout">
    <aside className="admin-sidebar">
      <Link to="/" className="brand"><span className="brand-mark">T</span><span>TOUCHLINE<small>LEAGUE OFFICE</small></span></Link>
      <div className="sidebar-caption">MANAGEMENT</div>
      <nav>{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end}><Icon size={17}/>{label}</NavLink>)}</nav>
      <div className="sidebar-bottom"><Link to="/">← View public league</Link><button onClick={onLogout}><LogOut size={16}/> Sign out</button></div>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}
