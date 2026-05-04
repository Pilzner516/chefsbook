# Monetisation Strategy

## Executive Summary

ChefsBook's current tier structure (Free/$4.99 Chef/$9.99 Family/$14.99 Pro) is competitive but **Stripe is not integrated**. Before scaling monetisation, payment infrastructure must be completed. Beyond subscriptions, ChefsBook has untapped revenue vectors: creator economy (recipe/menu sales), B2B partnerships (grocery, appliances), data licensing (anonymized cooking behavior), and print-on-demand cookbooks (already built).

## Current State Analysis

### Tier Structure (from packages/db/src/subscriptions.ts)

| Feature | Free | Chef $4.99/mo | Family $9.99/mo | Pro $14.99/mo |
|---------|------|---------------|-----------------|---------------|
| Own recipes | 0 | 75 | 200 | Unlimited |
| Import/Scan/AI | No | Yes | Yes | Yes |
| Shopping lists | 1 | 5 | 5 | Unlimited |
| Cookbooks | 0 | 10 | 25 | Unlimited |
| Images/recipe | 0 | 1 | 1 | 5 |
| Follow/Comment | No | Yes | Yes | Yes |
| PDF export | No | No | No | Yes |
| Meal planning | No | Yes | Yes | Yes |
| Print cookbook | No | Yes | Yes | Yes |
| Family members | 0 | 0 | 3 | 0 |
| Personal versions | 0 | 2 | 2 | 2 |

### Competitive Pricing Analysis

| Competitor | Free Tier | Paid Tier | Model |
|------------|-----------|-----------|-------|
| NYT Cooking | No | $5/mo | Subscription |
| Samsung Food | Yes (limited) | $6.99/mo | Freemium |
| Paprika | No | $4.99 one-time | Purchase |
| Mealime | Yes | $5.99/mo | Freemium |
| BigOven | Yes | $2.99/mo | Freemium |
| Eat Your Books | Yes (limited) | $3/mo | Freemium |

**ChefsBook positioning**: Mid-market pricing ($4.99-14.99) with generous free tier (unlimited public recipe browsing). The Chef tier at $4.99 is competitively priced against Mealime ($5.99) and cheaper than Samsung Food ($6.99).

## Revenue Vector Design

### 1. Subscription Tiers

**Current Assessment**: Well-structured but needs refinement.

**Recommended Changes**:

| Change | Rationale |
|--------|-----------|
| Add annual discounts (20% off) | Industry standard, improves retention |
| Free tier: Allow 3 recipes | "Try before you buy" conversion |
| Chef tier: Increase to $5.99 | Align with market, add value |
| Add "Chef+" at $9.99 | Replace Family (confusing naming) |
| Pro: Add priority AI | Differentiate from Chef+ |

**Projected Conversion Rates**:
- Free → Chef: 3-5% (industry benchmark for freemium)
- Chef → Pro: 10-15% (power users)
- Annual vs Monthly: 40% annual (with 20% discount incentive)

**12-Month Revenue Projection (10,000 users)**:
- 500 Chef subscribers × $5.99 × 12 = $35,940
- 150 Pro subscribers × $14.99 × 12 = $26,982
- Annual discount impact: -15%
- **Total: ~$53,500/year**

### 2. Creator Economy

**Model**: Allow power users to monetize recipes, menus, and cooking classes.

**Implementation**:
```
creator_monetization
├── premium_recipe_collections (one-time purchase)
├── chef_subscriptions (monthly tip jar)
├── live_cooking_classes (ticket sales)
└── sponsored_content (brand partnerships)
```

**Revenue Share**: 70% creator / 30% ChefsBook (industry standard)

**Database Requirements**:
- `creator_products(creator_id, type, price, stripe_product_id)`
- `creator_sales(product_id, buyer_id, amount, platform_fee)`
- `creator_payouts(creator_id, amount, stripe_transfer_id)`

**TAM Estimate**: 
- 1% of users become creators = 100 creators at 10k users
- Average $50/month in sales = $5,000/month gross
- Platform revenue: $1,500/month = $18,000/year

### 3. B2B Partnerships

**Opportunity Areas**:

| Partner Type | Value Proposition | Revenue Model | Build Requirement |
|--------------|-------------------|---------------|-------------------|
| **Grocery Chains** | "Buy ingredients" button | Affiliate (5-10% commission) | API integration |
| **Appliance Makers** | Equipment-aware recipes | License fee | Equipment profile |
| **Meal Kit Companies** | Recipe content licensing | Per-recipe fee | Content API |
| **Food Brands** | Sponsored ingredients | CPM/CPC | Ad system |
| **Culinary Schools** | Student accounts | Bulk license | Admin portal |

**Priority**: Grocery integration has highest ROI - every shopping list is a purchase opportunity.

**Grocery Integration Spec**:
```
User creates shopping list
→ "Order from Instacart/Amazon Fresh" button
→ Deeplink to cart with pre-filled items
→ ChefsBook receives affiliate commission (5-8%)
```

**TAM Estimate**:
- 1,000 shopping lists/month × 20% click-through × $50 avg basket × 5% commission
- = $5,000/month = $60,000/year

### 4. Data Licensing

**What We Have**: Anonymized cooking behavior data
- Recipe popularity by region, season, demographic
- Cooking skill distribution
- Ingredient purchase patterns
- Meal timing patterns

**Who Pays**:
- CPG companies (Kraft, Nestle): Understand cooking trends
- Grocery retailers: Optimize inventory
- Food media: Content strategy
- Market researchers: Consumer insights

**Compliance Requirements**:
- ToS update: "By creating an account, you agree to contribute anonymized data"
- GDPR-compliant anonymization
- No individual-level data sold

**Pricing Model**: Annual license based on data scope
- Basic trends report: $10,000/year
- Full data access: $50,000/year
- Custom research: $100,000+/project

**TAM Estimate**: 
- Realistic at 100k+ users
- 3 enterprise clients × $30,000 = $90,000/year

### 5. Marketplace

**Products**:

| Product | Price | Margin | Build Status |
|---------|-------|--------|--------------|
| Print cookbook (Lulu POD) | $30-80 | 30% | Built (printed_cookbooks table) |
| Premium recipe collections | $5-20 | 70% | Not built |
| Cooking courses | $20-100 | 70% | Not built |
| Meal plan templates | $5-15 | 70% | Not built |

**Print Cookbook Revenue**:
- Already have printed_cookbooks and printed_cookbook_orders tables
- Lulu integration exists
- Average book: $50, margin: $15
- 100 books/month = $1,500/month = $18,000/year

### 6. Affiliate & Commerce

**Opportunities**:

| Affiliate | Commission | Integration |
|-----------|------------|-------------|
| Amazon (equipment) | 3-4% | Affiliate links in recipes |
| Instacart | 5-8% | Shopping list integration |
| Sur La Table | 5-7% | Equipment recommendations |
| Thrive Market | 10% | Specialty ingredients |

**Implementation**: 
- Equipment mentions in recipes → affiliate links
- Shopping list "buy now" → grocery affiliate
- "Chef recommends" equipment section

**TAM Estimate**:
- 10,000 affiliate clicks/month × 2% conversion × $30 avg × 5% commission
- = $300/month = $3,600/year (scales with users)

### 7. Brand Partnerships

**Model**: Authentic integration of food brands into ChefsBook experience.

**Formats**:
- Sponsored recipe collections ("Recipes featuring X ingredient")
- Ingredient spotlight ("This week: cooking with avocado oil")
- Challenge sponsorship ("30-day healthy eating challenge presented by Y")

**Pricing**:
- Sponsored collection: $5,000-20,000/month
- Ingredient spotlight: $2,000-5,000/week
- Challenge sponsorship: $10,000-50,000/campaign

**Guard Rails**:
- All sponsored content labeled
- No fake reviews or ratings
- User opt-out available

## Revenue Projections

### 12-Month Projection (10,000 users)

| Vector | Revenue | % of Total |
|--------|---------|------------|
| Subscriptions | $53,500 | 50% |
| Grocery affiliate | $20,000 | 19% |
| Print cookbooks | $18,000 | 17% |
| Creator economy | $10,000 | 9% |
| Other affiliate | $5,000 | 5% |
| **Total** | **$106,500** | 100% |

### 36-Month Projection (100,000 users)

| Vector | Revenue | % of Total |
|--------|---------|------------|
| Subscriptions | $535,000 | 40% |
| Grocery affiliate | $200,000 | 15% |
| Creator economy | $180,000 | 13% |
| Data licensing | $90,000 | 7% |
| Brand partnerships | $150,000 | 11% |
| Print cookbooks | $100,000 | 7% |
| B2B licenses | $75,000 | 6% |
| Other affiliate | $20,000 | 1% |
| **Total** | **$1,350,000** | 100% |

## Implementation Priority

### Phase 1: Foundation (Weeks 1-4)
1. **Complete Stripe integration** - Currently blocked
2. Add annual subscription option with 20% discount
3. Enable promo codes (table exists, UI needed)
4. Basic analytics: conversion funnel tracking

### Phase 2: Affiliate (Weeks 5-8)
1. Grocery affiliate integration (Instacart API)
2. Shopping list "buy now" button
3. Equipment affiliate links in recipes
4. Affiliate revenue dashboard

### Phase 3: Creator (Weeks 9-12)
1. Creator application/verification system
2. Premium recipe collection purchases
3. Creator payout system (Stripe Connect)
4. Creator analytics dashboard

### Phase 4: B2B (Months 4-6)
1. Enterprise sales outreach
2. Data anonymization pipeline
3. Bulk licensing portal
4. Brand partnership program
