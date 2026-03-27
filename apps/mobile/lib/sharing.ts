import { Share } from 'react-native';

export function getShareUrl(shareToken: string): string {
  return `https://chefsbook.app/share/${shareToken}`;
}

export async function shareRecipe(recipe: { title: string; share_token: string }) {
  const url = getShareUrl(recipe.share_token);
  await Share.share({
    title: recipe.title,
    message: `Check out "${recipe.title}" on Chefsbook!\n${url}`,
    url,
  });
}

export const DEEP_LINK_SCHEME = 'chefsbook://share/';
