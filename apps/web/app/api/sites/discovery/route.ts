import { NextRequest } from 'next/server';
import { recordSiteDiscovery, extractDomain } from '@chefsbook/db';

/**
 * Mobile-friendly endpoint: given a source URL, records a first-time-seen
 * domain (if any) and returns the warm discovery payload for the client to
 * surface as a toast. Auth is optional — we attribute when we can.
 */
export async function POST(req: NextRequest) {
  try {
    const { url, userId } = await req.json();
    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'url required' }, { status: 400 });
    }
    const domain = extractDomain(url);
    if (!domain) return Response.json({ isNewDiscovery: false });

    const result = await recordSiteDiscovery(domain, userId ?? null);
    if (!result.isNewDiscovery) {
      return Response.json({ isNewDiscovery: false });
    }
    return Response.json({
      isNewDiscovery: true,
      domain,
      message: "You've helped ChefsBook discover something new!",
      subMessage: `We hadn't seen ${domain} before. We've added it to our list and we'll test it soon so every future import from this site works beautifully.`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
