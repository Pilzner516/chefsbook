/**
 * Tag filtering utilities for excluding system and source-attribution tags
 * from moderation and audit scanning.
 */

// Domain TLDs that indicate a source attribution tag (e.g., "seriouseats.com")
const SOURCE_DOMAIN_REGEX = /\.(com|net|org|io|co|uk|fr|de|it|es|au|ca)(\.[a-z]{2})?$/i;

/**
 * Check if a tag is a source domain attribution tag.
 * These are added by the import system to track recipe origins.
 * Examples: "seriouseats.com", "allrecipes.com", "bbc.co.uk"
 */
export function isSourceDomainTag(tag: string): boolean {
  return SOURCE_DOMAIN_REGEX.test(tag);
}

/**
 * Check if a tag is an internal system tag.
 * - Tags starting with underscore (_incomplete, _draft, _unresolved)
 * - Tags starting with "ChefsBook" (internal branding)
 */
export function isSystemTag(tag: string): boolean {
  return tag.startsWith('_') || tag.toLowerCase().startsWith('chefsbook');
}

/**
 * Check if a tag should be excluded from moderation and audit.
 * Returns true for source domain tags and system tags.
 */
export function shouldExcludeFromModeration(tag: string): boolean {
  return isSourceDomainTag(tag) || isSystemTag(tag);
}
