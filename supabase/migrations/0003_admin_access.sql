create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "Admins can read their own admin profile"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid() and is_active = true);

create index admin_users_active_email_idx on public.admin_users (is_active, email);
