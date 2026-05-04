/**
 * Point values for user actions in the ChefsBook community knowledge system.
 */

export const POINTS = {
  /** Normal recipe import */
  RECIPE_IMPORT: 10,

  /** Recipe imported to fill a knowledge gap (double points) */
  GAP_CONTRIBUTION: 40,

  /** Cooked a recipe */
  COOKED_IT: 5,

  /** Shared a recipe */
  RECIPE_SHARED: 5,
} as const;

export type PointAction = keyof typeof POINTS;
