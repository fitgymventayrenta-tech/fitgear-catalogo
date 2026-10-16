
const SUPABASE_URL = "https://yacgwqoderoflleoyjnc.supabase.co/rest/v1/";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_H52815mhD1e2l9b6AycLTQ_vNlMo1qL";

export const supabaseConfig = {
  url: SUPABASE_URL.replace(/\/$/, ""),
  key: SUPABASE_PUBLISHABLE_KEY.trim()
};
