// School database (Supabase). The publishable key is safe to ship in the app: every table is locked,
// and the only way in is the functions in supabase/schema.sql, which check the login on the server.
// With no url the app runs without logins (everything stays on the device).
// VITE_SUPABASE_URL / VITE_SUPABASE_KEY override these (used for testing against another database).
export const SUPABASE = {
  url: import.meta.env.VITE_SUPABASE_URL || "",
  key: import.meta.env.VITE_SUPABASE_KEY || "",
};
