drop policy if exists "Admins can read their own admin profile" on public.admin_users;

create policy "Admins can read their own admin profile"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()) and is_active = true);
