import { createClient } from '@supabase/supabase-js';
import { suggestPurchaseUnits } from '@chefsbook/ai';
import { addItemsWithPipeline } from '@chefsbook/db';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );
}

export async function POST(req: Request) {
  const db = getServiceClient();

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: { user }, error: authError } = await db.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { listId, items } = await req.json() as {
    listId: string;
    items: { ingredient: string; quantity?: number | null; unit?: string | null; quantity_needed?: string | null; recipe_id?: string; recipe_name?: string }[];
  };

  if (!listId || !items?.length) {
    return Response.json({ error: 'listId and items required' }, { status: 400 });
  }

  try {
    // Get AI suggestions for all items (batched)
    let suggestions: Record<string, { purchase_unit: string; store_category: string }> = {};
    try {
      const aiResult = await suggestPurchaseUnits(items.map((i) => ({
        name: i.ingredient,
        quantity: i.quantity_needed || [i.quantity, i.unit].filter(Boolean).join(' '),
      })));
      for (const s of aiResult) {
        if (s.purchase_unit) {
          suggestions[s.ingredient.toLowerCase()] = { purchase_unit: s.purchase_unit, store_category: s.store_category };
        }
      }
    } catch (aiError) {
      console.error('[add-items] AI suggestion failed:', aiError);
    }

    // Use shared pipeline for dedup + merge + insert
    const result = await addItemsWithPipeline(listId, user.id, items, suggestions, db);

    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
