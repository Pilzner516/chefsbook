export type VisibilityLevel = 'private' | 'shared_link' | 'friends' | 'public';
export type PlanTier = 'free' | 'chef' | 'family' | 'pro';
export type SourceType = 'url' | 'scan' | 'manual' | 'ai' | 'social' | 'cookbook' | 'youtube';
export type Course = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'starter' | 'main' | 'side' | 'dessert' | 'snack' | 'drink' | 'bread' | 'other';
export type MealSlot = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'snack' | 'other';

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_searchable: boolean;
  is_suspended: boolean;
  comments_suspended: boolean;
  recipes_frozen: boolean;
  recipes_frozen_reason: string | null;
  unread_messages_count: number;
  follower_count: number;
  following_count: number;
  recipe_count: number;
  plan_tier: PlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  apple_original_transaction_id: string | null;
  default_visibility: VisibilityLevel;
  country_code: string;
  created_at: string;
  updated_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'new_follower' | 'new_comment' | 'recipe_liked' | 'comment_flagged';
  actor_id: string | null;
  recipe_id: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Cookbook {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  publisher: string | null;
  year: number | null;
  cover_url: string | null;
  notes: string | null;
  rating: number | null;
  location: string | null;
  google_books_id: string | null;
  description: string | null;
  total_recipes: number | null;
  toc_fetched: boolean;
  toc_fetched_at: string | null;
  visibility: VisibilityLevel;
  created_at: string;
}

export interface CookbookRecipe {
  id: string;
  cookbook_id: string;
  title: string;
  page_number: number | null;
  chapter: string | null;
  description: string | null;
  matched_recipe_id: string | null;
  ai_generated: boolean;
  created_at: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  source_url: string | null;
  source_type: SourceType;
  cookbook_id: string | null;
  page_number: number | null;
  image_url: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  servings: number;
  cuisine: string | null;
  course: Course | null;
  rating: number | null;
  is_favourite: boolean;
  tags: string[];
  notes: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  visibility: VisibilityLevel;
  share_token: string;
  youtube_video_id: string | null;
  channel_name: string | null;
  video_only: boolean;
  dietary_flags: string[];
  attributed_to_user_id: string | null;
  attributed_to_username: string | null;
  original_submitter_id: string | null;
  original_submitter_username: string | null;
  shared_by_id: string | null;
  shared_by_username: string | null;
  import_status?: 'complete' | 'partial';
  missing_sections?: string[];
  aichef_assisted?: boolean;
  source_author?: string | null;
  save_count: number;
  like_count: number;
  comment_count: number;
  comments_enabled: boolean;
  moderation_status: 'clean' | 'flagged_mild' | 'flagged_serious' | 'approved' | 'rejected';
  moderation_flag_reason: string | null;
  moderation_flagged_at: string | null;
  moderation_reviewed_by: string | null;
  moderation_reviewed_at: string | null;
  parent_recipe_id: string | null;
  version_number: number;
  version_label: string | null;
  is_parent: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  user_id: string;
  sort_order: number;
  quantity: number | null;
  unit: string | null;
  ingredient: string;
  preparation: string | null;
  optional: boolean;
  group_label: string | null;
}

export interface RecipeStep {
  id: string;
  recipe_id: string;
  user_id: string;
  step_number: number;
  instruction: string;
  timer_minutes: number | null;
  group_label: string | null;
  timestamp_seconds: number | null;
}

export interface MealPlan {
  id: string;
  user_id: string;
  plan_date: string;
  meal_slot: MealSlot;
  recipe_id: string | null;
  servings: number | null;
  notes: string | null;
  synced_to_list_id?: string | null;
  synced_at?: string | null;
  synced_ingredients_hash?: string | null;
  created_at: string;
}

export type StoreCategory = 'produce' | 'meat_seafood' | 'dairy_eggs' | 'bakery' | 'baking' | 'spices' | 'canned' | 'condiments' | 'pasta_grains' | 'frozen' | 'beverages' | 'household' | 'other';

export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  store_name: string | null;
  store_id: string | null;
  color: string | null;
  pinned: boolean;
  pinned_at: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: string;
  list_id: string;
  user_id: string;
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  aisle: string | null;
  category: StoreCategory | null;
  quantity_needed: string | null;
  purchase_unit: string | null;
  unit_display: string | null;
  is_checked: boolean;
  checked_at: string | null;
  recipe_ids: string[];
  recipe_name: string | null;
  manually_added: boolean;
  item_image_url: string | null;
  sort_order: number;
}

export interface ShoppingListShare {
  id: string;
  list_id: string;
  shared_with_user_id: string;
  can_edit: boolean;
  created_at: string;
}

export interface RecipeUserPhoto {
  id: string;
  recipe_id: string;
  user_id: string;
  storage_path: string;
  url: string;
  caption: string | null;
  is_primary: boolean;
  sort_order: number;
  is_ai_generated?: boolean;
  regen_count?: number;
  created_at: string;
}

export interface RecipeWithDetails extends Recipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export type TechniqueSourceType = 'web' | 'youtube' | 'manual' | 'extension';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface TechniqueStep {
  step_number: number;
  instruction: string;
  tip: string | null;
  common_mistake: string | null;
}

export interface Technique {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  process_steps: TechniqueStep[];
  tips: string[];
  common_mistakes: string[];
  tools_and_equipment: string[];
  difficulty: Difficulty | null;
  source_url: string | null;
  source_type: TechniqueSourceType | null;
  youtube_video_id: string | null;
  image_url: string | null;
  related_recipe_ids: string[];
  tags: string[];
  visibility: VisibilityLevel;
  share_token: string;
  created_at: string;
  updated_at: string;
}

export interface ScannedTechnique {
  title: string;
  description: string | null;
  process_steps: TechniqueStep[];
  tips: string[];
  common_mistakes: string[];
  tools_and_equipment: string[];
  difficulty: Difficulty | null;
}

export interface ScannedRecipe {
  title: string;
  description: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  cuisine: string | null;
  course: Course | null;
  ingredients: {
    quantity: number | null;
    unit: string | null;
    ingredient: string;
    preparation: string | null;
    optional: boolean;
    group_label: string | null;
  }[];
  steps: {
    step_number: number;
    instruction: string;
    timer_minutes: number | null;
    group_label: string | null;
  }[];
  notes: string | null;
  source_type: SourceType;
  has_food_photo?: boolean;
  food_photo_region?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'full-page' | null;
  image_url?: string | null;
  tags?: string[];
}
