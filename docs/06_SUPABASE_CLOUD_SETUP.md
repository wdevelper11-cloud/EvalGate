# Supabase Cloud setup

1. Create a hosted project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor** in that project.
3. Copy all of `supabase-patches/001_initial_schema.sql` into a new query and run it once.
4. In **Authentication → Providers**, enable email/password authentication.
5. Copy `.env.example` to `.env.local` and add the project URL and anon key from the project API settings.
6. Keep `.env.local` private and expose no service-role credentials to the browser.

EvalGate uses Supabase Cloud only. Do not install the Supabase CLI or run a local Supabase stack.
