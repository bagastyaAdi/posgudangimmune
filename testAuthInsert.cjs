const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://flfrfgrqfybfhvfcgksl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZnJmZ3JxZnliZmh2ZmNna3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODg3MDQsImV4cCI6MjA5NzU2NDcwNH0.-REy6dMeWTo2Ko82dqTwt-iiq7mlYVlFwCFKD1x7A0g';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const newStaff = {
      name: 'Test Karyawan',
      email: `test${Date.now()}@test.com`,
      username: `testuser${Date.now()}`,
      password: 'password123',
      role: 'kasir',
      branch: 'Pusat'
    };

    console.log("Mencoba sign up...", newStaff.email);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newStaff.email,
      password: newStaff.password,
    });

    if (authError) {
      console.error("Auth Error:", authError);
      return;
    }

    console.log("Signup success! User ID:", authData.user.id);
    console.log("Mencoba insert public.users...");
    const payload = {
      id: authData.user.id,
      name: newStaff.name,
      email: newStaff.email,
      username: newStaff.username,
      role: newStaff.role,
      branch: newStaff.branch
    };
    console.log("Payload:", payload);

    const { data: profileData, error: profileError } = await supabase.from('users').insert([payload]).select();

    if (profileError) {
      console.error("Profile Error:", profileError);
      return;
    }

    console.log("Success!", profileData);
  } catch (err) {
    console.error("Catch:", err);
  }
}

run();
