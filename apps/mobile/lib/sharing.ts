import { Share } from 'react-native';

export function getShareUrl(shareToken: string, refUsername?: string | null): string {
  const base = `https://chefsbk.app/share/${shareToken}`;
  return refUsername ? `${base}?ref=${refUsername}` : base;
}

export async function shareRecipe(recipe: { title: string; share_token: string }, refUsername?: string | null) {
  const url = getShareUrl(recipe.share_token, refUsername);
  await Share.share({
    title: recipe.title,
    message: `Check out "${recipe.title}" on Chefsbook!\n${url}`,
    url,
  });
}

export const DEEP_LINK_SCHEME = 'chefsbook://share/';
