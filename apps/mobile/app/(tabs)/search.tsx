import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { listRecipes, listPublicRecipes, cloneRecipe, searchByIngredient, searchUsers, getFollowedRecipes, getFollowingCount } from '@chefsbook/db';
import type { Recipe, UserProfile } from '@chefsbook/db';
import { Avatar } from '../../components/UIKit';
import { getInitials } from '@chefsbook/ui';
import { DIETARY_FLAGS, CUISINE_LIST, COURSE_LIST } from '@chefsbook/ui';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { RecipeCard, EmptyState, Loading } from '../../components/UIKit';

type SearchMode = 'my' | 'discover';

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
  { key: 'tags', labelKey: 'search.tags', icon: 'pricetag-outline' },
  { key: 'time', labelKey: 'search.cookTime', icon: 'time-outline' },
  { key: 'source', labelKey: 'search.source', icon: 'link-outline' },
  { key: 'favourites', labelKey: 'search.favorites', icon: 'heart' },
];

const DISCOVER_CATEGORIES: { key: string; labelKey: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'cuisine', labelKey: 'search.cuisine', icon: 'earth-outline' },
  { key: 'course', labelKey: 'search.course', icon: 'restaurant-outline' },
  { key: 'dietary', labelKey: 'search.dietary', icon: 'leaf-outline' },
];

// Use CUISINE_LIST and COURSE_LIST from @chefsbook/ui
const TIME_OPTION_KEYS = [
  { labelKey: 'search.under15', value: 15 },
  { labelKey: 'search.under30', value: 30 },
  { labelKey: 'search.under60', value: 60 },
  { labelKey: 'search.under2h', value: 120 },
];
const SOURCE_OPTIONS = ['url', 'scan', 'manual', 'voice', 'youtube'];

export default function SearchTab() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { q: initialQuery } = useLocalSearchParams<{ q?: string }>();
  const session = useAuthStore((s) => s.session);
  const searchRef = useRef<TextInput>(null);

  const [mode, setMode] = useState<SearchMode>('discover');
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
  const [peopleResults, setPeopleResults] = useState<UserProfile[]>([]);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [feedRecipes, setFeedRecipes] = useState<(Recipe & { author_username: string | null; author_avatar: string | null })[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [followingCountVal, setFollowingCountVal] = useState(0);
  const insets = useSafeAreaInsets();

  // Load following count on mount
  useEffect(() => {
    if (session?.user?.id) {
      getFollowingCount(session.user.id).then(setFollowingCountVal);
    }
  }, [session?.user?.id]);

  const loadFeed = async () => {
    if (!session?.user?.id) return;
    setFeedLoading(true);
    const data = await getFollowedRecipes(session.user.id);
    setFeedRecipes(data);
    setFeedLoading(false);
  };

  const openWhatsNew = () => {
    setShowWhatsNew(true);
    loadFeed();
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t('follow.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('follow.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('follow.daysAgo', { count: days });
  };

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
    if (query.trim()) {
      searchUsers(query.trim()).then(setPeopleResults).catch(() => {});
    }

    // Ingredient filter: search by ingredient first, then intersect
    const ingredientFilters = activeFilters.filter((f) => f.type === 'ingredient');
    const dietaryFilters = activeFilters.filter((f) => f.type === 'dietary');

    if (mode === 'my') {
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
      setResults(data);
    } else {
      const data = await listPublicRecipes({
        search: query.trim() || undefined,
        cuisine: params.cuisine,
        course: params.course,
      });
      // Dietary filter for discover mode
      let filtered = data;
      if (dietaryFilters.length > 0) {
        filtered = data.filter((r) =>
          dietaryFilters.every((f) => (r.dietary_flags ?? []).includes(f.value))
        );
      }
      setResults(filtered);
    }
    setLoading(false);
  }, [session?.user?.id, query, activeFilters, filterParams, mode]);

  useEffect(() => {
    const timeout = setTimeout(doSearch, 300);
    return () => clearTimeout(timeout);
  }, [query, activeFilters]);

  // Auto-load discover feed on mode switch
  useEffect(() => {
    if (mode === 'discover' && !hasSearched && results.length === 0) {
      (async () => {
        setLoading(true);
        const data = await listPublicRecipes({ limit: 50 });
        setResults(data);
        setHasSearched(true);
        setLoading(false);
      })();
    }
  }, [mode]);

  const handleClone = async (recipeId: string) => {
    if (!session?.user?.id) return;
    setCloning(recipeId);
    try {
      await cloneRecipe(recipeId, session.user.id);
      Alert.alert(t('search.addedTitle'), t('search.addedMessage'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message ?? t('search.cloneFailed'));
    }
    setCloning(null);
  };

  const addFilter = (type: string, value: string, label: string) => {
    if (['cuisine', 'course', 'time', 'source', 'favourites'].includes(type)) {
      setActiveFilters((prev) => [...prev.filter((f) => f.type !== type), { type, value, label }]);
    } else {
      // Tags, dietary, and ingredient can have multiple
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
      default: return [];
    }
  };

  const categories = mode === 'my' ? CATEGORIES : DISCOVER_CATEGORIES;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />

      {/* Segmented toggle: My Recipes / Discover */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.bgBase,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            height: 44,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            onPress={() => switchMode('discover')}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: mode === 'discover' ? colors.accent : 'transparent',
              borderRadius: 22,
              margin: 2,
            }}
          >
            <Text
              style={{
                color: mode === 'discover' ? '#ffffff' : colors.textSecondary,
                fontSize: 14,
                fontWeight: '600',
              }}
            >
              {t('search.allRecipes')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => switchMode('my')}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: mode === 'my' ? colors.accent : 'transparent',
              borderRadius: 22,
              margin: 2,
            }}
          >
            <Text
              style={{
                color: mode === 'discover' ? '#ffffff' : colors.textSecondary,
                fontSize: 14,
                fontWeight: '600',
              }}
            >
              {t('search.discover')}
            </Text>
          </TouchableOpacity>
        </View>
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
            placeholder={mode === 'my' ? t('search.searchRecipes') : t('search.discoverRecipes')}
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

      {/* Active filter pills */}
      {activeFilters.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingHorizontal: 16, maxHeight: 44, marginBottom: 8 }}
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

      <ScrollView style={{ flex: 1 }}>
        {/* What's New card */}
        {!hasSearched && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, marginBottom: 4 }}>
            <TouchableOpacity
              onPress={followingCountVal > 0 ? openWhatsNew : () => router.push('/chef/search')}
              style={{
                backgroundColor: colors.bgCard,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.borderDefault,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: colors.accentSoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="sparkles" size={22} color={colors.accent} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>
                  {t('follow.whatsNew')}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {followingCountVal > 0
                    ? t('follow.whatsNewSub')
                    : t('follow.whatsNewEmpty')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Category cards (show when no search active) */}
        {!hasSearched && (
          <View style={{ padding: 16, paddingTop: 8 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
              {mode === 'my' ? t('search.browseCategory') : t('search.exploreCategory')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => {
                    if (cat.key === 'favourites') {
                      const isActive = activeFilters.some((f) => f.type === 'favourites');
                      if (isActive) {
                        removeFilter('favourites', 'true');
                      } else {
                        addFilter('favourites', 'true', t('search.favoritesOnly'));
                      }
                      return;
                    }
                    // Open bottom sheet for all other categories
                    setFilterSheetCategory(cat.key);
                    setFilterSheetSearch('');
                  }}
                  style={{
                    width: '47%',
                    backgroundColor: cat.key === 'favourites' && activeFilters.some((f) => f.type === 'favourites')
                      ? colors.accentSoft : colors.bgCard,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: (cat.key === 'favourites' && activeFilters.some((f) => f.type === 'favourites'))
                      || expandedCategory === cat.key ? colors.accent : colors.borderDefault,
                    shadowColor: '#000',
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                    minHeight: 44,
                  }}
                >
                  <Ionicons
                    name={cat.icon}
                    size={24}
                    color={(cat.key === 'favourites' && activeFilters.some((f) => f.type === 'favourites'))
                      || expandedCategory === cat.key ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={{
                      color: expandedCategory === cat.key ? colors.accent : colors.textPrimary,
                      fontSize: 15,
                      fontWeight: '600',
                      marginTop: 8,
                    }}
                  >
                    {t(cat.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
            />

            {/* Legacy inline expansion — kept for ingredient/tags text input */}
            {expandedCategory && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                  {t(categories.find((c) => c.key === expandedCategory)?.labelKey ?? '')}
                </Text>

                {/* Ingredient: text input */}
                {expandedCategory === 'ingredient' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      value={ingredientInput}
                      onChangeText={setIngredientInput}
                      placeholder={t('search.ingredientPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (ingredientInput.trim()) {
                          addFilter('ingredient', ingredientInput.trim().toLowerCase(), `🥕 ${ingredientInput.trim()}`);
                          setIngredientInput('');
                        }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: colors.bgBase,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 14,
                        color: colors.textPrimary,
                        borderWidth: 1,
                        borderColor: colors.borderDefault,
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (ingredientInput.trim()) {
                          addFilter('ingredient', ingredientInput.trim().toLowerCase(), `🥕 ${ingredientInput.trim()}`);
                          setIngredientInput('');
                        }
                      }}
                      style={{
                        backgroundColor: ingredientInput.trim() ? colors.accent : colors.bgBase,
                        borderRadius: 8,
                        paddingHorizontal: 16,
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: ingredientInput.trim() ? '#ffffff' : colors.textSecondary, fontWeight: '600', fontSize: 14 }}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Tags: text input */}
                {expandedCategory === 'tags' && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      value={tagInput}
                      onChangeText={setTagInput}
                      placeholder={t('search.tagPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (tagInput.trim()) {
                          addFilter('tags', tagInput.trim().toLowerCase(), `🏷 ${tagInput.trim()}`);
                          setTagInput('');
                        }
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: colors.bgBase,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        fontSize: 14,
                        color: colors.textPrimary,
                        borderWidth: 1,
                        borderColor: colors.borderDefault,
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (tagInput.trim()) {
                          addFilter('tags', tagInput.trim().toLowerCase(), `🏷 ${tagInput.trim()}`);
                          setTagInput('');
                        }
                      }}
                      style={{
                        backgroundColor: tagInput.trim() ? colors.accent : colors.bgBase,
                        borderRadius: 8,
                        paddingHorizontal: 16,
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: tagInput.trim() ? '#ffffff' : colors.textSecondary, fontWeight: '600', fontSize: 14 }}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Standard chip options (cuisine, course, dietary, etc.) */}
                {expandedCategory !== 'ingredient' && expandedCategory !== 'tags' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {getSubcategoryOptions(expandedCategory).map((opt) => {
                    const isActive = activeFilters.some(
                      (f) => f.type === expandedCategory && f.value === opt.value
                    );
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() =>
                          isActive
                            ? removeFilter(expandedCategory, opt.value)
                            : addFilter(expandedCategory, opt.value, opt.label)
                        }
                        style={{
                          backgroundColor: isActive ? colors.accent : colors.bgBase,
                          borderRadius: 20,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          minHeight: 36,
                        }}
                      >
                        <Text
                          style={{
                            color: isActive ? '#ffffff' : colors.textPrimary,
                            fontSize: 13,
                            fontWeight: isActive ? '600' : '400',
                          }}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                )}
              </View>
            )}
          </View>
        )}

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
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>@{user.username}</Text>
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
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>
              {t('search.recipesFound', { count: results.length })}
            </Text>
            {results.length === 0 ? (
              mode === 'discover' ? (
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
                <View key={recipe.id} style={{ marginBottom: mode === 'discover' ? 4 : 0 }}>
                  <RecipeCard
                    title={recipe.title}
                    imageUrl={recipe.image_url}
                    cuisine={recipe.cuisine}
                    totalMinutes={recipe.total_minutes}
                    isFavourite={mode === 'my' ? recipe.is_favourite : undefined}
                    saveCount={recipe.save_count}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                  />
                  {mode === 'discover' && recipe.user_id !== session?.user?.id && (
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

      {/* What's New Feed Modal */}
      <Modal visible={showWhatsNew} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ flex: 1, backgroundColor: colors.bgScreen, marginTop: 60, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={20} color={colors.accent} />
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('follow.whatsNew')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowWhatsNew(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
              {feedLoading ? (
                <Loading message={t('common.loading')} />
              ) : feedRecipes.length === 0 ? (
                <EmptyState icon="📭" title={t('follow.noFeedRecipes')} message={t('follow.noFeedRecipesMessage')} />
              ) : (
                feedRecipes.map((recipe) => (
                  <View key={recipe.id} style={{ marginBottom: 8 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4, paddingHorizontal: 4 }}>
                      @{recipe.author_username ?? '?'} · {timeAgo(recipe.created_at)}
                    </Text>
                    <RecipeCard
                      title={recipe.title}
                      imageUrl={recipe.image_url}
                      cuisine={recipe.cuisine}
                      totalMinutes={recipe.total_minutes}
                      saveCount={recipe.save_count}
                      onPress={() => { setShowWhatsNew(false); router.push(`/recipe/${recipe.id}`); }}
                    />
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Filter Bottom Sheet ──

function FilterBottomSheet({
  visible, category, categoryLabel, options, activeFilters, search, onSearchChange,
  onToggle, onClear, onClose, onAddText, colors,
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
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isTextInput = category === 'ingredient' || category === 'tags';
  const [textValue, setTextValue] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

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
              {filtered.map((opt) => {
                const isActive = activeFilters.some((f) => f.type === category && f.value === opt.value);
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
                    <Text style={{ color: isActive ? colors.accent : colors.textPrimary, fontSize: 15, fontWeight: isActive ? '600' : '400' }}>
                      {opt.label}
                    </Text>
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
