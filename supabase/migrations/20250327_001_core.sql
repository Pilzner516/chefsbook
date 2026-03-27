-- Extensions
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ============================================================
-- VISIBILITY TYPE — core to the entire sharing model
-- ============================================================
create type visibility_level as enum (
  'private',      -- only the owner
  'shared_link',  -- anyone with the share_token URL (no login needed)
  'friends',      -- accepted followers (Pro feature)
  'public'        -- indexed and discoverable (Pro feature)
);

create type plan_tier as enum ('free', 'pro', 'family');

-- ============================================================
-- USER PROFILES — one per auth.users row
-- ============================================================
create table user_profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  username               text unique,
  display_name           text,
  avatar_url             text,
  bio                    text,
  -- Subscription
  plan_tier              plan_tier not null default 'free',
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  -- Apple IAP (iOS — stub for future)
  apple_original_transaction_id text,
  -- Preferences
  default_visibility     visibility_level not null default 'private',
  country_code           text default 'US',
  -- Timestamps
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into user_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Chef'));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- FOLLOWS — social graph
-- ============================================================
create table follows (
  id          uuid primary key default gen_random_uuid(),
  follower_id uuid references auth.users(id) on delete cascade not null,
  followed_id uuid references auth.users(id) on delete cascade not null,
  status      text check (status in ('pending', 'accepted')) default 'accepted',
  created_at  timestamptz default now(),
  unique (follower_id, followed_id)
);

-- ============================================================
-- COOKBOOKS — books the user owns (EYB-style shelf)
-- ============================================================
create table cookbooks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  title      text not null,
  author     text,
  isbn       text,
  publisher  text,
  year       smallint,
  cover_url  text,
  notes      text,
  rating     smallint check (rating between 1 and 5),
  location   text,
  visibility visibility_level not null default 'private',
  created_at timestamptz default now()
);

-- ============================================================
-- RECIPES — core table
-- ============================================================
create table recipes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  title         text not null,
  description   text,
  -- Source
  source_url    text,
  source_type   text check (source_type in (
                  'url','scan','manual','ai','social','cookbook'
                )) not null default 'manual',
  -- Cookbook reference
  cookbook_id   uuid references cookbooks(id) on delete set null,
  page_number   integer,
  -- Media
  image_url     text,
  -- Timing
  prep_minutes  integer,
  cook_minutes  integer,
  total_minutes integer generated always as (
                  coalesce(prep_minutes,0) + coalesce(cook_minutes,0)
                ) stored,
  -- Servings
  servings      numeric(6,2) default 4,
  -- Classification
  cuisine       text,
  course        text check (course in (
                  'breakfast','brunch','lunch','dinner',
                  'starter','main','side','dessert','snack','drink','other'
                )),
  -- Metadata
  rating        smallint check (rating between 1 and 5),
  is_favourite  boolean default false,
  tags          text[] default '{}',
  notes         text,
  -- Nutrition (per serving, AI-estimated)
  calories      numeric(8,2),
  protein_g     numeric(8,2),
  carbs_g       numeric(8,2),
  fat_g         numeric(8,2),
  -- Visibility & sharing
  visibility    visibility_level not null default 'private',
  share_token   text unique default encode(gen_random_bytes(12), 'base64url'),
  -- Timestamps
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index recipes_title_trgm  on recipes using gin (title gin_trgm_ops);
create index recipes_user_id     on recipes (user_id);
create index recipes_visibility  on recipes (visibility);
create index recipes_cuisine     on recipes (cuisine);
create index recipes_course      on recipes (course);
create index recipes_tags        on recipes using gin (tags);
create index recipes_share_token on recipes (share_token);

-- ============================================================
-- RECIPE INGREDIENTS
-- ============================================================
create table recipe_ingredients (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid references recipes(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  sort_order  smallint not null default 0,
  quantity    numeric(10,3),
  unit        text,
  ingredient  text not null,
  preparation text,
  optional    boolean default false,
  group_label text
);
create index recipe_ingredients_recipe_id  on recipe_ingredients (recipe_id);
create index recipe_ingredients_name       on recipe_ingredients using gin (ingredient gin_trgm_ops);

-- ============================================================
-- RECIPE STEPS
-- ============================================================
create table recipe_steps (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid references recipes(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  step_number  smallint not null,
  instruction  text not null,
  timer_minutes integer,
  group_label  text
);
create index recipe_steps_recipe_id on recipe_steps (recipe_id);

-- ============================================================
-- MEAL PLANS — always private (no visibility column needed)
-- ============================================================
create table meal_plans (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references auth.users(id) on delete cascade not null,
  plan_date date not null,
  meal_slot text check (meal_slot in (
              'breakfast','brunch','lunch','dinner','snack','other'
            )) not null default 'dinner',
  recipe_id uuid references recipes(id) on delete set null,
  servings  numeric(6,2),
  notes     text,
  created_at timestamptz default now()
);
create index meal_plans_user_date on meal_plans (user_id, plan_date);

-- ============================================================
-- SHOPPING LISTS — always private
-- ============================================================
create table shopping_lists (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  name             text not null default 'Shopping list',
  date_range_start date,
  date_range_end   date,
  created_at       timestamptz default now()
);

create table shopping_list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid references shopping_lists(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  ingredient text not null,
  quantity   numeric(10,3),
  unit       text,
  aisle      text,
  is_checked boolean default false,
  recipe_ids uuid[] default '{}',
  sort_order smallint default 0
);

-- ============================================================
-- RLS — Row Level Security
-- ============================================================
alter table user_profiles        enable row level security;
alter table follows               enable row level security;
alter table cookbooks             enable row level security;
alter table recipes               enable row level security;
alter table recipe_ingredients    enable row level security;
alter table recipe_steps          enable row level security;
alter table meal_plans            enable row level security;
alter table shopping_lists        enable row level security;
alter table shopping_list_items   enable row level security;

-- user_profiles: own row + public read of username/display_name
create policy "profiles: own all"    on user_profiles for all    using (auth.uid() = id);
create policy "profiles: public read" on user_profiles for select using (true);

-- follows
create policy "follows: own all" on follows for all using (auth.uid() = follower_id);
create policy "follows: see who follows me" on follows for select using (auth.uid() = followed_id);

-- recipes: THE key visibility policy
create policy "recipes: visibility"
  on recipes for select using (
    user_id = auth.uid()
    or visibility = 'public'
    or visibility = 'shared_link'
    or (
      visibility = 'friends'
      and exists (
        select 1 from follows
        where follower_id = auth.uid()
          and followed_id = recipes.user_id
          and status = 'accepted'
      )
    )
  );
create policy "recipes: own write" on recipes for insert with check (auth.uid() = user_id);
create policy "recipes: own update" on recipes for update using (auth.uid() = user_id);
create policy "recipes: own delete" on recipes for delete using (auth.uid() = user_id);

-- ingredients + steps: inherit recipe visibility via EXISTS
create policy "ingredients: read via recipe"
  on recipe_ingredients for select using (
    exists (select 1 from recipes r where r.id = recipe_id
      and (r.user_id = auth.uid() or r.visibility in ('public','shared_link')
        or (r.visibility = 'friends' and exists (
          select 1 from follows where follower_id = auth.uid()
            and followed_id = r.user_id and status = 'accepted'
        ))
      )
    )
  );
create policy "ingredients: own write" on recipe_ingredients for insert with check (auth.uid() = user_id);
create policy "ingredients: own update" on recipe_ingredients for update using (auth.uid() = user_id);
create policy "ingredients: own delete" on recipe_ingredients for delete using (auth.uid() = user_id);

-- steps: same pattern as ingredients
create policy "steps: read via recipe"
  on recipe_steps for select using (
    exists (select 1 from recipes r where r.id = recipe_id
      and (r.user_id = auth.uid() or r.visibility in ('public','shared_link')
        or (r.visibility = 'friends' and exists (
          select 1 from follows where follower_id = auth.uid()
            and followed_id = r.user_id and status = 'accepted'
        ))
      )
    )
  );
create policy "steps: own write" on recipe_steps for insert with check (auth.uid() = user_id);
create policy "steps: own update" on recipe_steps for update using (auth.uid() = user_id);
create policy "steps: own delete" on recipe_steps for delete using (auth.uid() = user_id);

-- cookbooks: same visibility model as recipes
create policy "cookbooks: visibility"
  on cookbooks for select using (
    user_id = auth.uid() or visibility = 'public' or visibility = 'shared_link'
  );
create policy "cookbooks: own write" on cookbooks for insert with check (auth.uid() = user_id);
create policy "cookbooks: own update" on cookbooks for update using (auth.uid() = user_id);
create policy "cookbooks: own delete" on cookbooks for delete using (auth.uid() = user_id);

-- meal plans + shopping: strictly private
create policy "meal_plans: own all" on meal_plans for all using (auth.uid() = user_id);
create policy "shopping_lists: own all" on shopping_lists for all using (auth.uid() = user_id);
create policy "shopping_items: own all" on shopping_list_items for all using (auth.uid() = user_id);

-- ============================================================
-- HELPERS
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger recipes_updated_at before update on recipes
  for each row execute function update_updated_at();
create trigger profiles_updated_at before update on user_profiles
  for each row execute function update_updated_at();
