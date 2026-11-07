// Where uploaded files (CVs, portfolios) are stored: a Supabase Storage bucket.
// The publishable key is safe to ship to browsers; the bucket only accepts new uploads, size- and type-limited.
export const UPLOADS = {
  url: "https://hvbtfzytxnmexdqqxuhi.supabase.co",
  key: "sb_publishable_mG-UohWM80PzAGfC4owIhw_tGEC-yac", // publishable key: safe in the browser
  bucket: "nuvex-forms-uploads",
  maxBytes: 10 * 1024 * 1024,
  accept: ".pdf,.doc,.docx,.png,.jpg,.jpeg",
};
