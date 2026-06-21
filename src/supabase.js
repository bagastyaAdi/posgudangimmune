import { createClient } from '@supabase/supabase-js'

// URL Database Supabase
const supabaseUrl = 'https://flfrfgrqfybfhvfcgksl.supabase.co'
// Kunci API (Anon/Public)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsZnJmZ3JxZnliZmh2ZmNna3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODg3MDQsImV4cCI6MjA5NzU2NDcwNH0.-REy6dMeWTo2Ko82dqTwt-iiq7mlYVlFwCFKD1x7A0g'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client khusus untuk Admin membuat akun staff tanpa mengubah sesi login Admin saat ini
export const supabaseAdminAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
})
