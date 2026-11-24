import { createClient } from "@supabase/supabase-js";
let cached;
export function getDb() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) return null;
  cached = createClient(url,key,{
    auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:false},
    global:{headers:{"x-client-info":"pinaster360-production/0.1.0"}}
  });
  return cached;
}
export const technicalEmail = (username) => {
  if (!/^[A-Za-z][A-Za-z0-9_]{2,49}$/.test(username)) throw new Error("Usuario no válido.");
  return username.toLowerCase()+"@pinaster.invalid";
};
