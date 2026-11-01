import { createClient } from "@supabase/supabase-js";
import { SUPABASE } from "./config.js";

export const supabase = createClient(SUPABASE.url, SUPABASE.key, {
  auth: { persistSession: true, storageKey: "te-admin-auth" },
});
