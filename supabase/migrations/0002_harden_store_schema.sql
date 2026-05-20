alter function public.set_updated_at() set search_path = pg_catalog;

create index order_items_product_id_idx on public.order_items (product_id);
create index reference_uploads_order_id_idx on public.reference_uploads (order_id);

create policy "No public access to customers"
  on public.customers for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No public access to orders"
  on public.orders for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No public access to order items"
  on public.order_items for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No public access to order events"
  on public.order_events for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No public access to reference uploads"
  on public.reference_uploads for all
  to anon, authenticated
  using (false)
  with check (false);
