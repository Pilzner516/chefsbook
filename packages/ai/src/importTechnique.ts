import { callClaude, extractJSON } from './client';

const TECHNIQUE_PROMPT = `You are a cooking technique extraction expert. Extract a cooking technique from this content.

Return ONLY a JSON object, no markdown, no explanation:
{
  "title": "string — name of the technique",
  "description": "string — what it is and why it matters (2-3 sentences)",
  "process_steps": [
    {
      "step_number": 1,
      "instruction": "string — what to do",
      "tip": "string | null — pro tip for this step",
      "common_mistake": "string | null — what people get wrong here"
    }
  ],
  "tips": ["string — general tips from the source"],
  "common_mistakes": ["string — common mistakes from the source"],
  "tools_and_equipment": ["string — tools/equipment needed"],
  "difficulty": "beginner | intermediate | advanced"
}

Rules:
- If this content is NOT about a cooking technique/method/skill, return exactly: null
- Focus on the METHOD, not a specific dish
- Extract tips and common mistakes even if they're scattered throughout the text
- Difficulty: beginner = basic skills anyone can learn, intermediate = requires some kitchen experience, advanced = professional-level skill
- Use null for optional fields not found in the source`;

const TECHNIQUE_YT_PROMPT = `You are a cooking technique extraction expert. Extract a cooking technique from this YouTube video's title, description, and transcript.

Return ONLY a JSON object, no markdown, no explanation:
{
  "title": "string — name of the technique",
  "description": "string — what it is and why it matters (2-3 sentences)",
  "process_steps": [
    {
      "step_number": 1,
      "instruction": "string — what to do",
      "tip": "string | null — pro tip for this step",
      "common_mistake": "string | null — what people get wrong here"
    }
  ],
  "tips": ["string — general tips from the source"],
  "common_mistakes": ["string — common mistakes from the source"],
  "tools_and_equipment": ["string — tools/equipment needed"],
  "difficulty": "beginner | intermediate | advanced"
}

Rules:
- If this video is NOT about a cooking technique/method/skill, return exactly: null
- Focus on the METHOD, not a specific dish
- Extract tips and common mistakes from both description and transcript
- Use null for optional fields not found`;

export interface ExtractedTechnique {
  title: string;
  description: string | null;
  process_steps: {
    step_number: number;
    instruction: string;
    tip: string | null;
    common_mistake: string | null;
  }[];
  tips: string[];
  common_mistakes: string[];
  tools_and_equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Extract a technique from web page text.
 */
export async function importTechnique(
  pageText: string,
  sourceUrl: string,
): Promise<ExtractedTechnique | null> {
  const prompt = `${TECHNIQUE_PROMPT}\n\nSource URL: ${sourceUrl}\n\nContent:\n${pageText.slice(0, 8000)}`;
  const text = await callClaude({ prompt, maxTokens: 3000 });

  const trimmed = text.trim();
  if (trimmed === 'null' || trimmed === '`null`') return null;

  try {
    return extractJSON<ExtractedTechnique>(text);
  } catch {
    return null;
  }
}

/**
 * Extract a technique from YouTube video content.
 */
export async function importTechniqueFromYouTube(params: {
  videoTitle: string;
  description: string;
  transcript: string;
}): Promise<ExtractedTechnique | null> {
  const { videoTitle, description, transcript } = params;

  const content = [
    `Video title: ${videoTitle}`,
    '',
    `Video description:\n${description.slice(0, 4000)}`,
    '',
    `Transcript:\n${transcript.slice(0, 8000)}`,
  ].join('\n');

  const prompt = `${TECHNIQUE_YT_PROMPT}\n\n${content}`;
  const text = await callClaude({ prompt, maxTokens: 3000 });

  const trimmed = text.trim();
  if (trimmed === 'null' || trimmed === '`null`') return null;

  try {
    return extractJSON<ExtractedTechnique>(text);
  } catch {
    return null;
  }
}
