export type VisibilityLevel = 'private' | 'shared_link' | 'friends' | 'public';
export type PlanTier = 'free' | 'pro' | 'family';
export type SourceType = 'url' | 'scan' | 'manual' | 'ai' | 'social' | 'cookbook';
export type Course = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'starter' | 'main' | 'side' | 'dessert' | 'snack' | 'drink' | 'bread' | 'other';
export type MealSlot = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'snack' | 'other';

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
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
  followed_id: string;
  status: 'pending' | 'accepted';
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
  visibility: VisibilityLevel;
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
}

export interface MealPlan {
  id: string;
  user_id: string;
  plan_date: string;
  meal_slot: MealSlot;
  recipe_id: string | null;
  servings: number | null;
  notes: string | null;
  created_at: string;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  date_range_start: string | null;
  date_range_end: string | null;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  list_id: string;
  user_id: string;
  ingredient: string;
  quantity: number | null;
  unit: string | null;
  aisle: string | null;
  is_checked: boolean;
  recipe_ids: string[];
  sort_order: number;
}

export interface RecipeWithDetails extends Recipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
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
}
