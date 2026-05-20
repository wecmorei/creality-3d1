create extension if not exists pgcrypto;

create type public.order_status as enum (
  'draft',
  'quote_requested',
  'quoted',
  'awaiting_payment',
  'paid',
  'in_production',
  'ready',
  'shipped',
  'completed',
  'cancelled'
);

create type public.payment_status as enum (
  'pending',
  'authorized',
  'paid',
  'failed',
  'refunded',
  'cancelled'
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  short_description text not null,
  description text,
  starting_price_cents integer,
  price_label text not null,
  lead_time_label text not null,
  scale_label text not null,
  finish_label text not null,
  is_customizable boolean not null default true,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_starting_price_cents_check
    check (starting_price_cents is null or starting_price_cents >= 0)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_email_check
    check (email is null or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  public_code text not null unique,
  status public.order_status not null default 'quote_requested',
  payment_status public.payment_status not null default 'pending',
  subtotal_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null default 0,
  notes text,
  requested_deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_amounts_check
    check (subtotal_cents >= 0 and shipping_cents >= 0 and total_cents >= 0)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price_cents integer,
  scale_label text,
  finish_label text,
  customization_notes text,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_check check (quantity > 0),
  constraint order_items_unit_price_cents_check
    check (unit_price_cents is null or unit_price_cents >= 0)
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.reference_uploads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  storage_path text not null,
  original_filename text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index categories_active_sort_idx on public.categories (is_active, sort_order, name);
create index products_active_featured_sort_idx on public.products (is_active, is_featured desc, sort_order, name);
create index products_category_id_idx on public.products (category_id);
create index product_images_product_sort_idx on public.product_images (product_id, sort_order);
create index customers_phone_idx on public.customers (phone);
create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_events_order_created_idx on public.order_events (order_id, created_at desc);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.reference_uploads enable row level security;

create policy "Public can read active categories"
  on public.categories for select
  to anon, authenticated
  using (is_active = true);

create policy "Public can read active products"
  on public.products for select
  to anon, authenticated
  using (is_active = true);

create policy "Public can read active product images"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products
      where products.id = product_images.product_id
        and products.is_active = true
    )
  );

-- Customers and orders are intentionally private for the public client.
-- Inserts should go through a server-side endpoint or Supabase Edge Function
-- that validates the request and uses a privileged key outside the browser.

insert into public.categories (name, slug, description, sort_order)
values
  ('Action figures', 'action-figures', 'Personagens e colecionáveis personalizados.', 10),
  ('Miniaturas RPG', 'miniaturas-rpg', 'Miniaturas de mesa para RPG, dioramas e coleção.', 20),
  ('Decoração geek', 'decoracao-geek', 'Peças decorativas para setup, estante e presentes.', 30),
  ('Brindes e chaveiros', 'brindes-chaveiros', 'Itens pequenos personalizados para presentes e eventos.', 40),
  ('Peças técnicas', 'pecas-tecnicas', 'Prototipagem, suportes e peças funcionais.', 50);

insert into public.products (
  category_id,
  name,
  slug,
  short_description,
  price_label,
  starting_price_cents,
  lead_time_label,
  scale_label,
  finish_label,
  is_featured,
  sort_order
)
select categories.id, product_data.name, product_data.slug, product_data.short_description,
  product_data.price_label, product_data.starting_price_cents, product_data.lead_time_label,
  product_data.scale_label, product_data.finish_label, product_data.is_featured, product_data.sort_order
from (
  values
    ('action-figures', 'Action Figure Personalizada', 'action-figure-personalizada', 'Figure feita a partir de referência, com escala e acabamento definidos antes da produção.', 'Sob orçamento', 14900, '7 a 15 dias', '12 a 25 cm', 'Primer ou pintura', true, 10),
    ('miniaturas-rpg', 'Miniatura de Mesa', 'miniatura-de-mesa', 'Miniaturas para RPG, dioramas ou decoração, prontas para pintura ou com acabamento simples.', 'A partir de R$ 39', 3900, '3 a 7 dias', '3 a 8 cm', 'Sem pintura ou primer', false, 20),
    ('decoracao-geek', 'Decoração Geek', 'decoracao-geek', 'Suportes, bustos, símbolos e peças temáticas para estantes, escritórios e setups.', 'A partir de R$ 59', 5900, '5 a 10 dias', 'Variável', 'Cor única ou pintura', true, 30),
    ('brindes-chaveiros', 'Chaveiros e Lembranças', 'chaveiros-e-lembrancas', 'Itens pequenos, personalizados e ideais para brindes, eventos e presentes criativos.', 'A partir de R$ 15', 1500, '2 a 5 dias', 'Pequeno', 'Cor única', false, 40),
    ('pecas-tecnicas', 'Peças Técnicas', 'pecas-tecnicas', 'Prototipagem, suportes e peças funcionais avaliadas conforme medidas e uso esperado.', 'Sob análise', null, 'Sob análise', 'Conforme medidas', 'Funcional', false, 50),
    ('action-figures', 'Kit Pintura', 'kit-pintura', 'Peças impressas sem pintura para quem quer customizar o próprio colecionável.', 'Sob orçamento', null, '5 a 12 dias', 'Variável', 'Sem pintura', false, 60)
) as product_data(category_slug, name, slug, short_description, price_label, starting_price_cents, lead_time_label, scale_label, finish_label, is_featured, sort_order)
join public.categories on categories.slug = product_data.category_slug;
