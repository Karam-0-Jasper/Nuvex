// Where uploaded files (CVs, portfolios) are stored: a Supabase Storage bucket.
// The publishable key is safe to ship to browsers; the bucket only accepts new uploads, size- and type-limited.
export const UPLOADS = {
  url: "",            // e.g. "https://abcd1234.supabase.co"
  key: "",            // publishable (anon) key
  bucket: "nuvex-forms-uploads",
  maxBytes: 10 * 1024 * 1024,
  accept: ".pdf,.doc,.docx,.png,.jpg,.jpeg",
};
