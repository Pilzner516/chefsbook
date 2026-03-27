// Stub — to be wired up with expo-in-app-purchases or RevenueCat when iOS billing is needed
// The plan_tier field in user_profiles is already present and ready to be written by IAP webhook

export const IAP_PRODUCT_IDS = {
  pro_monthly: 'com.chefsbook.app.pro.monthly',
  pro_yearly: 'com.chefsbook.app.pro.yearly',
  family_monthly: 'com.chefsbook.app.family.monthly',
  family_yearly: 'com.chefsbook.app.family.yearly',
} as const;

// When iOS IAP is implemented, write to user_profiles.apple_original_transaction_id
// and update plan_tier via a Supabase edge function that validates the receipt with Apple
export async function validateAppleReceipt(_receiptData: string): Promise<void> {
  throw new Error('Apple IAP not yet implemented — use Stripe on web/Android');
}
