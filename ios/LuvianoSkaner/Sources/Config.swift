import Foundation

/// Publiczne dane projektu Supabase (te same co NEXT_PUBLIC_* w meble-app).
/// Klucz anon jest jawny z założenia — dostęp do danych chroni RLS + logowanie.
enum Config {
    static let supabaseURL = URL(string: "https://mmqxjjeviiegsrfvyqkm.supabase.co")!
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcXhqamV2aWllZ3NyZnZ5cWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTUyNDQsImV4cCI6MjA5Mjg3MTI0NH0.Zbzogu_hggT96XTCLYnqJf8p-wmY5gEXbNo3EiLg6II"
}
