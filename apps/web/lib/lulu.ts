// Lulu Print API Client
// Documentation: https://api.lulu.com/docs/

const LULU_SANDBOX = process.env.LULU_SANDBOX === 'true';
const LULU_BASE_URL = LULU_SANDBOX
  ? 'https://api.sandbox.lulu.com'
  : 'https://api.lulu.com';

const LULU_AUTH_URL = LULU_SANDBOX
  ? 'https://api.sandbox.lulu.com/auth/realms/glasstree/protocol/openid-connect/token'
  : 'https://api.lulu.com/auth/realms/glasstree/protocol/openid-connect/token';

// ChefsBook margin in cents
export const OUR_MARGIN_CENTS = 499;

// Lulu POD Package ID format: [SIZE][COLOR][QUALITY][BINDING][PAPER][COVER][FINISH]
// Example: 0850X1100FCSTDPB060CW444GXX
// - 0850X1100: 8.5" × 11"
// - FC: Full color (BW for black & white)
// - STD: Standard quality
// - PB: Perfect bind softcover (CW for case wrap hardcover)
// - 060: 60lb paper weight
// - CW: Color wrap cover
// - 444: Paper type
// - GXX: Finish (glossy)

export interface ProductOptions {
  size: '6x9' | '8.5x11' | '5.5x8.5';
  binding: 'softcover' | 'hardcover';
  paperType: 'standard' | 'premium';
  coverFinish: 'matte' | 'glossy';
  interiorColor: 'color' | 'bw';
}

export const PRODUCT_OPTIONS = {
  sizes: [
    { id: '6x9', label: '6" × 9"', description: 'Standard book size', podPrefix: '0600X0900' },
    { id: '8.5x11', label: '8.5" × 11"', description: 'Full page cookbook size', podPrefix: '0850X1100' },
    { id: '5.5x8.5', label: '5.5" × 8.5"', description: 'Compact size', podPrefix: '0550X0850' },
  ],
  bindings: [
    { id: 'softcover', label: 'Softcover', description: 'Perfect bound paperback', podCode: 'PB', priceMultiplier: 1.0 },
    { id: 'hardcover', label: 'Hardcover', description: 'Durable case wrap binding', podCode: 'CW', priceMultiplier: 1.5 },
  ],
  paperTypes: [
    { id: 'standard', label: 'Standard Paper', description: '60# white paper', podCode: '060', priceMultiplier: 1.0 },
    { id: 'premium', label: 'Premium Paper', description: '80# cream paper, thicker pages', podCode: '080', priceMultiplier: 1.2 },
  ],
  coverFinishes: [
    { id: 'matte', label: 'Matte', description: 'Elegant, non-reflective finish', podCode: 'M' },
    { id: 'glossy', label: 'Glossy', description: 'Vibrant, shiny finish', podCode: 'G' },
  ],
  interiorColors: [
    { id: 'color', label: 'Full Color', description: 'Color photos and text', podCode: 'FC', priceMultiplier: 1.0 },
    { id: 'bw', label: 'Black & White', description: 'Grayscale interior', podCode: 'BW', priceMultiplier: 0.5 },
  ],
};

export function buildPodPackageId(options: ProductOptions): string {
  const size = PRODUCT_OPTIONS.sizes.find(s => s.id === options.size);
  const binding = PRODUCT_OPTIONS.bindings.find(b => b.id === options.binding);
  const paper = PRODUCT_OPTIONS.paperTypes.find(p => p.id === options.paperType);
  const finish = PRODUCT_OPTIONS.coverFinishes.find(f => f.id === options.coverFinish);
  const color = PRODUCT_OPTIONS.interiorColors.find(c => c.id === options.interiorColor);

  if (!size || !binding || !paper || !finish || !color) {
    return '0850X1100FCSTDPB060CW444GXX';
  }

  return `${size.podPrefix}${color.podCode}STD${binding.podCode}${paper.podCode}CW444${finish.podCode}XX`;
}

export function getDefaultProductOptions(): ProductOptions {
  return {
    size: '8.5x11',
    binding: 'softcover',
    paperType: 'standard',
    coverFinish: 'glossy',
    interiorColor: 'color',
  };
}

interface LuluTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface LuluShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code: string;
  phone_number: string;
}

interface LuluLineItem {
  title: string;
  cover: { source_url: string };
  interior: { source_url: string };
  pod_package_id: string;
  quantity: number;
}

interface LuluCostRequest {
  line_items: Array<{
    page_count: number;
    pod_package_id: string;
    quantity: number;
  }>;
  shipping_address: LuluShippingAddress;
  shipping_option: string;
}

interface LuluCostResponse {
  total_cost_excl_tax: string;
  total_cost_incl_tax: string;
  total_tax: string;
  currency: string;
  line_item_costs: Array<{
    cost_excl_tax: string;
    cost_incl_tax: string;
    tax: string;
    quantity: number;
  }>;
  shipping_cost: {
    total_cost_excl_tax: string;
    total_cost_incl_tax: string;
  };
}

interface LuluPrintJobRequest {
  contact_email: string;
  external_id?: string;
  line_items: LuluLineItem[];
  shipping_address: LuluShippingAddress;
  shipping_level: 'MAIL' | 'PRIORITY_MAIL' | 'GROUND' | 'EXPEDITED' | 'EXPRESS';
}

interface LuluPrintJob {
  id: number;
  status: {
    name: string;
    messages: { code: string; message: string }[];
  };
  line_items: Array<{
    id: number;
    title: string;
    tracking_id?: string;
    tracking_urls?: string[];
  }>;
  estimated_shipping_dates?: {
    arrival_min: string;
    arrival_max: string;
  };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const apiKey = process.env.LULU_API_KEY;
  const apiSecret = process.env.LULU_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LULU_API_KEY and LULU_API_SECRET must be set');
  }

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  const res = await fetch(LULU_AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lulu auth failed: ${res.status} ${text}`);
  }

  const data: LuluTokenResponse = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

async function luluFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${LULU_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lulu API error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function calculatePrintCost(
  pageCount: number,
  quantity: number,
  shippingAddress: LuluShippingAddress,
  shippingLevel: string = 'GROUND',
  productOptions?: ProductOptions,
): Promise<{
  luluCostCents: number;
  shippingCostCents: number;
  ourMarginCents: number;
  totalCents: number;
}> {
  const podPackageId = productOptions
    ? buildPodPackageId(productOptions)
    : '0850X1100FCSTDPB060CW444GXX';

  const request: LuluCostRequest = {
    line_items: [{
      page_count: pageCount,
      pod_package_id: podPackageId,
      quantity,
    }],
    shipping_address: shippingAddress,
    shipping_option: shippingLevel,
  };

  const response = await luluFetch<LuluCostResponse>('/print-job-cost-calculations/', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  const luluCostCents = Math.round(parseFloat(response.total_cost_incl_tax) * 100);
  const shippingCostCents = Math.round(parseFloat(response.shipping_cost.total_cost_incl_tax) * 100);

  return {
    luluCostCents,
    shippingCostCents,
    ourMarginCents: OUR_MARGIN_CENTS,
    totalCents: luluCostCents + shippingCostCents + OUR_MARGIN_CENTS,
  };
}

export async function createPrintJob(
  title: string,
  coverPdfUrl: string,
  interiorPdfUrl: string,
  quantity: number,
  shippingAddress: LuluShippingAddress,
  shippingLevel: 'MAIL' | 'PRIORITY_MAIL' | 'GROUND' | 'EXPEDITED' | 'EXPRESS',
  contactEmail: string,
  externalId?: string,
  productOptions?: ProductOptions,
): Promise<LuluPrintJob> {
  const podPackageId = productOptions
    ? buildPodPackageId(productOptions)
    : '0850X1100FCSTDPB060CW444GXX';

  const request: LuluPrintJobRequest = {
    contact_email: contactEmail,
    external_id: externalId,
    line_items: [{
      title,
      cover: { source_url: coverPdfUrl },
      interior: { source_url: interiorPdfUrl },
      pod_package_id: podPackageId,
      quantity,
    }],
    shipping_address: shippingAddress,
    shipping_level: shippingLevel,
  };

  return luluFetch<LuluPrintJob>('/print-jobs/', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getPrintJob(printJobId: string | number): Promise<LuluPrintJob> {
  return luluFetch<LuluPrintJob>(`/print-jobs/${printJobId}/`);
}

export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === expectedSignature;
}

export function isLuluConfigured(): boolean {
  return !!(process.env.LULU_API_KEY && process.env.LULU_API_SECRET);
}
