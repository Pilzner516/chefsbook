export const AUDIT_RULES_VERSION = '1.0';

export const STANDARD_RULES = `
Family-friendly platform. Flag content containing:
- Profanity or offensive language
- Sexual or explicit content
- Hate speech or discrimination
- Violence or graphic content
- Spam or self-promotion (URLs, contact info, "buy now")
- Content clearly unrelated to food or cooking
`;

export const DEEP_RULES = `
${STANDARD_RULES}
Additionally flag:
- Borderline inappropriate language or innuendo
- Thinly veiled spam or promotional language
- Misleading health claims or dangerous instructions
- Copyright-suspicious content (verbatim recipes from major publishers)
- Unusually keyword-stuffed titles or descriptions
- Ingredient quantities that suggest dangerous amounts
`;
