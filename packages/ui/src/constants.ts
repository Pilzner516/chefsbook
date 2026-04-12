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
  'American', 'Brazilian', 'British', 'Caribbean', 'Chinese', 'Ethiopian',
  'Filipino', 'French', 'German', 'Greek', 'Indian', 'Indonesian',
  'Irish', 'Italian', 'Japanese', 'Korean', 'Lebanese', 'Malaysian',
  'Mediterranean', 'Mexican', 'Middle Eastern', 'Moroccan', 'Peruvian',
  'Polish', 'Portuguese', 'Russian', 'Spanish', 'Thai', 'Turkish',
  'Vietnamese', 'Other',
] as const;

export const COURSE_LIST = [
  'Breakfast', 'Brunch', 'Starter', 'Soup', 'Salad', 'Main',
  'Side', 'Dessert', 'Snack', 'Drink', 'Bread', 'Sauce', 'Other',
] as const;
