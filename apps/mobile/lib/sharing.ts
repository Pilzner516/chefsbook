import * as Sharing from 'expo-sharing';

export function getShareUrl(shareToken: string): string {
  return `https://chefsbook.app/share/${shareToken}`;
}

export async function shareRecipe(recipe: { title: string; share_token: string }) {
  const url = getShareUrl(recipe.share_token);
  await Sharing.shareAsync(url, {
    dialogTitle: `Share "${recipe.title}"`,
    mimeType: 'text/plain',
  });
}

export const DEEP_LINK_SCHEME = 'chefsbook://share/';
