export const DIETARY_FLAGS = [
  { key: 'vegan', label: 'Vegan', emoji: '🌱' },
  { key: 'vegetarian', label: 'Vegetarian', emoji: '🥗' },
  { key: 'gluten-free', label: 'Gluten-Free', emoji: '🌾' },
  { key: 'dairy-free', label: 'Dairy-Free', emoji: '🥛' },
  { key: 'nut-free', label: 'Nut-Free', emoji: '🥜' },
  { key: 'halal', label: 'Halal', emoji: '☪️' },
  { key: 'kosher', label: 'Kosher', emoji: '✡️' },
  { key: 'low-carb', label: 'Low-Carb', emoji: '📉' },
  { key: 'keto', label: 'Keto', emoji: '🥑' },
  { key: 'paleo', label: 'Paleo', emoji: '🦴' },
] as const;

export const CUISINE_LIST = [
  'Italian', 'French', 'Japanese', 'Chinese', 'Thai', 'Indian',
  'Mexican', 'Spanish', 'Greek', 'Lebanese', 'American', 'British',
  'Korean', 'Vietnamese', 'Moroccan', 'Turkish', 'Caribbean',
  'Peruvian', 'Ethiopian', 'Other',
] as const;

export const COURSE_LIST = [
  'Breakfast', 'Brunch', 'Starter', 'Soup', 'Salad', 'Main',
  'Side', 'Dessert', 'Snack', 'Drink', 'Bread', 'Sauce', 'Other',
] as const;
