-- ============================================================
-- CATEGORIES — hierarchical taxonomy for recipe tagging
-- ============================================================

-- Top-level category groups
create table category_groups (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  icon        text,
  sort_order  smallint not null default 0
);

-- Individual categories (parent_id → self-referencing for tree)
create table categories (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid references category_groups(id) on delete cascade not null,
  parent_id   uuid references categories(id) on delete cascade,
  slug        text not null,
  name        text not null,
  sort_order  smallint not null default 0,
  unique (group_id, slug)
);

create index categories_group  on categories (group_id);
create index categories_parent on categories (parent_id);

-- Join table: recipes ↔ categories (many-to-many)
create table recipe_categories (
  recipe_id   uuid references recipes(id) on delete cascade not null,
  category_id uuid references categories(id) on delete cascade not null,
  primary key (recipe_id, category_id)
);

create index recipe_categories_cat on recipe_categories (category_id);

-- RLS: categories are public read, recipe_categories follow recipe ownership
alter table category_groups   enable row level security;
alter table categories        enable row level security;
alter table recipe_categories enable row level security;

create policy "category_groups: public read" on category_groups for select using (true);
create policy "categories: public read"      on categories      for select using (true);
create policy "recipe_categories: read own"  on recipe_categories for select
  using (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()));
create policy "recipe_categories: write own" on recipe_categories for insert
  with check (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()));
create policy "recipe_categories: delete own" on recipe_categories for delete
  using (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- ============================================================
-- SEED DATA — the full taxonomy
-- ============================================================

-- Helper: insert group, return its id
-- We use a DO block to keep things clean with variables.

do $$
declare
  g_ingredient   uuid;
  g_cuisine      uuid;
  g_meal         uuid;
  g_method       uuid;
  g_diet         uuid;
  g_time         uuid;
  g_occasion     uuid;
  g_season       uuid;
  -- subcategory parent IDs
  p uuid;
begin

-- ── Category groups ───────────────────────────────────────────
insert into category_groups (slug, name, icon, sort_order) values
  ('ingredient', 'By ingredient', '🥩', 1),
  ('cuisine',    'By cuisine',    '🌍', 2),
  ('meal',       'By meal type',  '🍽️', 3),
  ('method',     'By technique',  '🔥', 4),
  ('diet',       'Diet & lifestyle', '🥗', 5),
  ('time',       'By time',       '⏱️', 6),
  ('occasion',   'By occasion',   '🎉', 7),
  ('season',     'By season',     '🌿', 8);

select id into g_ingredient from category_groups where slug = 'ingredient';
select id into g_cuisine    from category_groups where slug = 'cuisine';
select id into g_meal       from category_groups where slug = 'meal';
select id into g_method     from category_groups where slug = 'method';
select id into g_diet       from category_groups where slug = 'diet';
select id into g_time       from category_groups where slug = 'time';
select id into g_occasion   from category_groups where slug = 'occasion';
select id into g_season     from category_groups where slug = 'season';

-- ══════════════════════════════════════════════════════════════
-- INGREDIENT
-- ══════════════════════════════════════════════════════════════

-- Meat
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'meat', 'Meat', 1) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'beef',          'Beef', 1),
  (g_ingredient, p, 'lamb',          'Lamb', 2),
  (g_ingredient, p, 'pork',          'Pork', 3),
  (g_ingredient, p, 'veal',          'Veal', 4),
  (g_ingredient, p, 'game-offal',    'Game & offal', 5);

-- Poultry
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'poultry', 'Poultry', 2) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'chicken',       'Chicken', 1),
  (g_ingredient, p, 'duck',          'Duck', 2),
  (g_ingredient, p, 'turkey',        'Turkey', 3),
  (g_ingredient, p, 'quail',         'Quail', 4),
  (g_ingredient, p, 'guinea-fowl',   'Guinea fowl', 5);

-- Fish
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'fish', 'Fish', 3) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'salmon',              'Salmon', 1),
  (g_ingredient, p, 'tuna',                'Tuna', 2),
  (g_ingredient, p, 'cod-haddock',          'Cod & haddock', 3),
  (g_ingredient, p, 'sea-bass',             'Sea bass', 4),
  (g_ingredient, p, 'sole-plaice',          'Sole & plaice', 5),
  (g_ingredient, p, 'sardines-anchovies',   'Sardines & anchovies', 6),
  (g_ingredient, p, 'smoked-fish',          'Smoked fish', 7);

-- Shellfish & seafood
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'shellfish-seafood', 'Shellfish & seafood', 4) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'prawns-shrimp',    'Prawns & shrimp', 1),
  (g_ingredient, p, 'lobster-crab',     'Lobster & crab', 2),
  (g_ingredient, p, 'mussels-clams',    'Mussels & clams', 3),
  (g_ingredient, p, 'squid-octopus',    'Squid & octopus', 4),
  (g_ingredient, p, 'scallops',         'Scallops', 5);

-- Fungi
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'fungi', 'Fungi', 5) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'button-chestnut',   'Button & chestnut', 1),
  (g_ingredient, p, 'porcini',           'Porcini', 2),
  (g_ingredient, p, 'shiitake',          'Shiitake', 3),
  (g_ingredient, p, 'chanterelle',       'Chanterelle', 4),
  (g_ingredient, p, 'truffle',           'Truffle', 5),
  (g_ingredient, p, 'wild-mushrooms',    'Wild mushrooms', 6),
  (g_ingredient, p, 'dried-mushrooms',   'Dried mushrooms', 7);

-- Vegetables
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'vegetables', 'Vegetables', 6) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'tomatoes',      'Tomatoes', 1),
  (g_ingredient, p, 'aubergine',     'Aubergine', 2),
  (g_ingredient, p, 'courgette',     'Courgette', 3),
  (g_ingredient, p, 'peppers',       'Peppers', 4),
  (g_ingredient, p, 'root-veg',      'Root veg', 5),
  (g_ingredient, p, 'brassicas',     'Brassicas', 6),
  (g_ingredient, p, 'alliums',       'Alliums', 7),
  (g_ingredient, p, 'leafy-greens',  'Leafy greens', 8),
  (g_ingredient, p, 'artichokes',    'Artichokes', 9);

-- Fruit & berries
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'fruit-berries', 'Fruit & berries', 7) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'citrus',         'Citrus', 1),
  (g_ingredient, p, 'stone-fruit',    'Stone fruit', 2),
  (g_ingredient, p, 'berries',        'Berries', 3),
  (g_ingredient, p, 'apples-pears',   'Apples & pears', 4),
  (g_ingredient, p, 'tropical',       'Tropical', 5),
  (g_ingredient, p, 'figs-dates',     'Figs & dates', 6),
  (g_ingredient, p, 'pomegranate',    'Pomegranate', 7);

-- Chocolate
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'chocolate', 'Chocolate', 8) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'dark-chocolate',  'Dark chocolate', 1),
  (g_ingredient, p, 'milk-chocolate',  'Milk chocolate', 2),
  (g_ingredient, p, 'white-chocolate', 'White chocolate', 3),
  (g_ingredient, p, 'cacao',           'Cacao', 4),
  (g_ingredient, p, 'cocoa-powder',    'Cocoa powder', 5);

-- Bread & dough
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'bread-dough', 'Bread & dough', 9) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'sourdough',       'Sourdough', 1),
  (g_ingredient, p, 'baguette',        'Baguette', 2),
  (g_ingredient, p, 'focaccia',        'Focaccia', 3),
  (g_ingredient, p, 'brioche',         'Brioche', 4),
  (g_ingredient, p, 'flatbreads',      'Flatbreads', 5),
  (g_ingredient, p, 'enriched-doughs', 'Enriched doughs', 6);

-- Pastry
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'pastry', 'Pastry', 10) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'shortcrust',   'Shortcrust', 1),
  (g_ingredient, p, 'puff-pastry',  'Puff pastry', 2),
  (g_ingredient, p, 'choux',        'Choux', 3),
  (g_ingredient, p, 'filo',         'Filo', 4),
  (g_ingredient, p, 'rough-puff',   'Rough puff', 5),
  (g_ingredient, p, 'sweet-pastry', 'Sweet pastry', 6);

-- Dairy & eggs
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'dairy-eggs', 'Dairy & eggs', 11) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'eggs',             'Eggs', 1),
  (g_ingredient, p, 'butter',           'Butter', 2),
  (g_ingredient, p, 'cream',            'Cream', 3),
  (g_ingredient, p, 'hard-cheese',      'Hard cheese', 4),
  (g_ingredient, p, 'soft-cheese',      'Soft cheese', 5),
  (g_ingredient, p, 'yoghurt-labneh',   'Yoghurt & labneh', 6);

-- Grains & pulses
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'grains-pulses', 'Grains & pulses', 12) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'pasta',      'Pasta', 1),
  (g_ingredient, p, 'rice',       'Rice', 2),
  (g_ingredient, p, 'polenta',    'Polenta', 3),
  (g_ingredient, p, 'lentils',    'Lentils', 4),
  (g_ingredient, p, 'chickpeas',  'Chickpeas', 5),
  (g_ingredient, p, 'beans',      'Beans', 6),
  (g_ingredient, p, 'quinoa',     'Quinoa', 7),
  (g_ingredient, p, 'couscous',   'Couscous', 8);

-- Pantry heroes
insert into categories (group_id, slug, name, sort_order) values (g_ingredient, 'pantry-heroes', 'Pantry heroes', 13) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_ingredient, p, 'tinned-tomatoes', 'Tinned tomatoes', 1),
  (g_ingredient, p, 'olive-oil',       'Olive oil', 2),
  (g_ingredient, p, 'garlic',          'Garlic', 3),
  (g_ingredient, p, 'anchovies',       'Anchovies', 4),
  (g_ingredient, p, 'capers',          'Capers', 5),
  (g_ingredient, p, 'dried-chillies',  'Dried chillies', 6),
  (g_ingredient, p, 'nuts-seeds',      'Nuts & seeds', 7);

-- ══════════════════════════════════════════════════════════════
-- CUISINE
-- ══════════════════════════════════════════════════════════════

-- French regions
insert into categories (group_id, slug, name, sort_order) values (g_cuisine, 'french-regions', 'French regions', 1) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_cuisine, p, 'provencal',        'Provençal', 1),
  (g_cuisine, p, 'lyonnaise',        'Lyonnaise', 2),
  (g_cuisine, p, 'alsatian',         'Alsatian', 3),
  (g_cuisine, p, 'basque-fr',        'Basque (FR)', 4),
  (g_cuisine, p, 'breton',           'Breton', 5),
  (g_cuisine, p, 'burgundian',       'Burgundian', 6),
  (g_cuisine, p, 'nice-cote-dazur',  'Nice & Côte d''Azur', 7),
  (g_cuisine, p, 'normand',          'Normand', 8);

-- Italian regions
insert into categories (group_id, slug, name, sort_order) values (g_cuisine, 'italian-regions', 'Italian regions', 2) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_cuisine, p, 'roman',      'Roman', 1),
  (g_cuisine, p, 'neapolitan', 'Neapolitan', 2),
  (g_cuisine, p, 'sicilian',   'Sicilian', 3),
  (g_cuisine, p, 'venetian',   'Venetian', 4),
  (g_cuisine, p, 'tuscan',     'Tuscan', 5),
  (g_cuisine, p, 'milanese',   'Milanese', 6),
  (g_cuisine, p, 'sardinian',  'Sardinian', 7),
  (g_cuisine, p, 'ligurian',   'Ligurian', 8);

-- Spanish & Portuguese
insert into categories (group_id, slug, name, sort_order) values (g_cuisine, 'spanish-portuguese', 'Spanish & Portuguese', 3) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_cuisine, p, 'catalan',          'Catalan', 1),
  (g_cuisine, p, 'andalusian',       'Andalusian', 2),
  (g_cuisine, p, 'basque-es',        'Basque (ES)', 3),
  (g_cuisine, p, 'galician',         'Galician', 4),
  (g_cuisine, p, 'portuguese',       'Portuguese', 5),
  (g_cuisine, p, 'madeira-azores',   'Madeira & Azores', 6);

-- British & Irish
insert into categories (group_id, slug, name, sort_order) values (g_cuisine, 'british-irish', 'British & Irish', 4) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_cuisine, p, 'english',         'English', 1),
  (g_cuisine, p, 'scottish',        'Scottish', 2),
  (g_cuisine, p, 'welsh',           'Welsh', 3),
  (g_cuisine, p, 'irish',           'Irish', 4),
  (g_cuisine, p, 'modern-british',  'Modern British', 5);

-- Mediterranean
insert into categories (group_id, slug, name, sort_order) values (g_cuisine, 'mediterranean', 'Mediterranean', 5) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_cuisine, p, 'greek',     'Greek', 1),
  (g_cuisine, p, 'turkish',   'Turkish', 2),
  (g_cuisine, p, 'lebanese',  'Lebanese', 3),
  (g_cuisine, p, 'moroccan',  'Moroccan', 4),
  (g_cuisine, p, 'israeli',   'Israeli', 5),
  (g_cuisine, p, 'egyptian',  'Egyptian', 6),
  (g_cuisine, p, 'tunisian',  'Tunisian', 7);

-- Asian
insert into categories (group_id, slug, name, sort_order) values (g_cuisine, 'asian', 'Asian', 6) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_cuisine, p, 'japanese',    'Japanese', 1),
  (g_cuisine, p, 'chinese',     'Chinese', 2),
  (g_cuisine, p, 'thai',        'Thai', 3),
  (g_cuisine, p, 'indian',      'Indian', 4),
  (g_cuisine, p, 'korean',      'Korean', 5),
  (g_cuisine, p, 'vietnamese',  'Vietnamese', 6),
  (g_cuisine, p, 'malaysian',   'Malaysian', 7),
  (g_cuisine, p, 'filipino',    'Filipino', 8),
  (g_cuisine, p, 'sri-lankan',  'Sri Lankan', 9);

-- Middle Eastern
insert into categories (group_id, slug, name, sort_order) values (g_cuisine, 'middle-eastern', 'Middle Eastern', 7) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_cuisine, p, 'persian',    'Persian', 1),
  (g_cuisine, p, 'syrian',     'Syrian', 2),
  (g_cuisine, p, 'jordanian',  'Jordanian', 3),
  (g_cuisine, p, 'yemeni',     'Yemeni', 4),
  (g_cuisine, p, 'gulf',       'Gulf', 5);

-- The Americas
insert into categories (group_id, slug, name, sort_order) values (g_cuisine, 'the-americas', 'The Americas', 8) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_cuisine, p, 'american-south',   'American South', 1),
  (g_cuisine, p, 'tex-mex',          'Tex-Mex', 2),
  (g_cuisine, p, 'mexican',          'Mexican', 3),
  (g_cuisine, p, 'peruvian',         'Peruvian', 4),
  (g_cuisine, p, 'brazilian',        'Brazilian', 5),
  (g_cuisine, p, 'caribbean',        'Caribbean', 6),
  (g_cuisine, p, 'cajun-creole',     'Cajun & Creole', 7);

-- Nordic & Eastern Europe
insert into categories (group_id, slug, name, sort_order) values (g_cuisine, 'nordic-eastern-europe', 'Nordic & Eastern Europe', 9) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_cuisine, p, 'scandinavian', 'Scandinavian', 1),
  (g_cuisine, p, 'german',       'German', 2),
  (g_cuisine, p, 'polish',       'Polish', 3),
  (g_cuisine, p, 'hungarian',    'Hungarian', 4),
  (g_cuisine, p, 'russian',      'Russian', 5);

-- African
insert into categories (group_id, slug, name, sort_order) values (g_cuisine, 'african', 'African', 10) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_cuisine, p, 'west-african',   'West African', 1),
  (g_cuisine, p, 'ethiopian',      'Ethiopian', 2),
  (g_cuisine, p, 'south-african',  'South African', 3),
  (g_cuisine, p, 'north-african',  'North African', 4);

-- ══════════════════════════════════════════════════════════════
-- MEAL TYPE
-- ══════════════════════════════════════════════════════════════

-- Breakfast & brunch
insert into categories (group_id, slug, name, sort_order) values (g_meal, 'breakfast-brunch', 'Breakfast & brunch', 1) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_meal, p, 'breakfast-eggs',       'Eggs', 1),
  (g_meal, p, 'pancakes-waffles',     'Pancakes & waffles', 2),
  (g_meal, p, 'breakfast-pastries',   'Pastries', 3),
  (g_meal, p, 'smoothie-bowls',       'Smoothie bowls', 4),
  (g_meal, p, 'toast',                'Toast', 5),
  (g_meal, p, 'granola',              'Granola', 6);

-- Lunch
insert into categories (group_id, slug, name, sort_order) values (g_meal, 'lunch', 'Lunch', 2) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_meal, p, 'lunch-salads',         'Salads', 1),
  (g_meal, p, 'lunch-soups',          'Soups', 2),
  (g_meal, p, 'sandwiches-wraps',     'Sandwiches & wraps', 3),
  (g_meal, p, 'grain-bowls',          'Grain bowls', 4),
  (g_meal, p, 'light-mains',          'Light mains', 5);

-- Dinner starters
insert into categories (group_id, slug, name, sort_order) values (g_meal, 'dinner-starters', 'Dinner starters', 3) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_meal, p, 'canapes',              'Canapés', 1),
  (g_meal, p, 'starter-salads',       'Salads', 2),
  (g_meal, p, 'starter-soups',        'Soups', 3),
  (g_meal, p, 'pate-terrines',        'Pâté & terrines', 4),
  (g_meal, p, 'tartare-carpaccio',    'Tartare & carpaccio', 5);

-- Dinner mains
insert into categories (group_id, slug, name, sort_order) values (g_meal, 'dinner-mains', 'Dinner mains', 4) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_meal, p, 'dinner-pasta',      'Pasta', 1),
  (g_meal, p, 'risotto',           'Risotto', 2),
  (g_meal, p, 'roasts',            'Roasts', 3),
  (g_meal, p, 'grills',            'Grills', 4),
  (g_meal, p, 'braises-stews',     'Braises & stews', 5),
  (g_meal, p, 'curries',           'Curries', 6),
  (g_meal, p, 'fish-mains',        'Fish mains', 7);

-- Sides & accompaniments
insert into categories (group_id, slug, name, sort_order) values (g_meal, 'sides-accompaniments', 'Sides & accompaniments', 5) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_meal, p, 'side-salads',          'Salads', 1),
  (g_meal, p, 'roasted-veg',          'Roasted veg', 2),
  (g_meal, p, 'potatoes',             'Potatoes', 3),
  (g_meal, p, 'rice-grains-side',     'Rice & grains', 4),
  (g_meal, p, 'sauces-condiments',    'Sauces & condiments', 5);

-- Desserts
insert into categories (group_id, slug, name, sort_order) values (g_meal, 'desserts', 'Desserts', 6) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_meal, p, 'tarts-pies',          'Tarts & pies', 1),
  (g_meal, p, 'cakes',               'Cakes', 2),
  (g_meal, p, 'mousses-creams',      'Mousses & creams', 3),
  (g_meal, p, 'ice-cream',           'Ice cream', 4),
  (g_meal, p, 'biscuits-cookies',    'Biscuits & cookies', 5),
  (g_meal, p, 'souffles',            'Soufflés', 6);

-- Bread & baking (meal context)
insert into categories (group_id, slug, name, sort_order) values (g_meal, 'bread-baking-meal', 'Bread & baking', 7) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_meal, p, 'meal-sourdough',      'Sourdough', 1),
  (g_meal, p, 'enriched-breads',     'Enriched breads', 2),
  (g_meal, p, 'meal-flatbreads',     'Flatbreads', 3),
  (g_meal, p, 'meal-pastry',         'Pastry', 4),
  (g_meal, p, 'meal-biscuits',       'Biscuits', 5);

-- Drinks & cocktails
insert into categories (group_id, slug, name, sort_order) values (g_meal, 'drinks-cocktails', 'Drinks & cocktails', 8) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_meal, p, 'cocktails',    'Cocktails', 1),
  (g_meal, p, 'mocktails',    'Mocktails', 2),
  (g_meal, p, 'wine-pairings','Wine pairings', 3),
  (g_meal, p, 'hot-drinks',   'Hot drinks', 4);

-- Snacks & nibbles
insert into categories (group_id, slug, name, sort_order) values (g_meal, 'snacks-nibbles', 'Snacks & nibbles', 9) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_meal, p, 'dips',            'Dips', 1),
  (g_meal, p, 'crudites',        'Crudités', 2),
  (g_meal, p, 'cheese-boards',   'Cheese boards', 3),
  (g_meal, p, 'charcuterie',     'Charcuterie', 4);

-- ══════════════════════════════════════════════════════════════
-- TECHNIQUE
-- ══════════════════════════════════════════════════════════════

-- Baking & pastry
insert into categories (group_id, slug, name, sort_order) values (g_method, 'baking-pastry', 'Baking & pastry', 1) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_method, p, 'method-short-pastry', 'Short pastry', 1),
  (g_method, p, 'method-puff-pastry',  'Puff pastry', 2),
  (g_method, p, 'method-choux',        'Choux', 3),
  (g_method, p, 'method-bread',        'Bread', 4),
  (g_method, p, 'method-cakes',        'Cakes', 5),
  (g_method, p, 'method-souffles',     'Soufflés', 6);

-- Roasting & grilling
insert into categories (group_id, slug, name, sort_order) values (g_method, 'roasting-grilling', 'Roasting & grilling', 2) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_method, p, 'oven-roasting',    'Oven roasting', 1),
  (g_method, p, 'bbq-charcoal',     'BBQ & charcoal', 2),
  (g_method, p, 'griddle',          'Griddle', 3),
  (g_method, p, 'spit-roasting',    'Spit roasting', 4);

-- Braising & slow cooking
insert into categories (group_id, slug, name, sort_order) values (g_method, 'braising-slow', 'Braising & slow cooking', 3) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_method, p, 'braises',       'Braises', 1),
  (g_method, p, 'slow-cooker',   'Slow cooker', 2),
  (g_method, p, 'daube',         'Daube', 3),
  (g_method, p, 'tagine',        'Tagine', 4),
  (g_method, p, 'pot-roast',     'Pot roast', 5);

-- Frying
insert into categories (group_id, slug, name, sort_order) values (g_method, 'frying', 'Frying', 4) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_method, p, 'pan-frying',      'Pan frying', 1),
  (g_method, p, 'deep-frying',     'Deep frying', 2),
  (g_method, p, 'sauteeing',       'Sautéeing', 3),
  (g_method, p, 'stir-frying',     'Stir frying', 4),
  (g_method, p, 'shallow-frying',  'Shallow frying', 5);

-- Steaming & poaching
insert into categories (group_id, slug, name, sort_order) values (g_method, 'steaming-poaching', 'Steaming & poaching', 5) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_method, p, 'en-papillote',    'En papillote', 1),
  (g_method, p, 'court-bouillon',  'Court-bouillon', 2),
  (g_method, p, 'bain-marie',      'Bain marie', 3),
  (g_method, p, 'sous-vide',       'Sous vide', 4);

-- Raw & no-cook
insert into categories (group_id, slug, name, sort_order) values (g_method, 'raw-no-cook', 'Raw & no-cook', 6) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_method, p, 'ceviche',       'Ceviche', 1),
  (g_method, p, 'carpaccio',     'Carpaccio', 2),
  (g_method, p, 'tartare',       'Tartare', 3),
  (g_method, p, 'cold-soups',    'Cold soups', 4),
  (g_method, p, 'raw-salads',    'Raw salads', 5);

-- Fermenting & preserving
insert into categories (group_id, slug, name, sort_order) values (g_method, 'fermenting-preserving', 'Fermenting & preserving', 7) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_method, p, 'pickling',            'Pickling', 1),
  (g_method, p, 'lacto-fermentation',  'Lacto-fermentation', 2),
  (g_method, p, 'confit',              'Confit', 3),
  (g_method, p, 'jam-preserves',       'Jam & preserves', 4),
  (g_method, p, 'curing',              'Curing', 5);

-- Equipment-led
insert into categories (group_id, slug, name, sort_order) values (g_method, 'equipment-led', 'Equipment-led', 8) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_method, p, 'air-fryer',    'Air fryer', 1),
  (g_method, p, 'instant-pot',  'Instant Pot', 2),
  (g_method, p, 'cast-iron',    'Cast iron', 3),
  (g_method, p, 'wok',          'Wok', 4),
  (g_method, p, 'plancha',      'Plancha', 5),
  (g_method, p, 'thermomix',    'Thermomix', 6);

-- ══════════════════════════════════════════════════════════════
-- DIET & LIFESTYLE
-- ══════════════════════════════════════════════════════════════

-- Plant-based
insert into categories (group_id, slug, name, sort_order) values (g_diet, 'plant-based', 'Plant-based', 1) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_diet, p, 'vegan',        'Vegan', 1),
  (g_diet, p, 'vegetarian',   'Vegetarian', 2),
  (g_diet, p, 'flexitarian',  'Flexitarian', 3),
  (g_diet, p, 'raw-food',     'Raw food', 4);

-- Allergen-free
insert into categories (group_id, slug, name, sort_order) values (g_diet, 'allergen-free', 'Allergen-free', 2) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_diet, p, 'gluten-free',  'Gluten-free', 1),
  (g_diet, p, 'dairy-free',   'Dairy-free', 2),
  (g_diet, p, 'nut-free',     'Nut-free', 3),
  (g_diet, p, 'egg-free',     'Egg-free', 4),
  (g_diet, p, 'soy-free',     'Soy-free', 5);

-- Health-focused
insert into categories (group_id, slug, name, sort_order) values (g_diet, 'health-focused', 'Health-focused', 3) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_diet, p, 'high-protein',  'High protein', 1),
  (g_diet, p, 'low-carb',      'Low carb', 2),
  (g_diet, p, 'low-calorie',   'Low calorie', 3),
  (g_diet, p, 'high-fibre',    'High fibre', 4),
  (g_diet, p, 'heart-healthy', 'Heart healthy', 5);

-- Cultural & religious
insert into categories (group_id, slug, name, sort_order) values (g_diet, 'cultural-religious', 'Cultural & religious', 4) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_diet, p, 'halal',               'Halal', 1),
  (g_diet, p, 'kosher',              'Kosher', 2),
  (g_diet, p, 'hindu-vegetarian',    'Hindu vegetarian', 3);

-- Lifestyle diets
insert into categories (group_id, slug, name, sort_order) values (g_diet, 'lifestyle-diets', 'Lifestyle diets', 5) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_diet, p, 'keto',           'Keto', 1),
  (g_diet, p, 'paleo',          'Paleo', 2),
  (g_diet, p, 'mediterranean-diet', 'Mediterranean', 3),
  (g_diet, p, 'whole30',        'Whole30', 4),
  (g_diet, p, 'dash',           'DASH', 5);

-- ══════════════════════════════════════════════════════════════
-- TIME
-- ══════════════════════════════════════════════════════════════

-- Express
insert into categories (group_id, slug, name, sort_order) values (g_time, 'express', 'Express', 1) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_time, p, 'under-15',    'Under 15 minutes', 1),
  (g_time, p, '15-30',       '15-30 minutes', 2);

-- Medium
insert into categories (group_id, slug, name, sort_order) values (g_time, 'medium-time', 'Medium', 2) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_time, p, '30-45',       '30-45 minutes', 1),
  (g_time, p, '45-60',       '45 min to 1 hour', 2);

-- Worth the wait
insert into categories (group_id, slug, name, sort_order) values (g_time, 'worth-the-wait', 'Worth the wait', 3) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_time, p, '1-2-hours',   '1-2 hours', 1),
  (g_time, p, '2-4-hours',   '2-4 hours', 2),
  (g_time, p, '4-plus-hours','4+ hours', 3);

-- Hands-off
insert into categories (group_id, slug, name, sort_order) values (g_time, 'hands-off', 'Hands-off', 4) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_time, p, 'time-slow-cooker', 'Slow cooker', 1),
  (g_time, p, 'overnight',        'Overnight', 2),
  (g_time, p, 'make-ahead',       'Make ahead', 3),
  (g_time, p, 'freezer-friendly', 'Freezer-friendly', 4);

-- ══════════════════════════════════════════════════════════════
-- OCCASION
-- ══════════════════════════════════════════════════════════════

-- Dinner parties
insert into categories (group_id, slug, name, sort_order) values (g_occasion, 'dinner-parties', 'Dinner parties', 1) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_occasion, p, 'elegant-starter',      'Elegant starter', 1),
  (g_occasion, p, 'impressive-main',      'Impressive main', 2),
  (g_occasion, p, 'show-stopping-dessert','Show-stopping dessert', 3),
  (g_occasion, p, 'party-canapes',        'Canapés', 4);

-- Family meals
insert into categories (group_id, slug, name, sort_order) values (g_occasion, 'family-meals', 'Family meals', 2) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_occasion, p, 'kids-will-eat-it',   'Kids will eat it', 1),
  (g_occasion, p, 'sunday-roast',       'Sunday roast', 2),
  (g_occasion, p, 'quick-weeknight',    'Quick weeknight', 3),
  (g_occasion, p, 'lunchboxes',         'Lunchboxes', 4),
  (g_occasion, p, 'picnics',            'Picnics', 5);

-- Celebrations
insert into categories (group_id, slug, name, sort_order) values (g_occasion, 'celebrations', 'Celebrations', 3) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_occasion, p, 'christmas',       'Christmas', 1),
  (g_occasion, p, 'easter',          'Easter', 2),
  (g_occasion, p, 'thanksgiving',    'Thanksgiving', 3),
  (g_occasion, p, 'birthday',        'Birthday', 4),
  (g_occasion, p, 'valentines-day',  'Valentine''s Day', 5),
  (g_occasion, p, 'new-year',        'New Year', 6);

-- Everyday cooking
insert into categories (group_id, slug, name, sort_order) values (g_occasion, 'everyday-cooking', 'Everyday cooking', 4) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_occasion, p, 'date-night',            'Date night', 1),
  (g_occasion, p, 'dinner-for-one',        'Dinner for one', 2),
  (g_occasion, p, 'leftovers-reinvented',  'Leftovers reinvented', 3),
  (g_occasion, p, 'fridge-clear-out',      'Fridge clear-out', 4);

-- Al fresco
insert into categories (group_id, slug, name, sort_order) values (g_occasion, 'al-fresco', 'Al fresco', 5) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_occasion, p, 'bbq',             'BBQ', 1),
  (g_occasion, p, 'cold-platters',   'Cold platters', 2),
  (g_occasion, p, 'al-fresco-drinks','Drinks & cocktails', 3);

-- ══════════════════════════════════════════════════════════════
-- SEASON
-- ══════════════════════════════════════════════════════════════

-- Spring
insert into categories (group_id, slug, name, sort_order) values (g_season, 'spring', 'Spring', 1) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_season, p, 'asparagus',        'Asparagus', 1),
  (g_season, p, 'peas-broad-beans', 'Peas & broad beans', 2),
  (g_season, p, 'spring-lamb',      'Spring lamb', 3),
  (g_season, p, 'rhubarb',          'Rhubarb', 4),
  (g_season, p, 'wild-garlic',      'Wild garlic', 5),
  (g_season, p, 'jersey-royals',    'Jersey royals', 6);

-- Summer
insert into categories (group_id, slug, name, sort_order) values (g_season, 'summer', 'Summer', 2) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_season, p, 'summer-tomatoes',       'Tomatoes', 1),
  (g_season, p, 'courgettes-squash',     'Courgettes & squash', 2),
  (g_season, p, 'summer-berries',        'Berries', 3),
  (g_season, p, 'summer-stone-fruit',    'Stone fruit', 4),
  (g_season, p, 'corn',                  'Corn', 5),
  (g_season, p, 'summer-cold-soups',     'Cold soups', 6);

-- Autumn
insert into categories (group_id, slug, name, sort_order) values (g_season, 'autumn', 'Autumn', 3) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_season, p, 'autumn-mushrooms',      'Mushrooms', 1),
  (g_season, p, 'pumpkin-squash',        'Pumpkin & squash', 2),
  (g_season, p, 'autumn-root-veg',       'Root veg', 3),
  (g_season, p, 'autumn-apples-pears',   'Apples & pears', 4),
  (g_season, p, 'autumn-game',           'Game', 5),
  (g_season, p, 'chestnuts',             'Chestnuts', 6);

-- Winter
insert into categories (group_id, slug, name, sort_order) values (g_season, 'winter', 'Winter', 4) returning id into p;
insert into categories (group_id, parent_id, slug, name, sort_order) values
  (g_season, p, 'winter-citrus',         'Citrus', 1),
  (g_season, p, 'brussels-sprouts',      'Brussels sprouts', 2),
  (g_season, p, 'celeriac',              'Celeriac', 3),
  (g_season, p, 'blood-oranges',         'Blood oranges', 4),
  (g_season, p, 'hearty-braises',        'Hearty braises', 5),
  (g_season, p, 'festive',              'Festive', 6);

end;
$$;
