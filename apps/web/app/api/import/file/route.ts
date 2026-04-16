import { callClaude, extractJSON, detectLanguage, translateRecipeContent } from '@chefsbook/ai';

const EXTRACT_PROMPT = `You are a recipe extraction expert. The following text was extracted from a file.
Find ALL recipes in this content. For each recipe found, extract:

Return ONLY a JSON array of recipe objects:
[{
  "title": "string",
  "description": "string | null",
  "servings": "number | null",
  "prep_minutes": "number | null",
  "cook_minutes": "number | null",
  "cuisine": "string | null",
  "course": "breakfast|brunch|lunch|dinner|starter|main|side|dessert|snack|drink|bread|other|null",
  "ingredients": [{ "quantity": "number|null", "unit": "string|null", "ingredient": "string", "preparation": "string|null", "optional": false, "group_label": "string|null" }],
  "steps": [{ "step_number": 1, "instruction": "string", "timer_minutes": "number|null", "group_label": "string|null" }],
  "notes": "string | null",
  "tags": ["string — 5-8 lowercase tags"],
  "source_type": "manual",
  "section_hint": "string | null (chapter name or page reference if detectable)"
}]

Rules:
- Extract EVERY recipe found in the content
- Every ingredient MUST have a quantity and unit when available
- Preserve group labels for multi-section ingredients
- If no recipes found: return empty array []
- For cookbook/collection content: find ALL recipes, not just the first one`;

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return Response.json({ error: 'File too large (max 50MB)' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = file.type;

  try {
    let text = '';
    let fileType = '';

    // Route by file type
    if (ext === 'html' || ext === 'htm' || mimeType === 'text/html') {
      // Return raw HTML for client-side bookmark parser
      const html = await file.text();
      return Response.json({ fileType: 'html', rawHtml: html, recipes: [] });
    }

    if (ext === 'pdf' || mimeType === 'application/pdf') {
      fileType = 'PDF';
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdf = await pdfParse(buffer);
      text = pdf.text;
      if (text.length < 100) {
        return Response.json({ fileType: 'PDF', error: 'This PDF appears to be scanned. Try taking a photo using the Scan tab instead.', recipes: [] });
      }
    } else if (ext === 'docx' || ext === 'doc' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      fileType = 'Word Document';
      const mammoth = await import('mammoth');
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === 'txt' || ext === 'rtf' || mimeType === 'text/plain') {
      fileType = ext === 'rtf' ? 'Rich Text' : 'Text File';
      text = await file.text();
    } else if (ext === 'csv' || mimeType === 'text/csv') {
      fileType = 'CSV';
      const Papa = (await import('papaparse')).default;
      const csvText = await file.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      // Convert CSV rows to recipe-like objects
      const recipes = parsed.data.map((row: any, i: number) => ({
        title: row.title || row.Title || row.name || row.Name || row.recipe || row.Recipe || `Recipe ${i + 1}`,
        description: row.description || row.Description || null,
        ingredients: (row.ingredients || row.Ingredients || '').split(/[,;]/).filter(Boolean).map((ing: string, j: number) => ({
          quantity: null, unit: null, ingredient: ing.trim(), preparation: null, optional: false, group_label: null,
        })),
        steps: (row.steps || row.Steps || row.instructions || row.Instructions || row.directions || row.Directions || '').split(/\d+\.\s*/).filter(Boolean).map((s: string, j: number) => ({
          step_number: j + 1, instruction: s.trim(), timer_minutes: null, group_label: null,
        })),
        servings: parseInt(row.servings || row.Servings) || null,
        cuisine: row.cuisine || row.Cuisine || null,
        course: row.course || row.Course || null,
        prep_minutes: parseInt(row.prep_time || row.prep_minutes) || null,
        cook_minutes: parseInt(row.cook_time || row.cook_minutes) || null,
        notes: row.notes || row.Notes || null,
        source_type: 'manual' as const,
        section_hint: null,
      }));
      return Response.json({ fileType, recipes, total: recipes.length });
    } else if (ext === 'json' || mimeType === 'application/json') {
      fileType = 'JSON';
      const jsonText = await file.text();
      try {
        let parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) parsed = [parsed];
        // Check if it looks like recipe data
        const recipes = parsed.map((item: any) => ({
          title: item.title || item.name || 'Untitled',
          description: item.description || null,
          ingredients: item.ingredients || [],
          steps: item.steps || item.instructions || [],
          servings: item.servings || null,
          cuisine: item.cuisine || null,
          course: item.course || null,
          prep_minutes: item.prep_minutes || item.prepTime || null,
          cook_minutes: item.cook_minutes || item.cookTime || null,
          notes: item.notes || null,
          source_type: 'manual' as const,
          section_hint: null,
        }));
        return Response.json({ fileType, recipes, total: recipes.length });
      } catch {
        text = jsonText; // Fall through to Claude extraction
      }
    } else {
      return Response.json({ error: `Unsupported file type: .${ext}` }, { status: 400 });
    }

    // For PDF, Word, Text — send to Claude for extraction
    if (!text || text.length < 50) {
      return Response.json({ fileType, error: 'File has no extractable text content', recipes: [] });
    }

    const prompt = `${EXTRACT_PROMPT}\n\nFile type: ${fileType}\nFile name: ${file.name}\n\nContent:\n${text.slice(0, 25000)}`;
    const response = await callClaude({ prompt, maxTokens: 4000 });

    let recipes: any[] = [];
    try {
      recipes = extractJSON(response) as any[];
      if (!Array.isArray(recipes)) recipes = [recipes];
    } catch {
      recipes = [];
    }

    // Translate non-English recipes to English
    for (let i = 0; i < recipes.length; i++) {
      try {
        const sample = `${recipes[i].title ?? ''} ${(recipes[i].ingredients ?? []).slice(0, 2).map((ing: any) => ing.ingredient ?? '').join(' ')}`;
        const srcLang = await detectLanguage(sample);
        if (srcLang !== 'en') {
          recipes[i] = await translateRecipeContent(recipes[i], 'en', srcLang);
        }
      } catch { /* translation failure non-blocking */ }
    }

    return Response.json({ fileType, recipes, total: recipes.length });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
