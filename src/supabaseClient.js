import { createClient } from "@supabase/supabase-js";

// These two values are PUBLIC and safe to ship in the browser.
// The anon key only works through your Row Level Security rules.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Helpful error if you forgot to set the env vars before building.
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anonKey);
