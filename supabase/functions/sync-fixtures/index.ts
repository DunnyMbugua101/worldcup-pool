// ============================================================
//  sync-fixtures — Supabase Edge Function
//  Pulls all World Cup 2026 matches from football-data.org and
//  upserts them into your `rounds` and `fixtures` tables.
//  Runs server-side, so your API token never reaches the browser.
//  Re-runnable: upsert by id means scores update in place, no dupes.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// You only set FOOTBALL_DATA_KEY yourself (see README step 4).
const FOOTBALL_KEY = Deno.env.get("FOOTBALL_DATA_KEY")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ROUND_NAMES: Record<string, string> = {
  LAST_32: "Round of 32",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third-place play-off",
  FINAL: "Final",
};
const ROUND_SORT: Record<string, number> = {
  GROUP_MD1: 1, GROUP_MD2: 2, GROUP_MD3: 3,
  LAST_32: 4, LAST_16: 5, QUARTER_FINALS: 6,
  SEMI_FINALS: 7, THIRD_PLACE: 8, FINAL: 9,
};

function roundFor(m: any) {
  if (m.stage === "GROUP_STAGE") {
    return { key: `GROUP_MD${m.matchday}`, name: `Group stage — Matchday ${m.matchday}` };
  }
  return { key: m.stage, name: ROUND_NAMES[m.stage] ?? m.stage };
}

Deno.serve(async () => {
  const res = await fetch(
    "https://api.football-data.org/v4/matches?competitions=WC",
    { headers: { "X-Auth-Token": FOOTBALL_KEY } },
  );
  if (!res.ok) {
    return new Response(`football-data.org error: ${res.status}`, { status: 502 });
  }

  const { matches = [] } = await res.json();
  const roundsByKey = new Map<string, any>();

  const fixtures = matches.map((m: any) => {
    const r = roundFor(m);
    // Default a round's lock to the earliest kickoff it contains.
    const existing = roundsByKey.get(r.key);
    if (!existing || m.utcDate < existing.lock_at) {
      roundsByKey.set(r.key, {
        key: r.key,
        name: r.name,
        lock_at: m.utcDate,
        sort: ROUND_SORT[r.key] ?? 99,
      });
    }
    return {
      id: m.id,
      round_key: r.key,
      stage: m.stage,
      home_team: m.homeTeam?.name ?? "TBD",
      away_team: m.awayTeam?.name ?? "TBD",
      kickoff_at: m.utcDate,
      matchday: m.matchday ?? null,
      result: m.status === "FINISHED" ? (m.score?.winner ?? null) : null,
      finished: m.status === "FINISHED",
    };
  });

  // ignoreDuplicates: once a round exists we never overwrite its lock_at,
  // so any lock time you customise in the Table Editor sticks.
  const rounds = [...roundsByKey.values()];
  await supabase.from("rounds")
    .upsert(rounds, { onConflict: "key", ignoreDuplicates: true });

  const { error } = await supabase.from("fixtures")
    .upsert(fixtures, { onConflict: "id" });
  if (error) return new Response(error.message, { status: 500 });

  return new Response(
    JSON.stringify({ rounds: rounds.length, fixtures: fixtures.length }),
    { headers: { "Content-Type": "application/json" } },
  );
});
