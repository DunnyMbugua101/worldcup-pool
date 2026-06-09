import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import bgUrl from "./assets/world-cup.png";

const PICK_LABEL = { HOME_TEAM: "Home win", DRAW: "Draw", AWAY_TEAM: "Away win" };

// Safety net: never show an email — display only the part before any "@".
const cleanName = (n) => (n || "Player").split("@")[0];
const validEmail = (e) => /\S+@\S+\.\S+/.test((e || "").trim());

function fmtDate(dt) {
  if (!dt) return "Date TBD";
  return new Date(dt).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
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

// ---------------------------------------------------------------- Auth screen
function AuthScreen() {
  const [mode, setMode] = useState("login"); // login | signup | reset
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const go = (m) => { setMode(m); setError(""); setInfo(""); };

  async function submit() {
    setError(""); setInfo("");

    if (mode === "reset") {
      if (!validEmail(email)) { setError("Enter the email you signed up with."); return; }
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      });
      setBusy(false);
      if (error) setError(error.message);
      else setInfo("If that email has an account, a reset link is on its way.");
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) { setError("Enter the name you want on the leaderboard."); return; }
      if (!validEmail(email)) { setError("Enter a valid email — it's how you log in and reset your password."); return; }
      if (password.length < 4) { setError("Use a password of at least 4 characters."); return; }
      setBusy(true);
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { data: { display_name: name.trim() } },
      });
      setBusy(false);
      if (error) setError(error.message);
      return;
    }

    // login
    if (!validEmail(email) || password.length < 4) { setError("Enter your email and password."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="badge">⚽ WORLD CUP 2026</div>
        <h1 className="display">Office Pool</h1>
        <p className="muted">Pick the winners. Climb the table. Bragging rights only.</p>

        {mode !== "reset" && (
          <div className="tabs">
            <button className={mode === "login" ? "tab on" : "tab"} onClick={() => go("login")}>Log in</button>
            <button className={mode === "signup" ? "tab on" : "tab"} onClick={() => go("signup")}>Sign up</button>
          </div>
        )}

        {mode === "signup" && (
          <label className="field">
            <span>Name <em>(shown on the leaderboard)</em></span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reza" autoComplete="name" />
          </label>
        )}

        {mode === "reset" && (
          <p className="muted small">Enter your email and we'll send a link to set a new password.</p>
        )}

        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && submit()}
                 placeholder="you@example.com" autoComplete="email" />
        </label>

        {mode !== "reset" && (
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && submit()} autoComplete="current-password" />
          </label>
        )}

        {error && <div className="error">{error}</div>}
        {info && <div className="info">{info}</div>}

        <button className="primary" disabled={busy} onClick={submit}>
          {busy ? "…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Log in"}
        </button>

        {mode === "login" && (
          <p className="hint">Forgot your password? <button className="linkbtn" onClick={() => go("reset")}>Reset it</button></p>
        )}
        {mode === "signup" && (
          <p className="hint">Your email is only for logging in and resetting your password — it's never shown to anyone else. Your name is what appears on the leaderboard.</p>
        )}
        {mode === "reset" && (
          <p className="hint"><button className="linkbtn" onClick={() => go("login")}>← Back to log in</button></p>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------- Set new password
function NewPassword({ onDone }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function save() {
    if (pw.length < 4) { setErr("Use at least 4 characters."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setErr(error.message);
    else setDone(true);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="badge">⚽ RESET PASSWORD</div>
        <h1 className="display">{done ? "All set" : "New password"}</h1>
        {done ? (
          <>
            <p className="muted">Your password has been updated.</p>
            <button className="primary" onClick={onDone}>Continue</button>
          </>
        ) : (
          <>
            <label className="field">
              <span>Choose a new password</span>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && save()} />
            </label>
            {err && <div className="error">{err}</div>}
            <button className="primary" disabled={busy} onClick={save}>{busy ? "…" : "Save password"}</button>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------- Fixture (predict)
function FixtureRow({ fx, locked, pick, onPick }) {
  const isGroup = fx.stage === "GROUP_STAGE";
  const options = isGroup ? ["HOME_TEAM", "DRAW", "AWAY_TEAM"] : ["HOME_TEAM", "AWAY_TEAM"];
  const labelFor = (opt) =>
    opt === "HOME_TEAM" ? fx.home_team : opt === "AWAY_TEAM" ? fx.away_team : "Draw";
  return (
    <div className="fixture">
      <div className="when">{fmtDate(fx.kickoff_at)}</div>
      <div className="teams">
        <span className="team">{fx.home_team}</span>
        <span className="vs">v</span>
        <span className="team away">{fx.away_team}</span>
      </div>
      <div className="picks">
        {options.map((opt) => (
          <button key={opt} disabled={locked}
            className={"pick" + (pick === opt ? " sel" : "")}
            onClick={() => onPick(fx.id, opt)}>
            {labelFor(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------- Predict (current round)
function Predict({ session }) {
  const [rounds, setRounds] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [picks, setPicks] = useState({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: r }, { data: f }, { data: p }] = await Promise.all([
      supabase.from("rounds").select("*").order("sort"),
      supabase.from("fixtures").select("*").order("kickoff_at"),
      supabase.from("predictions").select("fixture_id,pick"),
    ]);
    setRounds(r ?? []);
    setFixtures(f ?? []);
    setPicks(Object.fromEntries((p ?? []).map((x) => [x.fixture_id, x.pick])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function savePick(fixtureId, pick) {
    setPicks((prev) => ({ ...prev, [fixtureId]: pick }));
    const { error } = await supabase.from("predictions").upsert(
      { user_id: session.user.id, fixture_id: fixtureId, pick },
      { onConflict: "user_id,fixture_id" },
    );
    if (error) { setMsg(error.message); load(); }
    else setMsg("Saved");
    setTimeout(() => setMsg(""), 1500);
  }

  if (loading) return <p className="muted center">Loading fixtures…</p>;
  if (!fixtures.length)
    return <p className="muted center">No fixtures yet — they appear once the sync runs.</p>;

  const now = Date.now();
  const open = rounds
    .filter((r) => r.lock_at && new Date(r.lock_at).getTime() > now)
    .sort((a, b) => new Date(a.lock_at) - new Date(b.lock_at));
  const current = open[0];
  const next = open[1];

  if (!current)
    return <p className="muted center">No round is open for predictions right now. Check the Results tab.</p>;

  const fxs = fixtures.filter((f) => f.round_key === current.key);

  return (
    <div>
      {msg && <div className="toast">{msg}</div>}
      <section className="round">
        <header className="round-head">
          <h2 className="display">{current.name}</h2>
          <span className="lock is-open">Locks {fmtDate(current.lock_at)}</span>
        </header>
        <p className="muted small">
          Make your picks before this round locks. The next round opens here automatically once it closes.
        </p>
        {fxs.map((fx) => (
          <FixtureRow key={fx.id} fx={fx} locked={false} pick={picks[fx.id]} onPick={savePick} />
        ))}
      </section>
      {next && <p className="muted center small">Up next: {next.name} — opens after this round closes.</p>}
    </div>
  );
}

// --------------------------------------------------------------- History
function History() {
  const [items, setItems] = useState(null);
  const [pts, setPts] = useState({});

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: f }, { data: sp }] = await Promise.all([
        supabase.from("predictions").select("fixture_id,pick"),
        supabase.from("fixtures").select("*"),
        supabase.from("stage_points").select("stage,points"),
      ]);
      const fById = Object.fromEntries((f ?? []).map((x) => [x.id, x]));
      setPts(Object.fromEntries((sp ?? []).map((s) => [s.stage, s.points])));
      const rows = (p ?? [])
        .map((pr) => ({ pr, fx: fById[pr.fixture_id] }))
        .filter((r) => r.fx)
        .sort((a, b) => new Date(b.fx.kickoff_at) - new Date(a.fx.kickoff_at));
      setItems(rows);
    })();
  }, []);

  if (items === null) return <p className="muted center">Loading…</p>;
  if (!items.length) return <p className="muted center">You haven't made any predictions yet.</p>;

  const pickText = (fx, pick) =>
    pick === "DRAW" ? "Draw" : pick === "HOME_TEAM" ? fx.home_team : fx.away_team;

  return (
    <div>
      {items.map(({ pr, fx }) => {
        const finished = fx.finished;
        const correct = finished && pr.pick === fx.result;
        return (
          <div className="fixture done" key={fx.id}>
            <div className="when">{fmtDate(fx.kickoff_at)}</div>
            <div className="teams">
              <span className="team">{fx.home_team}</span>
              <span className="vs">v</span>
              <span className="team away">{fx.away_team}</span>
            </div>
            <div className="small">
              <span className="muted">Your pick: </span><b>{pickText(fx, pr.pick)}</b>
              {finished
                ? (correct
                    ? <span className="chip good" style={{ marginLeft: 8 }}>✓ +{pts[fx.stage] ?? 0}</span>
                    : <span className="chip bad" style={{ marginLeft: 8 }}>✗</span>)
                : <span className="chip pending" style={{ marginLeft: 8 }}>Not played yet</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------- Results
function Results() {
  const [rows, setRows] = useState(null);
  const [picks, setPicks] = useState({});
  const [pts, setPts] = useState({});

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: p }, { data: sp }] = await Promise.all([
        supabase.from("fixtures").select("*").eq("finished", true).order("kickoff_at", { ascending: false }),
        supabase.from("predictions").select("fixture_id,pick"),
        supabase.from("stage_points").select("stage,points"),
      ]);
      setRows(f ?? []);
      setPicks(Object.fromEntries((p ?? []).map((x) => [x.fixture_id, x.pick])));
      setPts(Object.fromEntries((sp ?? []).map((s) => [s.stage, s.points])));
    })();
  }, []);

  if (rows === null) return <p className="muted center">Loading…</p>;
  if (!rows.length)
    return <p className="muted center">No results yet — finished matches will show up here.</p>;

  const outcome = (fx) =>
    fx.result === "DRAW" ? "Draw"
      : fx.result === "HOME_TEAM" ? `${fx.home_team} won`
      : fx.result === "AWAY_TEAM" ? `${fx.away_team} won` : "—";

  return (
    <div>
      {rows.map((fx) => {
        const my = picks[fx.id];
        const correct = my && my === fx.result;
        return (
          <div className="fixture done" key={fx.id}>
            <div className="when">{fmtDate(fx.kickoff_at)}</div>
            <div className="teams">
              <span className="team">{fx.home_team}</span>
              <span className="vs">v</span>
              <span className="team away">{fx.away_team}</span>
              <span className="resulttag">{outcome(fx)}</span>
            </div>
            <div className="small">
              {my
                ? (correct
                    ? <span className="chip good">✓ Your pick — +{pts[fx.stage] ?? 0}</span>
                    : <span className="chip bad">✗ You picked {PICK_LABEL[my] ?? "—"}</span>)
                : <span className="muted">No prediction</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ Leaderboard
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
          <tr key={r.display_name} className={cleanName(r.display_name) === cleanName(meName) ? "me" : ""}>
            <td className="rank">{i + 1}</td>
            <td>{cleanName(r.display_name)}</td>
            <td>{r.correct}</td>
            <td className="pts">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------- Help page
function Help({ onBack }) {
  return (
    <div className="help">
      <button className="back" onClick={onBack}>← Back</button>
      <h1 className="display">How it works</h1>
      <p className="muted">Everything you need to know to play.</p>

      <h2 className="display h2">Signing in</h2>
      <p>Sign up with your name, an email, and a password. You log in with your email,
      and the name you choose is exactly how you appear on the leaderboard — your email
      is never shown to anyone. Forgotten your password? Use the "Reset it" link on the
      login screen and you'll get a reset email.</p>

      <h2 className="display h2">Making predictions</h2>
      <p>The <b>Predict</b> tab shows the round closing next. Make your picks before it
      locks — locking happens at the first kickoff of that round, and after that those
      picks are final. As soon as one round closes, the next opens automatically.</p>
      <ul>
        <li>Group games: pick <b>Home win</b>, <b>Draw</b>, or <b>Away win</b>.</li>
        <li>Knockout games: pick which team <b>advances</b> (no draws).</li>
      </ul>

      <h2 className="display h2">Scoring</h2>
      <p>You earn points for every correct pick — worth more the deeper the tournament goes:</p>
      <table className="rules"><tbody>
        <tr><td>Group stage</td><td>1 pt</td></tr>
        <tr><td>Round of 32</td><td>2 pts</td></tr>
        <tr><td>Round of 16</td><td>4 pts</td></tr>
        <tr><td>Quarter-finals</td><td>6 pts</td></tr>
        <tr><td>Semi-finals</td><td>8 pts</td></tr>
        <tr><td>Final</td><td>10 pts</td></tr>
      </tbody></table>
      <p className="muted small">The third-place play-off isn't scored.</p>

      <h2 className="display h2">The penalty</h2>
      <p>Miss a whole round — no picks at all before it locks — and you lose
      <b> 3 points</b> for that round. Showing up every week matters.</p>

      <h2 className="display h2">History, results &amp; standings</h2>
      <p>The <b>History</b> tab is your personal record — every pick you've made and how
      it turned out. The <b>Results</b> tab shows finished matches and who won. The
      <b> Leaderboard</b> ranks everyone by total points. Results update on their own as
      matches finish.</p>

      <button className="back" onClick={onBack}>← Back to predictions</button>
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
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN") setShowSplash(true);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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

  let content;
  if (showSplash) content = <Splash />;
  else if (recovery) content = <NewPassword onDone={() => setRecovery(false)} />;
  else if (!ready) content = null;
  else if (!session) content = <AuthScreen />;
  else content = (
    <>
      <div className="bg" style={{ backgroundImage: `url(${bgUrl})` }} aria-hidden="true" />
      <div className="bg-scrim" aria-hidden="true" />
      <div className="app">
        <div className="toprow">
          <button className="help-btn" onClick={() => setTab("help")}>How it works</button>
          <span className="credit-tl">a product of nbo1 ops team</span>
        </div>
        <header className="topbar">
          <div className="brand"><span className="dot" />World Cup 2026 Pool</div>
          <div className="who">
            <span className="muted">Hi, {cleanName(name)}</span>
            <button className="ghost" onClick={() => supabase.auth.signOut()}>Log out</button>
          </div>
        </header>

        <nav className="maintabs">
          <button className={tab === "predict" ? "on" : ""} onClick={() => setTab("predict")}>Predict</button>
          <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>History</button>
          <button className={tab === "results" ? "on" : ""} onClick={() => setTab("results")}>Results</button>
          <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>Leaderboard</button>
        </nav>

        <main className="content">
          {tab === "predict" && <Predict session={session} />}
          {tab === "history" && <History />}
          {tab === "results" && <Results />}
          {tab === "board" && <Leaderboard meName={name} />}
          {tab === "help" && <Help onBack={() => setTab("predict")} />}
        </main>
      </div>
    </>
  );

  return content;
}