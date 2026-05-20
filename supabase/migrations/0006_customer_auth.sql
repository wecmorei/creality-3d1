-- Vincula clientes do site a contas Supabase Auth (área do cliente fase 2)

alter table public.customers
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create index if not exists customers_auth_user_id_idx
  on public.customers (auth_user_id)
  where auth_user_id is not null;

create index if not exists customers_email_lower_idx
  on public.customers (lower(email))
  where email is not null;
