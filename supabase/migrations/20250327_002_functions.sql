-- ============================================================
-- search_recipes — full-text search via pg_trgm on title + ingredients
-- ============================================================
create or replace function search_recipes(
  p_user_id    uuid,
  p_query      text    default null,
  p_cuisine    text    default null,
  p_course     text    default null,
  p_max_time   integer default null,
  p_limit      integer default 50,
  p_offset     integer default 0
)
returns table (
  id            uuid,
  user_id       uuid,
  title         text,
  description   text,
  image_url     text,
  prep_minutes  integer,
  cook_minutes  integer,
  total_minutes integer,
  servings      numeric(6,2),
  cuisine       text,
  course        text,
  rating        smallint,
  is_favourite  boolean,
  tags          text[],
  visibility    visibility_level,
  created_at    timestamptz,
  updated_at    timestamptz,
  relevance     real
)
language sql stable security invoker
as $$
  select
    r.id, r.user_id, r.title, r.description, r.image_url,
    r.prep_minutes, r.cook_minutes, r.total_minutes,
    r.servings, r.cuisine, r.course, r.rating, r.is_favourite,
    r.tags, r.visibility, r.created_at, r.updated_at,
    case
      when p_query is not null then
        greatest(
          similarity(r.title, p_query),
          coalesce((
            select max(similarity(ri.ingredient, p_query))
            from recipe_ingredients ri
            where ri.recipe_id = r.id
          ), 0)
        )
      else 1.0
    end as relevance
  from recipes r
  where r.user_id = p_user_id
    and (p_query is null or (
      r.title % p_query
      or exists (
        select 1 from recipe_ingredients ri
        where ri.recipe_id = r.id and ri.ingredient % p_query
      )
    ))
    and (p_cuisine is null or r.cuisine = p_cuisine)
    and (p_course  is null or r.course  = p_course)
    and (p_max_time is null or r.total_minutes <= p_max_time)
  order by relevance desc, r.updated_at desc
  limit p_limit
  offset p_offset;
$$;


-- ============================================================
-- get_meal_plan_week — 7 days of meal plans with recipe data
-- ============================================================
create or replace function get_meal_plan_week(
  p_user_id         uuid,
  p_week_start_date date
)
returns table (
  plan_date      date,
  meal_plan_id   uuid,
  meal_slot      text,
  servings       numeric(6,2),
  notes          text,
  recipe_id      uuid,
  recipe_title   text,
  recipe_image   text,
  recipe_cuisine text,
  recipe_course  text,
  prep_minutes   integer,
  cook_minutes   integer,
  total_minutes  integer
)
language sql stable security invoker
as $$
  select
    d.day::date                   as plan_date,
    mp.id                         as meal_plan_id,
    mp.meal_slot,
    mp.servings,
    mp.notes,
    r.id                          as recipe_id,
    r.title                       as recipe_title,
    r.image_url                   as recipe_image,
    r.cuisine                     as recipe_cuisine,
    r.course                      as recipe_course,
    r.prep_minutes,
    r.cook_minutes,
    r.total_minutes
  from generate_series(
    p_week_start_date,
    p_week_start_date + interval '6 days',
    interval '1 day'
  ) as d(day)
  left join meal_plans mp
    on mp.user_id  = p_user_id
   and mp.plan_date = d.day::date
  left join recipes r
    on r.id = mp.recipe_id
  order by d.day, mp.meal_slot;
$$;


-- ============================================================
-- generate_shopping_list — aggregate ingredients from meal plans
-- ============================================================
create or replace function generate_shopping_list(
  p_user_id       uuid,
  p_meal_plan_ids uuid[]
)
returns table (
  ingredient   text,
  total_qty    numeric,
  unit         text,
  aisle        text,
  recipe_ids   uuid[],
  recipe_names text[]
)
language sql stable security invoker
as $$
  with plan_recipes as (
    select mp.id as meal_plan_id, mp.recipe_id, r.title as recipe_title
    from meal_plans mp
    join recipes r on r.id = mp.recipe_id
    where mp.id = any(p_meal_plan_ids)
      and mp.user_id = p_user_id
      and mp.recipe_id is not null
  ),
  raw_ingredients as (
    select
      lower(trim(ri.ingredient))           as ingredient,
      ri.quantity,
      lower(trim(coalesce(ri.unit, '')))   as unit,
      pr.recipe_id,
      pr.recipe_title
    from plan_recipes pr
    join recipe_ingredients ri on ri.recipe_id = pr.recipe_id
  )
  select
    ri.ingredient,
    sum(ri.quantity)                                   as total_qty,
    case when ri.unit = '' then null else ri.unit end  as unit,
    coalesce(
      (select sli.aisle from shopping_list_items sli
       where lower(trim(sli.ingredient)) = ri.ingredient
         and sli.user_id = p_user_id
         and sli.aisle is not null
       limit 1),
      case
        when ri.ingredient ~* '(milk|cream|butter|cheese|yogurt|egg)' then 'Dairy & Eggs'
        when ri.ingredient ~* '(chicken|beef|pork|lamb|fish|salmon|shrimp|turkey|sausage)' then 'Meat & Seafood'
        when ri.ingredient ~* '(apple|banana|lemon|lime|orange|berry|berries|avocado|tomato)' then 'Produce'
        when ri.ingredient ~* '(lettuce|spinach|kale|onion|garlic|pepper|carrot|celery|potato|broccoli|mushroom|zucchini|cucumber)' then 'Produce'
        when ri.ingredient ~* '(flour|sugar|baking|vanilla|cocoa|yeast)' then 'Baking'
        when ri.ingredient ~* '(rice|pasta|noodle|bread|tortilla|oat)' then 'Grains & Bread'
        when ri.ingredient ~* '(salt|pepper|cumin|paprika|cinnamon|oregano|basil|thyme|rosemary|chili|curry)' then 'Spices & Seasonings'
        when ri.ingredient ~* '(oil|vinegar|soy sauce|sauce|mustard|ketchup|mayo)' then 'Condiments & Oils'
        when ri.ingredient ~* '(can |canned|beans|lentil|chickpea|broth|stock|tomato paste|tomato sauce)' then 'Canned & Dry Goods'
        when ri.ingredient ~* '(wine|beer|vodka|rum)' then 'Alcohol'
        when ri.ingredient ~* '(water|juice|soda|coffee|tea)' then 'Beverages'
        else 'Other'
      end
    ) as aisle,
    array_agg(distinct ri.recipe_id)                  as recipe_ids,
    array_agg(distinct ri.recipe_title)               as recipe_names
  from raw_ingredients ri
  group by ri.ingredient, ri.unit
  order by aisle, ri.ingredient;
$$;


-- ============================================================
-- clone_recipe — copy a public/shared recipe into user's collection
-- ============================================================
create or replace function clone_recipe(
  p_source_recipe_id uuid,
  p_target_user_id   uuid
)
returns uuid
language plpgsql security invoker
as $$
declare
  v_new_id uuid;
  v_source recipes%rowtype;
begin
  -- Fetch source recipe — must be public or shared_link (or owned)
  select * into v_source
  from recipes
  where id = p_source_recipe_id
    and (visibility in ('public', 'shared_link') or user_id = p_target_user_id);

  if not found then
    raise exception 'Recipe not found or not accessible';
  end if;

  -- Insert cloned recipe
  insert into recipes (
    user_id, title, description, source_url, source_type,
    image_url, prep_minutes, cook_minutes, servings,
    cuisine, course, tags, notes,
    calories, protein_g, carbs_g, fat_g,
    visibility
  ) values (
    p_target_user_id,
    v_source.title,
    v_source.description,
    v_source.source_url,
    'social',
    v_source.image_url,
    v_source.prep_minutes,
    v_source.cook_minutes,
    v_source.servings,
    v_source.cuisine,
    v_source.course,
    v_source.tags,
    v_source.notes,
    v_source.calories,
    v_source.protein_g,
    v_source.carbs_g,
    v_source.fat_g,
    'private'
  )
  returning id into v_new_id;

  -- Copy ingredients
  insert into recipe_ingredients (
    recipe_id, user_id, sort_order, quantity, unit,
    ingredient, preparation, optional, group_label
  )
  select
    v_new_id, p_target_user_id, sort_order, quantity, unit,
    ingredient, preparation, optional, group_label
  from recipe_ingredients
  where recipe_id = p_source_recipe_id;

  -- Copy steps
  insert into recipe_steps (
    recipe_id, user_id, step_number, instruction,
    timer_minutes, group_label
  )
  select
    v_new_id, p_target_user_id, step_number, instruction,
    timer_minutes, group_label
  from recipe_steps
  where recipe_id = p_source_recipe_id;

  return v_new_id;
end;
$$;


-- ============================================================
-- get_public_feed — public recipes by recency + rating
-- ============================================================
create or replace function get_public_feed(
  p_limit          integer default 20,
  p_offset         integer default 0,
  p_cuisine_filter text    default null
)
returns table (
  id            uuid,
  user_id       uuid,
  title         text,
  description   text,
  image_url     text,
  prep_minutes  integer,
  cook_minutes  integer,
  total_minutes integer,
  servings      numeric(6,2),
  cuisine       text,
  course        text,
  rating        smallint,
  tags          text[],
  created_at    timestamptz,
  author_name   text,
  author_avatar text
)
language sql stable security invoker
as $$
  select
    r.id, r.user_id, r.title, r.description, r.image_url,
    r.prep_minutes, r.cook_minutes, r.total_minutes,
    r.servings, r.cuisine, r.course, r.rating,
    r.tags, r.created_at,
    coalesce(up.display_name, up.username, 'Chef') as author_name,
    up.avatar_url as author_avatar
  from recipes r
  join user_profiles up on up.id = r.user_id
  where r.visibility = 'public'
    and (p_cuisine_filter is null or r.cuisine = p_cuisine_filter)
  order by
    coalesce(r.rating, 0) desc,
    r.created_at desc
  limit p_limit
  offset p_offset;
$$;
