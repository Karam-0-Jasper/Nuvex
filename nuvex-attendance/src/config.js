// School database (Supabase project "nuvex-attendance"). The publishable key is safe to ship in the app:
// every table is locked, and the only way in is the functions in supabase/schema.sql, which check the login on the server.
// Set url to "" to run the app without logins (everything stays on the device).
// VITE_SUPABASE_URL / VITE_SUPABASE_KEY override these (used for testing against another database).
export const SUPABASE = {
  url: import.meta.env.VITE_SUPABASE_URL || "https://efnbburfzxyvxfxkmbpj.supabase.co",
  key: import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_zokrjwDEqlDQZQPUUgWTBw_jru0tbgC",
};
