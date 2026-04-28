import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@chefsbook/db';

// GET /api/print-cookbook/templates - List active templates for users
export async function GET(request: NextRequest) {
  const { data, error } = await supabase
    .from('cookbook_templates')
    .select('id, name, description, category, preview_image_url, is_premium, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by category
  const byCategory: Record<string, typeof data> = {};
  for (const template of data || []) {
    if (!byCategory[template.category]) {
      byCategory[template.category] = [];
    }
    byCategory[template.category].push(template);
  }

  return NextResponse.json({ templates: data, byCategory });
}
