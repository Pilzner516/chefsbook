export interface BubbleDef {
  id: string;
  target: string; // CSS selector
  title: string;
  body: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface PageBubbles {
  pageId: string;
  bubbles: BubbleDef[];
  nextPageLabel?: string;
  nextPageHref?: string;
}

export const ONBOARDING_PAGES: PageBubbles[] = [
  {
    pageId: 'dashboard',
    bubbles: [
      { id: 'welcome', target: '[data-onboard="logo"]', title: 'Welcome to ChefsBook', body: 'Your recipe library, meal planner, and shopping hub in one place.', position: 'bottom' },
      { id: 'recipes', target: '[data-onboard="recipes"]', title: 'Your Recipes', body: 'All your recipes live here. Import from any website, scan a photo, or speak a recipe aloud.', position: 'right' },
      { id: 'search', target: '[data-onboard="search"]', title: 'Search', body: 'Search by cuisine, ingredient, or tag. Discover public recipes from the community.', position: 'right' },
      { id: 'shopping', target: '[data-onboard="shopping"]', title: 'Shopping', body: 'Smart shopping lists grouped by store. Add recipes and we calculate what you need.', position: 'right' },
      { id: 'plan', target: '[data-onboard="plan"]', title: 'Meal Plan', body: 'Plan your week visually. Add recipes to any day and generate your shopping list instantly.', position: 'right' },
    ],
    nextPageLabel: 'Next: Recipe Detail',
    nextPageHref: undefined, // navigated manually
  },
  {
    pageId: 'recipe',
    bubbles: [
      { id: 'like-share', target: '[data-onboard="like"]', title: 'Like & Share', body: 'Like recipes to save them. Share via link or download as a PDF (Pro).', position: 'bottom' },
      { id: 'add-plan', target: '[data-onboard="meal-plan"]', title: 'Add to Plan', body: 'Add this recipe to any day in your meal plan with one tap.', position: 'bottom' },
      { id: 'add-shop', target: '[data-onboard="shopping-list"]', title: 'Add to Shopping', body: 'Add all ingredients to your shopping list. We handle unit conversion automatically.', position: 'bottom' },
    ],
  },
  {
    pageId: 'scan',
    bubbles: [
      { id: 'scan-photo', target: '[data-onboard="scan"]', title: 'Scan a Recipe', body: 'Point your camera at any recipe — printed, handwritten, or from a cookbook page.', position: 'bottom' },
      { id: 'speak', target: '[data-onboard="speak"]', title: 'Speak a Recipe', body: 'Dictate a recipe aloud and AI formats it instantly into your collection.', position: 'bottom' },
      { id: 'import-url', target: '[data-onboard="url"]', title: 'Import URL', body: 'Paste any recipe website URL and we extract the recipe automatically.', position: 'bottom' },
    ],
  },
  {
    pageId: 'shop',
    bubbles: [
      { id: 'store-groups', target: '[data-onboard="store-group"]', title: 'Store Groups', body: 'Lists are grouped by store. Tap any list to see your items by department.', position: 'bottom' },
      { id: 'new-list', target: '[data-onboard="new-list"]', title: 'New List', body: 'Create a list for any store. We remember your stores and show their logos.', position: 'left' },
    ],
  },
  {
    pageId: 'plan',
    bubbles: [
      { id: 'week-nav', target: '[data-onboard="week-nav"]', title: 'Week Navigation', body: 'Navigate between weeks. Your meal plan saves automatically.', position: 'bottom' },
      { id: 'add-meal', target: '[data-onboard="add-meal"]', title: 'Add a Meal', body: 'Tap any day to add a recipe. Green slots are empty, red are filled.', position: 'bottom' },
    ],
  },
  {
    pageId: 'settings',
    bubbles: [
      { id: 'plan-section', target: '[data-onboard="plan-tier"]', title: 'Your Plan', body: 'View and upgrade your plan here. Use a promo code at signup for special access.', position: 'bottom' },
      { id: 'help-toggle', target: '[data-onboard="help-toggle"]', title: 'Help Bubbles', body: 'This is where you can turn help tips on or off at any time.', position: 'bottom' },
    ],
  },
];
