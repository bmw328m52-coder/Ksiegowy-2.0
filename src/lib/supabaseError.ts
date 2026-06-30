// Wspólny helper: mapuje błędy Supabase / PostgREST / Postgres na czytelne
// komunikaty po polsku.
//
// Uwaga: błędy z supabase-js to zwykłe obiekty (PostgrestError:
// { message, details, hint, code }) — NIE instancje Error. Dlatego wzorzec
// `e instanceof Error ? e.message : "Nieznany błąd."` gubił treść i pokazywał
// użytkownikowi "Nieznany błąd". Tutaj rozpoznajemy kształt błędu oraz kody
// SQLSTATE/PostgREST i zwracamy zrozumiały komunikat.

type SupabaseLikeError = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function asSupabaseError(e: unknown): SupabaseLikeError | null {
  if (e && typeof e === "object" && ("code" in e || "details" in e || "hint" in e)) {
    return e as SupabaseLikeError;
  }
  return null;
}

export function humanizeSupabaseError(e: unknown, fallback = "Nieznany błąd."): string {
  const err = asSupabaseError(e);

  if (err) {
    switch (err.code) {
      case "23505": // unique_violation
        return "Taka pozycja już istnieje (duplikat nazwy).";
      case "23503": // foreign_key_violation
        return "Nie można — pozycja jest powiązana z innymi danymi.";
      case "23502": // not_null_violation
        return "Brakuje wymaganego pola.";
      case "23514": // check_violation
        return "Wartość nie spełnia ograniczeń.";
      case "42501": // insufficient_privilege (zwykle RLS)
      case "PGRST301":
        return "Brak uprawnień do tej operacji.";
      case "PGRST116": // pusty wynik tam, gdzie oczekiwano rekordu
        return "Nie znaleziono rekordu.";
      case "57014": // statement_timeout
        return "Operacja przekroczyła limit czasu — spróbuj ponownie.";
    }
    if (err.message && /row-level security/i.test(err.message)) {
      return "Brak uprawnień do tej operacji (RLS).";
    }
    if (err.message && err.message.trim()) return err.message.trim();
  }

  if (e instanceof Error && e.message.trim()) return e.message.trim();
  return fallback;
}
