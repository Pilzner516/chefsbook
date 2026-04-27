import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal, LayoutAnimation, UIManager, Platform, KeyboardAvoidingView } from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { supabase, listRecipes, saveRecipe, searchByIngredient, searchUsers, getBatchTranslatedTitles, getVerifiedUserIds, getPrimaryPhotos } from '@chefsbook/db';
import type { Recipe, UserProfile } from '@chefsbook/db';
import { Avatar } from '../../components/UIKit';
import { getInitials } from '@chefsbook/ui';
import { DIETARY_FLAGS, CUISINE_LIST, COURSE_LIST } from '@chefsbook/ui';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { RecipeCard, EmptyState, Loading } from '../../components/UIKit';
import VerifiedBadge from '../../components/VerifiedBadge';

type SearchMode = 'all' | 'mine' | 'following' | 'whats-new';

interface ActiveFilter {
  type: string;
  value: string;
  label: string;
}

const CATEGORIES: { key: string; labelKey: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'cuisine', labelKey: 'search.cuisine', icon: 'earth-outline' },
  { key: 'course', labelKey: 'search.course', icon: 'restaurant-outline' },
  { key: 'ingredient', labelKey: 'search.ingredient', icon: 'nutrition-outline' },
  { key: 'dietary', labelKey: 'search.dietary', icon: 'leaf-outline' },
  { key: 'calories', labelKey: 'search.calories', icon: 'flame-outline' },
  { key: 'protein', labelKey: 'search.protein', icon: 'barbell-outline' },
  { key: 'nutritionPreset', labelKey: 'search.nutritionPreset', icon: 'fitness-outline' },
  { key: 'tags', labelKey: 'search.tags', icon: 'pricetag-outline' },
  { key: 'time', labelKey: 'search.cookTime', icon: 'time-outline' },
  { key: 'source', labelKey: 'search.source', icon: 'link-outline' },
  { key: 'favourites', labelKey: 'search.favorites', icon: 'heart' },
];

const DISCOVER_CATEGORIES: { key: string; labelKey: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'cuisine', labelKey: 'search.cuisine', icon: 'earth-outline' },
  { key: 'course', labelKey: 'search.course', icon: 'restaurant-outline' },
  { key: 'dietary', labelKey: 'search.dietary', icon: 'leaf-outline' },
  { key: 'calories', labelKey: 'search.calories', icon: 'flame-outline' },
  { key: 'protein', labelKey: 'search.protein', icon: 'barbell-outline' },
  { key: 'nutritionPreset', labelKey: 'search.nutritionPreset', icon: 'fitness-outline' },
];

// Use CUISINE_LIST and COURSE_LIST from @chefsbook/ui
const TIME_OPTION_KEYS = [
  { labelKey: 'search.under15', value: 15 },
  { labelKey: 'search.under30', value: 30 },
  { labelKey: 'search.under60', value: 60 },
  { labelKey: 'search.under2h', value: 120 },
];
const SOURCE_OPTIONS = ['url', 'scan', 'manual', 'voice', 'youtube'];

// Nutrition filter constants (matching web)
const CALORIE_FILTERS = [
  { labelKey: 'search.caloriesAny', value: 'any' },
  { labelKey: 'search.caloriesUnder300', value: 'under300' },
  { labelKey: 'search.calories300to500', value: '300-500' },
  { labelKey: 'search.calories500to700', value: '500-700' },
  { labelKey: 'search.caloriesOver700', value: 'over700' },
];
const PROTEIN_FILTERS = [
  { labelKey: 'search.proteinAny', value: 'any' },
  { labelKey: 'search.proteinHigh', value: 'high' },
  { labelKey: 'search.proteinMedium', value: 'medium' },
  { labelKey: 'search.proteinLow', value: 'low' },
];
const NUTRITION_PRESETS = [
  { key: 'lowCarb', labelKey: 'search.presetLowCarb', emoji: '🥩' },
  { key: 'highFiber', labelKey: 'search.presetHighFiber', emoji: '🥦' },
  { key: 'lowFat', labelKey: 'search.presetLowFat', emoji: '🥗' },
  { key: 'lowSodium', labelKey: 'search.presetLowSodium', emoji: '🧂' },
];

export default function SearchTab() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { q: initialQuery } = useLocalSearchParams<{ q?: string }>();
  const session = useAuthStore((s) => s.session);
  const searchRef = useRef<TextInput>(null);

  const [mode, setMode] = useState<SearchMode>('all');
  const [query, setQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [filterSheetCategory, setFilterSheetCategory] = useState<string | null>(null);
  const [filterSheetSearch, setFilterSheetSearch] = useState('');
  const [cloning, setCloning] = useState<string | null>(null);
  const tabBarHeight = useTabBarHeight();
  const [ingredientInput, setIngredientInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(true); // collapsed when filters active
  const [peopleResults, setPeopleResults] = useState<UserProfile[]>([]);
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const [verifiedPeopleIds, setVerifiedPeopleIds] = useState<Set<string>>(new Set());
  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const insets = useSafeAreaInsets();

  // Batch-fetch primary photos for recipe results
  useEffect(() => {
    if (results.length === 0) { setPrimaryPhotos({}); return; }
    getPrimaryPhotos(results.map((r) => r.id)).then(setPrimaryPhotos);
  }, [results]);

  // Batch-fetch translated titles for search results when language is not English
  useEffect(() => {
    if (results.length === 0) { setTranslatedTitles({}); return; }
    const lang = i18n.language;
    if (lang && lang !== 'en') {
      getBatchTranslatedTitles(results.map((r) => r.id), lang).then(setTranslatedTitles);
    } else {
      setTranslatedTitles({});
    }
  }, [results, i18n.language]);

  // Fetch verified IDs for people search results
  useEffect(() => {
    if (peopleResults.length === 0) { setVerifiedPeopleIds(new Set()); return; }
    getVerifiedUserIds(peopleResults.map((u) => u.id)).then(setVerifiedPeopleIds);
  }, [peopleResults]);

  // Auto-collapse filters when filters are active, auto-expand when cleared
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (activeFilters.length > 0) {
      setFiltersExpanded(false);
    } else {
      setFiltersExpanded(true);
    }
  }, [activeFilters.length]);

  // Reset state when switching modes
  const switchMode = (newMode: SearchMode) => {
    setMode(newMode);
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setActiveFilters([]);
    setExpandedCategory(null);
  };

  const filterParams = useCallback(() => {
    const params: Record<string, any> = {};
    for (const f of activeFilters) {
      if (f.type === 'cuisine') params.cuisine = f.value;
      if (f.type === 'course') params.course = f.value;
      if (f.type === 'time') params.maxTime = parseInt(f.value);
      if (f.type === 'source') params.sourceType = f.value;
      if (f.type === 'tags') {
        params.tags = params.tags ? [...params.tags, f.value] : [f.value];
      }
      if (f.type === 'favourites') params.favouritesOnly = true;
      // Nutrition filters
      if (f.type === 'calories') {
        if (f.value === 'under300') params.calMax = 299;
        else if (f.value === '300-500') { params.calMin = 300; params.calMax = 500; }
        else if (f.value === '500-700') { params.calMin = 500; params.calMax = 700; }
        else if (f.value === 'over700') params.calMin = 701;
      }
      if (f.type === 'protein') {
        if (f.value === 'high') params.proteinMin = 20;
        else if (f.value === 'medium') params.proteinMin = 10;
        // 'low' requires client-side filter (no proteinMax in RPC)
      }
      if (f.type === 'nutritionPreset') {
        if (f.value === 'lowCarb') params.carbsMax = 19;
        if (f.value === 'highFiber') params.fiberMin = 5;
        if (f.value === 'lowFat') params.fatMax = 9;
        if (f.value === 'lowSodium') params.sodiumMax = 599;
      }
    }
    return params;
  }, [activeFilters]);

  const doSearch = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    setHasSearched(true);
    setPeopleResults([]);
    const params = filterParams();

    // Search people when query has content (@ prefix or plain text)
    if (query.trim() && (mode === 'all' || mode === 'mine')) {
      searchUsers(query.trim()).then(setPeopleResults).catch(() => {});
    }

    // Ingredient filter: search by ingredient first, then intersect
    const ingredientFilters = activeFilters.filter((f) => f.type === 'ingredient');
    const dietaryFilters = activeFilters.filter((f) => f.type === 'dietary');

    let recipeResults: Recipe[] = [];

    if (mode === 'following') {
      // Get recipes from users the current user follows
      const { data: follows } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', session.user.id);

      const followingIds = (follows ?? []).map(f => f.following_id);

      if (followingIds.length === 0) {
        recipeResults = [];
      } else {
        const { data } = await supabase
          .from('recipes')
          .select('*')
          .in('user_id', followingIds)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(50);

        recipeResults = (data ?? []) as Recipe[];
      }
    } else if (mode === 'whats-new') {
      // Get trending public recipes sorted by hot score
      const { data } = await supabase
        .from('recipes')
        .select('*')
        .eq('visibility', 'public')
        .order('like_count', { ascending: false })
        .limit(50);

      // Calculate hot score client-side
      recipeResults = ((data ?? []) as Recipe[]).map(r => {
        const hoursSincePosted = Math.max(1, (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
        const hotScore = ((r.like_count ?? 0) + (r.save_count ?? 0)) / Math.pow(hoursSincePosted, 0.8);
        return { ...r, hot_score: hotScore };
      }).sort((a, b) => ((b as any).hot_score ?? 0) - ((a as any).hot_score ?? 0));
    } else if (mode === 'mine') {
      let data: Recipe[];
      if (ingredientFilters.length > 0) {
        // Search by first ingredient, then client-filter by remaining
        data = await searchByIngredient(ingredientFilters[0].value, session.user.id);
        for (let i = 1; i < ingredientFilters.length; i++) {
          const more = await searchByIngredient(ingredientFilters[i].value, session.user.id);
          const ids = new Set(more.map((r) => r.id));
          data = data.filter((r) => ids.has(r.id));
        }
        // Apply text search filter client-side
        if (query.trim()) {
          const q = query.trim().toLowerCase();
          data = data.filter((r) => r.title.toLowerCase().includes(q));
        }
        // Apply other filters client-side
        if (params.cuisine) data = data.filter((r) => r.cuisine === params.cuisine);
        if (params.course) data = data.filter((r) => r.course === params.course);
      } else {
        data = await listRecipes({
          userId: session.user.id,
          search: query.trim() || undefined,
          ...params,
        });
      }
      // Dietary filter: client-side filter on dietary_flags array
      if (dietaryFilters.length > 0) {
        data = data.filter((r) =>
          dietaryFilters.every((f) => (r.dietary_flags ?? []).includes(f.value))
        );
      }
      recipeResults = data;
    } else {
      // mode === 'all' - all public recipes (use listRecipes with includePublic for nutrition filters)
      let data = await listRecipes({
        userId: session.user.id,
        search: query.trim() || undefined,
        includePublic: true,
        ...params,
      });
      // Dietary filter for all recipes mode
      if (dietaryFilters.length > 0) {
        data = data.filter((r) =>
          dietaryFilters.every((f) => (r.dietary_flags ?? []).includes(f.value))
        );
      }
      // Filter to only show public recipes (not user's own)
      recipeResults = data.filter((r) => r.visibility === 'public' || r.visibility === 'shared_link');
    }

    // Client-side filter for "low protein" (RPC doesn't support proteinMax)
    const lowProteinFilter = activeFilters.find((f) => f.type === 'protein' && f.value === 'low');
    if (lowProteinFilter) {
      recipeResults = recipeResults.filter((r) => {
        const nutrition = (r as any).nutrition;
        if (!nutrition?.per_serving) return false;
        return (nutrition.per_serving.protein_g ?? 0) < 10;
      });
    }

    setResults(recipeResults);
    setLoading(false);
  }, [session?.user?.id, query, activeFilters, filterParams, mode]);

  useEffect(() => {
    const timeout = setTimeout(doSearch, 300);
    return () => clearTimeout(timeout);
  }, [query, activeFilters]);

  // Auto-load when switching to social modes
  useEffect(() => {
    if ((mode === 'all' || mode === 'following' || mode === 'whats-new') && !hasSearched && results.length === 0) {
      doSearch();
    }
  }, [mode]);

  const handleClone = async (recipeId: string) => {
    if (!session?.user?.id) return;
    setCloning(recipeId);
    try {
      await saveRecipe(recipeId, session.user.id);
      Alert.alert(t('search.addedTitle'), t('search.addedMessage'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message ?? t('search.cloneFailed'));
    }
    setCloning(null);
  };

  const addFilter = (type: string, value: string, label: string) => {
    if (['cuisine', 'course', 'time', 'source', 'favourites', 'calories', 'protein'].includes(type)) {
      // Single-select filters - replace existing
      setActiveFilters((prev) => [...prev.filter((f) => f.type !== type), { type, value, label }]);
    } else {
      // Tags, dietary, ingredient, and nutritionPreset can have multiple
      if (activeFilters.some((f) => f.type === type && f.value === value)) return;
      setActiveFilters((prev) => [...prev, { type, value, label }]);
    }
    setExpandedCategory(null);
  };

  const removeFilter = (type: string, value: string) => {
    setActiveFilters((prev) => prev.filter((f) => !(f.type === type && f.value === value)));
  };

  const getSubcategoryOptions = (key: string) => {
    switch (key) {
      case 'cuisine': return CUISINE_LIST.map((v) => ({ label: v, value: v }));
      case 'course': return COURSE_LIST.map((v) => ({ label: v, value: v.toLowerCase() }));
      case 'time': return TIME_OPTION_KEYS.map((v) => ({ label: t(v.labelKey), value: String(v.value) }));
      case 'source': return SOURCE_OPTIONS.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v }));
      case 'favourites': return [{ label: t('search.favoritesOnly'), value: 'true' }];
      case 'dietary': return DIETARY_FLAGS.map((f) => ({ label: `${f.emoji} ${f.label}`, value: f.key }));
      case 'ingredient': return []; // ingredient uses text input, not chips
      case 'tags': return []; // tags use text input
      case 'calories': return CALORIE_FILTERS.filter(f => f.value !== 'any').map((f) => ({ label: t(f.labelKey), value: f.value }));
      case 'protein': return PROTEIN_FILTERS.filter(f => f.value !== 'any').map((f) => ({ label: t(f.labelKey), value: f.value }));
      case 'nutritionPreset': return NUTRITION_PRESETS.map((p) => ({ label: `${p.emoji} ${t(p.labelKey)}`, value: p.key }));
      default: return [];
    }
  };

  const categories = mode === 'mine' ? CATEGORIES : DISCOVER_CATEGORIES;

  // Fetch filter counts when opening a filter sheet
  const fetchFilterCounts = useCallback(async (categoryKey: string) => {
    if (!session?.user?.id) return;
    setLoadingCounts(true);
    const counts: Record<string, number> = {};

    try {
      if (categoryKey === 'cuisine') {
        const query = mode === 'mine'
          ? supabase.from('recipes').select('cuisine').eq('user_id', session.user.id).not('cuisine', 'is', null)
          : supabase.from('recipes').select('cuisine').in('visibility', ['public', 'shared_link']).not('cuisine', 'is', null);
        const { data } = await query;
        for (const row of data ?? []) {
          if (row.cuisine) counts[row.cuisine] = (counts[row.cuisine] ?? 0) + 1;
        }
      } else if (categoryKey === 'course') {
        const query = mode === 'mine'
          ? supabase.from('recipes').select('course').eq('user_id', session.user.id).not('course', 'is', null)
          : supabase.from('recipes').select('course').in('visibility', ['public', 'shared_link']).not('course', 'is', null);
        const { data } = await query;
        for (const row of data ?? []) {
          if (row.course) counts[row.course.toLowerCase()] = (counts[row.course.toLowerCase()] ?? 0) + 1;
        }
      } else if (categoryKey === 'dietary') {
        const query = mode === 'mine'
          ? supabase.from('recipes').select('dietary_flags').eq('user_id', session.user.id)
          : supabase.from('recipes').select('dietary_flags').in('visibility', ['public', 'shared_link']);
        const { data } = await query;
        for (const row of data ?? []) {
          for (const flag of row.dietary_flags ?? []) {
            counts[flag] = (counts[flag] ?? 0) + 1;
          }
        }
      } else if (categoryKey === 'calories' || categoryKey === 'protein' || categoryKey === 'nutritionPreset') {
        // Fetch recipes with nutrition data
        const query = mode === 'mine'
          ? supabase.from('recipes').select('nutrition').eq('user_id', session.user.id).not('nutrition', 'is', null)
          : supabase.from('recipes').select('nutrition').in('visibility', ['public', 'shared_link']).not('nutrition', 'is', null);
        const { data } = await query;

        for (const row of data ?? []) {
          const n = row.nutrition?.per_serving;
          if (!n) continue;

          // Calorie counts
          if (categoryKey === 'calories') {
            const cal = n.calories ?? 0;
            if (cal < 300) counts['under300'] = (counts['under300'] ?? 0) + 1;
            if (cal >= 300 && cal <= 500) counts['300-500'] = (counts['300-500'] ?? 0) + 1;
            if (cal >= 500 && cal <= 700) counts['500-700'] = (counts['500-700'] ?? 0) + 1;
            if (cal > 700) counts['over700'] = (counts['over700'] ?? 0) + 1;
          }

          // Protein counts
          if (categoryKey === 'protein') {
            const prot = n.protein_g ?? 0;
            if (prot >= 20) counts['high'] = (counts['high'] ?? 0) + 1;
            if (prot >= 10 && prot < 20) counts['medium'] = (counts['medium'] ?? 0) + 1;
            if (prot < 10) counts['low'] = (counts['low'] ?? 0) + 1;
          }

          // Nutrition preset counts
          if (categoryKey === 'nutritionPreset') {
            if ((n.carbs_g ?? 100) < 20) counts['lowCarb'] = (counts['lowCarb'] ?? 0) + 1;
            if ((n.fiber_g ?? 0) >= 5) counts['highFiber'] = (counts['highFiber'] ?? 0) + 1;
            if ((n.fat_g ?? 100) < 10) counts['lowFat'] = (counts['lowFat'] ?? 0) + 1;
            if ((n.sodium_mg ?? 1000) < 600) counts['lowSodium'] = (counts['lowSodium'] ?? 0) + 1;
          }
        }
      } else if (categoryKey === 'source') {
        const query = mode === 'mine'
          ? supabase.from('recipes').select('source_type').eq('user_id', session.user.id).not('source_type', 'is', null)
          : supabase.from('recipes').select('source_type').in('visibility', ['public', 'shared_link']).not('source_type', 'is', null);
        const { data } = await query;
        for (const row of data ?? []) {
          if (row.source_type) counts[row.source_type] = (counts[row.source_type] ?? 0) + 1;
        }
      } else if (categoryKey === 'time') {
        const query = mode === 'mine'
          ? supabase.from('recipes').select('total_minutes').eq('user_id', session.user.id).not('total_minutes', 'is', null)
          : supabase.from('recipes').select('total_minutes').in('visibility', ['public', 'shared_link']).not('total_minutes', 'is', null);
        const { data } = await query;
        for (const row of data ?? []) {
          const mins = row.total_minutes ?? 0;
          if (mins <= 15) counts['15'] = (counts['15'] ?? 0) + 1;
          if (mins <= 30) counts['30'] = (counts['30'] ?? 0) + 1;
          if (mins <= 60) counts['60'] = (counts['60'] ?? 0) + 1;
          if (mins <= 120) counts['120'] = (counts['120'] ?? 0) + 1;
        }
      }
    } catch (err) {
      console.error('Error fetching filter counts:', err);
    }

    setFilterCounts(counts);
    setLoadingCounts(false);
  }, [session?.user?.id, mode]);

  // Check if any nutrition filter is active
  const hasNutritionFilter = useMemo(() => {
    return activeFilters.some((f) => ['calories', 'protein', 'nutritionPreset'].includes(f.type));
  }, [activeFilters]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bgScreen }}
    >
      <ChefsBookHeader />

      {/* Scope tabs: All / My Recipes / Following / What's New — 2×2 grid */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 12,
          marginBottom: 4,
        }}
      >
        {([
          { key: 'all', labelKey: 'search.allRecipes' },
          { key: 'mine', labelKey: 'search.myRecipes' },
          { key: 'following', labelKey: 'search.following' },
          { key: 'whats-new', labelKey: 'search.whatsNew' },
        ] as const).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => switchMode(tab.key)}
            style={{
              width: '48%',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              borderRadius: 20,
              backgroundColor: mode === tab.key ? '#ce2b37' : colors.bgBase,
              borderWidth: 1,
              borderColor: mode === tab.key ? '#ce2b37' : colors.borderDefault,
            }}
          >
            <Text
              style={{
                color: mode === tab.key ? '#ffffff' : colors.textPrimary,
                fontSize: 14,
                fontWeight: mode === tab.key ? '600' : '400',
              }}
            >
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search bar */}
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.bgBase,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            borderRadius: 12,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            placeholder={mode === 'mine' ? t('search.searchRecipes') : t('search.discoverRecipes')}
            placeholderTextColor={colors.textMuted}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingLeft: 8,
              fontSize: 15,
              color: colors.textPrimary,
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Collapsed filter summary bar - shown when filters active and collapsed */}
      {activeFilters.length > 0 && !filtersExpanded && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFiltersExpanded(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.accentSoft,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: colors.accent,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="filter" size={16} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                {t('search.filtersActive', { count: activeFilters.length })}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.accent} style={{ marginLeft: 6 }} />
            </View>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                setActiveFilters([]);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.accent} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter category chips - stacked in rows (shown when no filters or expanded) */}
      {(activeFilters.length === 0 || filtersExpanded) && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.map((cat) => {
              const isActive = activeFilters.some((f) => f.type === cat.key);
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => {
                    if (cat.key === 'favourites') {
                      if (isActive) removeFilter('favourites', 'true');
                      else addFilter('favourites', 'true', t('search.favoritesOnly'));
                    } else {
                      setFilterSheetCategory(cat.key);
                      setFilterSheetSearch('');
                      setFilterCounts({});
                      fetchFilterCounts(cat.key);
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isActive ? colors.accentSoft : colors.bgBase,
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: isActive ? colors.accent : colors.borderDefault,
                    minHeight: 32,
                  }}
                >
                  <Ionicons name={cat.icon} size={14} color={isActive ? colors.accent : colors.textSecondary} />
                  <Text style={{ color: isActive ? colors.accent : colors.textSecondary, fontSize: 12, fontWeight: '500', marginLeft: 4 }}>
                    {t(cat.labelKey)}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={isActive ? colors.accent : colors.textMuted} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Active filter pills (shown when expanded) */}
      {activeFilters.length > 0 && filtersExpanded && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, maxHeight: 44, marginBottom: 8 }}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {activeFilters.map((f) => (
            <TouchableOpacity
              key={`${f.type}-${f.value}`}
              onPress={() => removeFilter(f.type, f.value)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.accentSoft,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginRight: 8,
                minHeight: 32,
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{f.label}</Text>
              <Ionicons name="close" size={14} color={colors.accent} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setActiveFilters([])}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              minHeight: 32,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('search.clearAll')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Filter bottom sheet modal */}
      <FilterBottomSheet
        visible={!!filterSheetCategory}
        category={filterSheetCategory}
        categoryLabel={filterSheetCategory ? t(categories.find((c) => c.key === filterSheetCategory)?.labelKey ?? '') : ''}
        options={filterSheetCategory ? getSubcategoryOptions(filterSheetCategory) : []}
        activeFilters={activeFilters}
        search={filterSheetSearch}
        onSearchChange={setFilterSheetSearch}
        onToggle={(value, label) => {
          if (!filterSheetCategory) return;
          const isActive = activeFilters.some((f) => f.type === filterSheetCategory && f.value === value);
          if (isActive) removeFilter(filterSheetCategory, value);
          else addFilter(filterSheetCategory, value, label);
        }}
        onClear={() => {
          if (!filterSheetCategory) return;
          setActiveFilters((prev) => prev.filter((f) => f.type !== filterSheetCategory));
        }}
        onClose={() => setFilterSheetCategory(null)}
        onAddText={(type, value, label) => { addFilter(type, value, label); }}
        colors={colors}
        counts={filterCounts}
        loadingCounts={loadingCounts}
      />

      <ScrollView style={{ flex: 1 }}>
        {/* Results */}
        {loading && <Loading message={t('common.loading')} />}

        {/* People results */}
        {peopleResults.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>{t('search.people')}</Text>
            {peopleResults.map((user) => (
              <TouchableOpacity
                key={user.id}
                onPress={() => router.push(`/chef/${user.id}`)}
                style={{
                  flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 6,
                  backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: colors.borderDefault,
                }}
              >
                <Avatar uri={user.avatar_url} initials={getInitials(user.display_name)} size={40} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>@{user.username}</Text>
                    {verifiedPeopleIds.has(user.id) && <VerifiedBadge size="sm" />}
                  </View>
                  {user.display_name && (
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{user.display_name}</Text>
                  )}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{user.follower_count} {t('profile.followers').toLowerCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {hasSearched && !loading && (
          <View style={{ padding: 16, paddingTop: 0 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: hasNutritionFilter ? 4 : 12 }}>
              {t('search.recipesFound', { count: results.length })}
            </Text>
            {hasNutritionFilter && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 4 }}>
                  {t('search.nutritionFilterNote')}
                </Text>
              </View>
            )}
            {results.length === 0 ? (
              mode === 'following' ? (
                <EmptyState
                  icon="👥"
                  title={t('search.noFollowingRecipes')}
                  message={t('search.followChefsMessage')}
                  action={{ label: t('search.browseChefs'), onPress: () => router.push('/chef/search') }}
                />
              ) : mode === 'whats-new' ? (
                <EmptyState
                  icon="✨"
                  title={t('search.noTrendingRecipes')}
                  message={t('search.beFirstToTrend')}
                />
              ) : mode === 'all' ? (
                <EmptyState
                  icon="🌍"
                  title={t('search.noPublicRecipes')}
                  message={t('search.beFirstToShare')}
                />
              ) : (
                <EmptyState
                  icon="🔍"
                  title={t('search.noMatch')}
                  message={t('search.tryDifferent')}
                />
              )
            ) : (
              results.map((recipe) => (
                <View key={recipe.id} style={{ marginBottom: mode === 'all' ? 4 : 0 }}>
                  <RecipeCard
                    title={translatedTitles[recipe.id] ?? recipe.title}
                    imageUrl={primaryPhotos[recipe.id] ?? recipe.image_url}
                    cuisine={recipe.cuisine}
                    totalMinutes={recipe.total_minutes}
                    isFavourite={mode === 'mine' ? recipe.is_favourite : undefined}
                    likeCount={recipe.like_count}
                    saveCount={recipe.save_count}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                  />
                  {mode === 'all' && recipe.user_id !== session?.user?.id && (
                    <TouchableOpacity
                      onPress={() => handleClone(recipe.id)}
                      disabled={cloning === recipe.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.accentGreenSoft,
                        borderRadius: 8,
                        paddingVertical: 8,
                        marginBottom: 12,
                        marginTop: -4,
                        opacity: cloning === recipe.id ? 0.5 : 1,
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={colors.accentGreen} />
                      <Text style={{ color: colors.accentGreen, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                        {cloning === recipe.id ? t('search.adding') : t('search.addToCollection')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: tabBarHeight }} />
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

// ── Filter Bottom Sheet ──

function FilterBottomSheet({
  visible, category, categoryLabel, options, activeFilters, search, onSearchChange,
  onToggle, onClear, onClose, onAddText, colors, counts, loadingCounts,
}: {
  visible: boolean;
  category: string | null;
  categoryLabel: string;
  options: { label: string; value: string }[];
  activeFilters: { type: string; value: string; label: string }[];
  search: string;
  onSearchChange: (s: string) => void;
  onToggle: (value: string, label: string) => void;
  onClear: () => void;
  onClose: () => void;
  onAddText: (type: string, value: string, label: string) => void;
  colors: any;
  counts: Record<string, number>;
  loadingCounts: boolean;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isTextInput = category === 'ingredient' || category === 'tags';
  const [textValue, setTextValue] = useState('');

  // Filter options by search and hide zero-count options (once counts are loaded)
  const filtered = useMemo(() => {
    let opts = options;
    // Hide options with 0 count (only after counts are loaded)
    if (!loadingCounts && Object.keys(counts).length > 0) {
      opts = opts.filter((o) => (counts[o.value] ?? 0) > 0);
    }
    if (!search.trim()) return opts;
    const q = search.toLowerCase();
    return opts.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search, counts, loadingCounts]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingTop: 16 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('search.filterBy', { category: categoryLabel })}</Text>
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <TouchableOpacity onPress={onClear}>
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{t('common.clear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Text input for ingredient/tags */}
          {isTextInput && (
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
              <TextInput
                value={textValue}
                onChangeText={setTextValue}
                placeholder={category === 'ingredient' ? t('search.ingredientPlaceholder') : t('search.tagPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (textValue.trim() && category) {
                    const prefix = category === 'ingredient' ? '🥕 ' : '🏷 ';
                    onAddText(category, textValue.trim().toLowerCase(), `${prefix}${textValue.trim()}`);
                    setTextValue('');
                  }
                }}
                style={{
                  flex: 1, backgroundColor: colors.bgBase, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                  fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault,
                }}
              />
              <TouchableOpacity
                onPress={() => {
                  if (textValue.trim() && category) {
                    const prefix = category === 'ingredient' ? '🥕 ' : '🏷 ';
                    onAddText(category, textValue.trim().toLowerCase(), `${prefix}${textValue.trim()}`);
                    setTextValue('');
                  }
                }}
                style={{
                  backgroundColor: textValue.trim() ? colors.accent : colors.bgBase,
                  borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center',
                }}
              >
                <Text style={{ color: textValue.trim() ? '#fff' : colors.textMuted, fontWeight: '600' }}>{t('common.add')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search input for long option lists */}
          {!isTextInput && options.length > 8 && (
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <TextInput
                value={search}
                onChangeText={onSearchChange}
                placeholder={t('search.searchPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                style={{
                  backgroundColor: colors.bgBase, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                  fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault,
                }}
              />
            </View>
          )}

          {/* Option rows */}
          {!isTextInput && (
            <ScrollView style={{ maxHeight: 400 }}>
              {loadingCounts && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('common.loading')}</Text>
                </View>
              )}
              {!loadingCounts && filtered.length === 0 && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('search.noOptionsAvailable')}</Text>
                </View>
              )}
              {!loadingCounts && filtered.map((opt) => {
                const isActive = activeFilters.some((f) => f.type === category && f.value === opt.value);
                const count = counts[opt.value] ?? 0;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => onToggle(opt.value, opt.label)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: 16, paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: colors.borderDefault,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Text style={{ color: isActive ? colors.accent : colors.textPrimary, fontSize: 15, fontWeight: isActive ? '600' : '400' }}>
                        {opt.label}
                      </Text>
                      {count > 0 && (
                        <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 6 }}>
                          ({count})
                        </Text>
                      )}
                    </View>
                    {isActive && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Apply button */}
          <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('common.apply')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
