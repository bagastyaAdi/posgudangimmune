import { supabase } from './supabase.js';

async function run() {
  const { data, error } = await supabase.from('app_settings').upsert({ id: 1, is_multi_branch: true });
  console.log("DATA:", data);
  console.log("ERROR:", error);
}
run();
