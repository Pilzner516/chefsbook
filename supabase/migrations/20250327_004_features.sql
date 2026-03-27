-- ============================================================
-- COOKING NOTES — journal entries per recipe cook
-- ============================================================
create table cooking_notes (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade not null,
  user_id   uuid references auth.users(id) on delete cascade not null,
  note      text not null,
  cooked_at timestamptz not null default now()
);

create index cooking_notes_recipe on cooking_notes (recipe_id);
create index cooking_notes_user   on cooking_notes (user_id, cooked_at desc);

alter table cooking_notes enable row level security;

create policy "cooking_notes: own all"
  on cooking_notes for all using (auth.uid() = user_id);

-- ============================================================
-- MENU TEMPLATES — reusable meal plan templates
-- ============================================================
create table menu_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  recipe_ids uuid[] default '{}',
  created_at timestamptz default now()
);

create index menu_templates_user on menu_templates (user_id);

alter table menu_templates enable row level security;

create policy "menu_templates: own all"
  on menu_templates for all using (auth.uid() = user_id);

-- ============================================================
-- ADD sub_recipe_id to recipe_ingredients
-- ============================================================
alter table recipe_ingredients
  add column sub_recipe_id uuid references recipes(id) on delete set null;
