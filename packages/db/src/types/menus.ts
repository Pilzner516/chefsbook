export type MenuCourse =
  | 'starter'
  | 'soup'
  | 'salad'
  | 'main'
  | 'side'
  | 'cheese'
  | 'dessert'
  | 'drink'
  | 'other';

export const COURSE_ORDER: MenuCourse[] = [
  'starter', 'soup', 'salad', 'main', 'side', 'cheese', 'dessert', 'drink', 'other',
];

export const COURSE_LABELS: Record<MenuCourse, string> = {
  starter:  'Starter',
  soup:     'Soup',
  salad:    'Salad',
  main:     'Main',
  side:     'Side',
  cheese:   'Cheese',
  dessert:  'Dessert',
  drink:    'Drink',
  other:    'Other',
};

export interface Menu {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  occasion: string | null;
  notes: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  menu_id: string;
  recipe_id: string;
  course: MenuCourse;
  sort_order: number;
  servings_override: number | null;
  notes: string | null;
  created_at: string;
}

export interface MenuWithItems extends Menu {
  menu_items: (MenuItem & {
    recipe: {
      id: string;
      title: string;
      description: string | null;
      prep_time: number | null;
      cook_time: number | null;
      servings: number | null;
      image_url: string | null;
    };
  })[];
}
