import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient.js";

// A name like "Reza M" becomes a hidden internal email so Supabase's
// secure login works — players only ever see/type a name + password.
const emailFor = (name) =>
  `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")}@worldcup.pool`;

const PICK_LABEL = { HOME_TEAM: "Home win", DRAW: "Draw", AWAY_TEAM: "Away win" };

function fmt(dt) {
  if (!dt) return "TBD";
  return new Date(dt).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

// ---------------------------------------------------------------- Auth screen
function AuthScreen() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!name.trim() || password.length < 4) {
      setError("Enter a name and a password of at least 4 characters.");
      return;
    }
    setBusy(true);
    const email = emailFor(name);
    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({
            email, password,
            options: { data: { display_name: name.trim() } },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="badge">⚽ WORLD CUP 2026</div>
        <h1 className="display">Office Pool</h1>
        <p className="muted">Pick the winners. Climb the table. Bragging rights only.</p>

        <div className="tabs">
          <button className={mode === "login" ? "tab on" : "tab"} onClick={() => setMode("login")}>Log in</button>
          <button className={mode === "signup" ? "tab on" : "tab"} onClick={() => setMode("signup")}>Sign up</button>
        </div>

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reza" autoComplete="username" />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && submit()} autoComplete="current-password" />
        </label>

        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy} onClick={submit}>
          {busy ? "…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
        <p className="hint">{mode === "signup"
          ? "Choose any name — it's how the others will see you on the table."
          : "Use the same name and password you signed up with."}</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Single fixture
function FixtureRow({ fx, locked, pick, onPick }) {
  const isGroup = fx.stage === "GROUP_STAGE";
  const options = isGroup ? ["HOME_TEAM", "DRAW", "AWAY_TEAM"] : ["HOME_TEAM", "AWAY_TEAM"];
  const labelFor = (opt) =>
    opt === "HOME_TEAM" ? fx.home_team : opt === "AWAY_TEAM" ? fx.away_team : "Draw";

  const correct = fx.finished && pick && pick === fx.result;
  const wrong = fx.finished && pick && pick !== fx.result;

  return (
    <div className={`fixture${fx.finished ? " done" : ""}`}>
      <div className="teams">
        <span className="team">{fx.home_team}</span>
        <span className="vs">v</span>
        <span className="team away">{fx.away_team}</span>
        {fx.finished && (
          <span className="resulttag">{PICK_LABEL[fx.result] ?? "—"}</span>
        )}
      </div>
      <div className="picks">
        {options.map((opt) => (
          <button
            key={opt}
            disabled={locked}
            className={"pick" + (pick === opt ? " sel" : "") +
              (locked && pick === opt && correct ? " good" : "") +
              (locked && pick === opt && wrong ? " bad" : "")}
            onClick={() => onPick(fx.id, opt)}
          >
            {labelFor(opt)}
          </button>
        ))}
      </div>
      {correct && <span className="chip good">✓ +{fx._points}</span>}
      {wrong && <span className="chip bad">✗</span>}
    </div>
  );
}

// -------------------------------------------------------------- Predict view
function Predict({ session }) {
  const [rounds, setRounds] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [picks, setPicks] = useState({}); // fixture_id -> pick
  const [pts, setPts] = useState({});      // stage -> points
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: r }, { data: f }, { data: p }, { data: sp }] = await Promise.all([
      supabase.from("rounds").select("*").order("sort"),
      supabase.from("fixtures").select("*").order("kickoff_at"),
      supabase.from("predictions").select("fixture_id,pick"),
      supabase.from("stage_points").select("stage,points"),
    ]);
    setRounds(r ?? []);
    setFixtures(f ?? []);
    setPts(Object.fromEntries((sp ?? []).map((s) => [s.stage, s.points])));
    setPicks(Object.fromEntries((p ?? []).map((x) => [x.fixture_id, x.pick])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function savePick(fixtureId, pick) {
    setPicks((prev) => ({ ...prev, [fixtureId]: pick })); // optimistic
    const { error } = await supabase.from("predictions").upsert(
      { user_id: session.user.id, fixture_id: fixtureId, pick },
      { onConflict: "user_id,fixture_id" },
    );
    if (error) { setMsg(error.message); load(); }
    else setMsg("Saved ✓");
    setTimeout(() => setMsg(""), 1500);
  }

  if (loading) return <p className="muted center">Loading fixtures…</p>;
  if (!fixtures.length)
    return <p className="muted center">No fixtures yet — they appear once the sync runs.</p>;

  const now = Date.now();
  return (
    <div>
      {msg && <div className="toast">{msg}</div>}
      {rounds.map((rd) => {
        const fxs = fixtures
          .filter((f) => f.round_key === rd.key)
          .map((f) => ({ ...f, _points: pts[f.stage] ?? 0 }));
        if (!fxs.length) return null;
        const locked = rd.lock_at && now >= new Date(rd.lock_at).getTime();
        return (
          <section className="round" key={rd.key}>
            <header className="round-head">
              <h2 className="display">{rd.name}</h2>
              <span className={"lock " + (locked ? "is-locked" : "is-open")}>
                {locked ? "🔒 Locked" : `Locks ${fmt(rd.lock_at)}`}
              </span>
            </header>
            {fxs.map((fx) => (
              <FixtureRow key={fx.id} fx={fx} locked={locked}
                          pick={picks[fx.id]} onPick={savePick} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ Leaderboard view
function Leaderboard({ meName }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.rpc("get_leaderboard").then(({ data }) => setRows(data ?? []));
  }, []);
  if (rows === null) return <p className="muted center">Tallying…</p>;
  if (!rows.length) return <p className="muted center">No scores yet.</p>;
  return (
    <table className="board">
      <thead><tr><th>#</th><th>Player</th><th>Correct</th><th>Points</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.display_name} className={r.display_name === meName ? "me" : ""}>
            <td className="rank">{i + 1}</td>
            <td>{r.display_name}</td>
            <td>{r.correct}</td>
            <td className="pts">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------- Splash
function Splash() {
  return (
    <div className="splash">
      <div className="splash-center">
        <div className="splash-kicker">ICOLO &amp; FRIENDS</div>
        <div className="splash-title">World&nbsp;Cup<br />Predictor</div>
        <div className="splash-ball">⚽</div>
      </div>
      <div className="splash-credit">a product of nbo1 ops team</div>
    </div>
  );
}

// --------------------------------------------------------------------- Shell
export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [tab, setTab] = useState("predict");
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN") setShowSplash(true); // replay on each login
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Hold the launch screen ~2.5s, like a social app.
  useEffect(() => {
    if (!showSplash) return;
    const t = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(t);
  }, [showSplash]);

  useEffect(() => {
    if (!session) { setName(""); return; }
    supabase.from("profiles").select("display_name").eq("id", session.user.id).single()
      .then(({ data }) => setName(data?.display_name ?? ""));
  }, [session]);

  if (showSplash) return <Splash />;
  if (!ready) return null;
  if (!session) return <AuthScreen />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="dot" />World Cup 2026 Pool</div>
        <div className="who">
          <span className="muted">Hi, {name || "Player"}</span>
          <button className="ghost" onClick={() => supabase.auth.signOut()}>Log out</button>
        </div>
      </header>

      <nav className="maintabs">
        <button className={tab === "predict" ? "on" : ""} onClick={() => setTab("predict")}>Predict</button>
        <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>Leaderboard</button>
      </nav>

      <main className="content">
        {tab === "predict" ? <Predict session={session} /> : <Leaderboard meName={name} />}
      </main>
    </div>
  );
}
