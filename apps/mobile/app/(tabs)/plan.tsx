import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActionSheetIOS, Platform, Modal, TextInput, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { useMealPlanStore } from '../../lib/zustand/mealPlanStore';
import { useShoppingStore } from '../../lib/zustand/shoppingStore';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { Card, EmptyState, Loading } from '../../components/UIKit';
import { suggestPurchaseUnits } from '@chefsbook/ai';
import type { MealSlot, Recipe } from '@chefsbook/db';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_SLOTS: { label: string; value: MealSlot }[] = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Lunch', value: 'lunch' },
  { label: 'Dinner', value: 'dinner' },
  { label: 'Snack', value: 'snack' },
];

function getWeekDates(startDate: string): string[] {
  const dates: string[] = [];
  const d = new Date(startDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(d).toISOString().split('T')[0]!);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export default function PlanTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const recipes = useRecipeStore((s) => s.recipes);
  const fetchRecipes = useRecipeStore((s) => s.fetchRecipes);
  const plans = useMealPlanStore((s) => s.plans);
  const loading = useMealPlanStore((s) => s.loading);
  const weekStart = useMealPlanStore((s) => s.weekStart);
  const setWeekStart = useMealPlanStore((s) => s.setWeekStart);
  const fetchWeek = useMealPlanStore((s) => s.fetchWeek);
  const addPlan = useMealPlanStore((s) => s.addPlan);
  const removePlan = useMealPlanStore((s) => s.removePlan);
  const shoppingLists = useShoppingStore((s) => s.lists);
  const fetchShoppingLists = useShoppingStore((s) => s.fetchLists);
  const addShoppingList = useShoppingStore((s) => s.addList);
  const addItemsPipeline = useShoppingStore((s) => s.addItemsPipeline);
  const tabBarHeight = useTabBarHeight();

  // Recipe picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>('dinner');
  const [adding, setAdding] = useState(false);

  // List picker for cart sync
  const [listPickerVisible, setListPickerVisible] = useState(false);
  const [cartDate, setCartDate] = useState<string | null>(null);
  const [cartDayIndex, setCartDayIndex] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showMealActions = (plan: any) => {
    const options = ['View recipe', 'Remove from plan', 'Cancel'];
    const destructiveIndex = 1;
    const cancelIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: destructiveIndex, cancelButtonIndex: cancelIndex },
        (idx) => handleMealAction(idx, plan),
      );
    } else {
      Alert.alert(
        (plan as any).recipe?.title ?? plan.meal_slot,
        'What would you like to do?',
        [
          { text: 'View recipe', onPress: () => plan.recipe_id && router.push(`/recipe/${plan.recipe_id}`) },
          { text: 'Remove from plan', style: 'destructive', onPress: () => confirmRemove(plan) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  };

  const handleMealAction = (idx: number, plan: any) => {
    if (idx === 0 && plan.recipe_id) router.push(`/recipe/${plan.recipe_id}`);
    if (idx === 1) confirmRemove(plan);
  };

  const confirmRemove = (plan: any) => {
    Alert.alert('Remove meal', `Remove "${(plan as any).recipe?.title ?? plan.meal_slot}" from this day?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await removePlan(plan.id);
        if (session?.user?.id && weekDates.length === 7) {
          fetchWeek(session.user.id, weekDates[0]!, weekDates[6]!);
        }
      }},
    ]);
  };

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  useEffect(() => {
    if (session?.user?.id && weekDates.length === 7) {
      fetchWeek(session.user.id, weekDates[0]!, weekDates[6]!);
    }
  }, [session?.user?.id, weekStart]);

  // Ensure recipes are loaded for the picker
  useEffect(() => {
    if (session?.user?.id && recipes.length === 0) {
      fetchRecipes(session.user.id);
    }
  }, [session?.user?.id]);

  const navigateWeek = (dir: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d.toISOString().split('T')[0]!);
  };

  const hasMeals = plans.length > 0;

  // Filtered recipes for picker
  const filteredRecipes = useMemo(() => {
    if (!pickerSearch.trim()) return recipes;
    const q = pickerSearch.toLowerCase();
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, pickerSearch]);

  const openPicker = (date: string) => {
    setPickerDate(date);
    setPickerSearch('');
    setSelectedRecipe(null);
    setSelectedSlot('dinner');
    setPickerVisible(true);
  };

  const handleAddToPlan = async () => {
    if (!session?.user?.id || !selectedRecipe || !pickerDate) return;
    setAdding(true);
    try {
      await addPlan(session.user.id, {
        plan_date: pickerDate,
        meal_slot: selectedSlot,
        recipe_id: selectedRecipe.id,
        servings: selectedRecipe.servings ?? 4,
        notes: null,
      });
      if (weekDates.length === 7) {
        await fetchWeek(session.user.id, weekDates[0]!, weekDates[6]!);
      }
      setPickerVisible(false);
      const dayName = DAYS[weekDates.indexOf(pickerDate)] ?? pickerDate;
      showToast(`Added to ${dayName} ${selectedSlot}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAdding(false);
    }
  };

  // Cart sync: add day's recipes to shopping list
  const openCartPicker = async (date: string, dayIndex: number) => {
    const dayPlans = plans.filter((p: any) => p.plan_date === date);
    const recipePlans = dayPlans.filter((p: any) => p.recipe_id);
    if (recipePlans.length === 0) {
      Alert.alert('No recipes', `No recipes planned for ${DAYS[dayIndex]}.`);
      return;
    }
    if (session?.user?.id) {
      await fetchShoppingLists(session.user.id);
    }
    setCartDate(date);
    setCartDayIndex(dayIndex);
    setListPickerVisible(true);
  };

  const handleAddDayToList = async (listId: string, listName: string) => {
    if (!session?.user?.id || !cartDate) return;
    setListPickerVisible(false);
    const dayPlans = plans.filter((p: any) => p.plan_date === cartDate && p.recipe_id);

    try {
      const items: { ingredient: string; quantity?: number | null; unit?: string | null; quantity_needed?: string | null; recipe_id?: string; recipe_name?: string }[] = [];
      for (const plan of dayPlans) {
        const recipe = (plan as any).recipe;
        if (!recipe) continue;
        const ingredients = recipe.ingredients ?? recipe.recipe_ingredients ?? [];
        for (const ing of ingredients) {
          items.push({
            ingredient: ing.ingredient,
            quantity: ing.quantity,
            unit: ing.unit,
            quantity_needed: [ing.quantity, ing.unit].filter(Boolean).join(' ') || null,
            recipe_id: plan.recipe_id!,
            recipe_name: recipe.title,
          });
        }
      }

      if (items.length === 0) {
        Alert.alert('No ingredients', 'The planned recipes have no ingredients to add.');
        return;
      }

      // Get AI purchase unit suggestions
      let aiSuggestions: Record<string, { purchase_unit: string; store_category: string }> = {};
      try {
        const aiResult = await suggestPurchaseUnits(items.map((i) => ({
          name: i.ingredient,
          quantity: i.quantity_needed || '',
        })));
        for (const s of aiResult) {
          aiSuggestions[s.ingredient.toLowerCase()] = { purchase_unit: s.purchase_unit, store_category: s.store_category };
        }
      } catch {}

      const result = await addItemsPipeline(listId, session.user.id, items, aiSuggestions);
      showToast(`Added to ${listName}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  if (loading) return <Loading message="Loading meal plan..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />

      {/* Toast */}
      {toastMessage && (
        <View style={{
          position: 'absolute', top: 100, left: 40, right: 40, zIndex: 100,
          backgroundColor: colors.accentGreen, borderRadius: 10, padding: 12,
          alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{toastMessage}</Text>
        </View>
      )}

      {/* Week navigation */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => navigateWeek(-1)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>
            <Ionicons name="chevron-back" size={16} color={colors.accent} /> Prev
          </Text>
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
          {weekDates[0]} — {weekDates[6]}
        </Text>
        <TouchableOpacity onPress={() => navigateWeek(1)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>
            Next <Ionicons name="chevron-forward" size={16} color={colors.accent} />
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add whole week to list */}
      {hasMeals && (
        <TouchableOpacity
          onPress={() => {
            if (session?.user?.id) {
              // Use the full week as a single "day" for cart sync
              const allRecipePlans = plans.filter((p: any) => p.recipe_id);
              if (allRecipePlans.length === 0) {
                Alert.alert('No recipes', 'No recipes planned this week.');
                return;
              }
              openCartPicker(weekDates[0]!, 0);
              // Override cartDate to use all week dates
              setCartDate('__week__');
            }
          }}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginHorizontal: 16, marginBottom: 8, paddingVertical: 10,
            backgroundColor: colors.accentGreenSoft, borderRadius: 10,
          }}
        >
          <Ionicons name="cart" size={18} color={colors.accentGreen} />
          <Text style={{ color: colors.accentGreen, fontSize: 14, fontWeight: '600' }}>Add week to shopping list</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        {!hasMeals ? (
          <EmptyState
            icon="📅"
            title="No meals planned this week"
            message="Tap + on any day to add a recipe."
            action={{ label: 'Browse Recipes', onPress: () => router.push('/(tabs)/search') }}
          />
        ) : (
          weekDates.map((date, i) => {
            const SLOT_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2 };
            const dayPlans = plans
              .filter((p: any) => p.plan_date === date)
              .sort((a: any, b: any) => (SLOT_ORDER[a.meal_slot?.toLowerCase()] ?? 9) - (SLOT_ORDER[b.meal_slot?.toLowerCase()] ?? 9));
            return (
              <Card
                key={date}
                style={{
                  marginBottom: 12,
                  shadowColor: '#000',
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View>
                    <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '700' }}>
                      {DAYS[i]}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  {/* Cart sync button */}
                  <TouchableOpacity
                    onPress={() => openCartPicker(date, i)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      backgroundColor: colors.bgBase,
                      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                      borderWidth: 1, borderColor: colors.borderDefault,
                    }}
                  >
                    <Ionicons name="cart-outline" size={14} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>Add to list</Text>
                  </TouchableOpacity>
                </View>
                {dayPlans.length === 0 ? (
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>No meals planned</Text>
                ) : (
                  dayPlans.map((plan: any) => (
                    <TouchableOpacity
                      key={plan.id}
                      onPress={() => plan.recipe_id && router.push(`/recipe/${plan.recipe_id}`)}
                      onLongPress={() => showMealActions(plan)}
                      delayLongPress={400}
                      style={{ paddingVertical: 6, minHeight: 44, justifyContent: 'center' }}
                    >
                      <Text style={{ color: colors.accent, fontSize: 11, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8 }}>
                        {plan.meal_slot}
                      </Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 15 }}>
                        {(plan as any).recipe?.title ?? plan.notes ?? 'No recipe'}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}

                {/* Add meal button */}
                <TouchableOpacity
                  onPress={() => openPicker(date)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginTop: 4 }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Add meal</Text>
                </TouchableOpacity>
              </Card>
            );
          })
        )}
        <View style={{ height: tabBarHeight }} />
      </ScrollView>

      {/* Recipe Picker Modal */}
      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            maxHeight: '85%', paddingTop: 16,
          }}>
            {/* Handle bar */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />

            {!selectedRecipe ? (
              // Step 1: Recipe search
              <View style={{ flex: 0, maxHeight: 500 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                    Add meal — {pickerDate && DAYS[weekDates.indexOf(pickerDate)]}
                  </Text>
                  <TouchableOpacity onPress={() => setPickerVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                  <TextInput
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                    placeholder="Search recipes..."
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                    style={{
                      backgroundColor: colors.bgBase, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                      fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault,
                    }}
                  />
                </View>
                <FlatList
                  data={filteredRecipes}
                  keyExtractor={(r) => r.id}
                  style={{ maxHeight: 380 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setSelectedRecipe(item)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
                        borderBottomWidth: 1, borderBottomColor: colors.borderDefault,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500' }}>{item.title}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          {[item.cuisine, item.course].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', padding: 20 }}>No recipes found</Text>
                  }
                />
              </View>
            ) : (
              // Step 2: Confirmation
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <TouchableOpacity onPress={() => setSelectedRecipe(null)}>
                    <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>
                      <Ionicons name="chevron-back" size={16} color={colors.accent} /> Back
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPickerVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>
                  {selectedRecipe.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 16 }}>
                  {[selectedRecipe.cuisine, selectedRecipe.course].filter(Boolean).join(' · ')}
                </Text>

                {/* Meal type selector */}
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Meal type</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {MEAL_SLOTS.map((slot) => (
                    <TouchableOpacity
                      key={slot.value}
                      onPress={() => setSelectedSlot(slot.value)}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                        backgroundColor: selectedSlot === slot.value ? colors.accent : colors.bgBase,
                        borderWidth: 1, borderColor: selectedSlot === slot.value ? colors.accent : colors.borderDefault,
                      }}
                    >
                      <Text style={{
                        color: selectedSlot === slot.value ? '#fff' : colors.textPrimary,
                        fontSize: 13, fontWeight: '600',
                      }}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Add button */}
                <TouchableOpacity
                  onPress={handleAddToPlan}
                  disabled={adding}
                  style={{
                    backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14,
                    alignItems: 'center', opacity: adding ? 0.6 : 1, marginBottom: 8,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                    {adding ? 'Adding...' : `Add to ${pickerDate && DAYS[weekDates.indexOf(pickerDate)]}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setPickerVisible(false)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Shopping List Picker Modal */}
      <Modal visible={listPickerVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 16, maxHeight: '60%',
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                Add to shopping list
              </Text>
              <TouchableOpacity onPress={() => setListPickerVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {shoppingLists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  onPress={() => handleAddDayToList(list.id, list.name)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
                    borderBottomWidth: 1, borderBottomColor: colors.borderDefault,
                  }}
                >
                  <Ionicons name="list" size={20} color={colors.accent} style={{ marginRight: 12 }} />
                  <Text style={{ color: colors.textPrimary, fontSize: 15, flex: 1 }}>{list.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={async () => {
                if (!session?.user?.id) return;
                const dayName = cartDate === '__week__' ? `Week of ${weekDates[0]}` : DAYS[cartDayIndex];
                const newList = await addShoppingList(session.user.id, `${dayName} meals`);
                handleAddDayToList(newList.id, newList.name);
              }}
              style={{
                backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14,
                alignItems: 'center', marginTop: 12,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>+ New Shopping List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
