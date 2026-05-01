import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  PanResponder,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useTheme } from '../../context/ThemeContext';
import { useMenuStore } from '../../lib/zustand/menuStore';
import { getPrimaryPhotos, supabase } from '@chefsbook/db';
import { COURSE_ORDER, COURSE_LABELS, type MenuCourse } from '@chefsbook/db';
import ChefsDialog from '../../components/ChefsDialog';
import { Button } from '../../components/UIKit';

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecipeStep {
  recipeId: string;
  recipeTitle: string;
  course: MenuCourse;
  stepNumber: number;
  instruction: string;
  timerMinutes: number | null;
}

interface TimelineRecipe {
  id: string;
  title: string;
  course: MenuCourse;
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
  imageUrl: string | null;
  ingredients: { ingredient: string; quantity: number | null; unit: string | null }[];
  steps: { step_number: number; instruction: string }[];
}

type ViewMode = 'timeline' | 'stepByStep';

export default function CookMenuScreen() {
  useKeepAwake();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const currentMenu = useMenuStore((s) => s.currentMenu);
  const loading = useMenuStore((s) => s.loading);
  const fetchMenu = useMenuStore((s) => s.fetchMenu);

  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});
  const [timelineRecipes, setTimelineRecipes] = useState<TimelineRecipe[]>([]);
  const [allSteps, setAllSteps] = useState<RecipeStep[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [checkedRecipes, setCheckedRecipes] = useState<Set<string>>(new Set());
  const [showServeTimePicker, setShowServeTimePicker] = useState(false);
  const [serveTime, setServeTime] = useState<Date | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const panX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (id) {
      fetchMenu(id);
    }
  }, [id]);

  useEffect(() => {
    if (currentMenu?.menu_items) {
      loadRecipeData();
    }
  }, [currentMenu]);

  const loadRecipeData = async () => {
    if (!currentMenu) return;

    const recipeIds = currentMenu.menu_items.map((item) => item.recipe_id);
    if (recipeIds.length === 0) return;

    const photos = await getPrimaryPhotos(recipeIds);
    setPrimaryPhotos(photos);

    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, title, prep_minutes, cook_minutes, image_url')
      .in('id', recipeIds);

    const { data: allIngredients } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredient, quantity, unit')
      .in('recipe_id', recipeIds);

    const { data: allStepsData } = await supabase
      .from('recipe_steps')
      .select('recipe_id, step_number, instruction, timer_minutes')
      .in('recipe_id', recipeIds)
      .order('step_number');

    const ingredientsByRecipe = new Map<string, typeof allIngredients>();
    for (const ing of allIngredients ?? []) {
      const list = ingredientsByRecipe.get(ing.recipe_id) ?? [];
      list.push(ing);
      ingredientsByRecipe.set(ing.recipe_id, list);
    }

    const stepsByRecipe = new Map<string, typeof allStepsData>();
    for (const step of allStepsData ?? []) {
      const list = stepsByRecipe.get(step.recipe_id) ?? [];
      list.push(step);
      stepsByRecipe.set(step.recipe_id, list);
    }

    const courseMap = new Map<string, MenuCourse>();
    for (const item of currentMenu.menu_items) {
      courseMap.set(item.recipe_id, item.course);
    }

    const timeline: TimelineRecipe[] = (recipes ?? [])
      .map((r) => ({
        id: r.id,
        title: r.title,
        course: courseMap.get(r.id) ?? 'other',
        prepMinutes: r.prep_minutes ?? 0,
        cookMinutes: r.cook_minutes ?? 0,
        totalMinutes: (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0),
        imageUrl: photos[r.id] ?? r.image_url,
        ingredients: ingredientsByRecipe.get(r.id) ?? [],
        steps: (stepsByRecipe.get(r.id) ?? []).map((s) => ({
          step_number: s.step_number,
          instruction: s.instruction,
        })),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    setTimelineRecipes(timeline);

    const steps: RecipeStep[] = [];
    for (const course of COURSE_ORDER) {
      const courseRecipes = timeline.filter((r) => r.course === course);
      for (const recipe of courseRecipes) {
        const recipeSteps = stepsByRecipe.get(recipe.id) ?? [];
        for (const step of recipeSteps) {
          steps.push({
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            course,
            stepNumber: step.step_number,
            instruction: step.instruction,
            timerMinutes: step.timer_minutes,
          });
        }
      }
    }
    setAllSteps(steps);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          panX.setValue(g.dx);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -50 && currentStepIndex < allSteps.length - 1) {
            setCurrentStepIndex((i) => i + 1);
          } else if (g.dx > 50 && currentStepIndex > 0) {
            setCurrentStepIndex((i) => i - 1);
          }
          Animated.spring(panX, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [currentStepIndex, allSteps.length]
  );

  const toggleRecipeCheck = (recipeId: string) => {
    setCheckedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });
  };

  const getStartMinutes = (recipe: TimelineRecipe): number | null => {
    if (!serveTime) return null;
    const maxTotal = Math.max(...timelineRecipes.map((r) => r.totalMinutes));
    const offset = maxTotal - recipe.totalMinutes;
    return offset;
  };

  const formatStartLabel = (recipe: TimelineRecipe): string | null => {
    const offset = getStartMinutes(recipe);
    if (offset === null) return null;
    if (offset === 0) return t('menus.startNow');
    return t('menus.startBefore', { minutes: offset });
  };

  const allChecked = timelineRecipes.length > 0 && checkedRecipes.size === timelineRecipes.length;

  const currentStep = allSteps[currentStepIndex];
  const currentCourse = currentStep?.course;

  const getCourseDivider = (index: number): string | null => {
    if (index === 0) return COURSE_LABELS[allSteps[0]?.course];
    const prevCourse = allSteps[index - 1]?.course;
    const thisCourse = allSteps[index]?.course;
    if (prevCourse !== thisCourse) {
      return COURSE_LABELS[thisCourse];
    }
    return null;
  };

  const handleExit = () => {
    setShowExitDialog(true);
  };

  const confirmExit = () => {
    setShowExitDialog(false);
    router.back();
  };

  if (loading || !currentMenu) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>{t('menus.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: colors.bgCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderDefault,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={handleExit} style={{ marginRight: 12 }}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
            {currentMenu.title}
          </Text>
        </View>

        {/* Segmented control */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setViewMode('timeline')}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: viewMode === 'timeline' ? colors.accent : colors.bgBase,
              borderTopLeftRadius: 8,
              borderBottomLeftRadius: 8,
              borderWidth: 1,
              borderColor: viewMode === 'timeline' ? colors.accent : colors.borderDefault,
            }}
          >
            <Text style={{ fontWeight: '600', color: viewMode === 'timeline' ? '#fff' : colors.textPrimary }}>
              {t('menus.timeline')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('stepByStep')}
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: viewMode === 'stepByStep' ? colors.accent : colors.bgBase,
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
              borderWidth: 1,
              borderLeftWidth: 0,
              borderColor: viewMode === 'stepByStep' ? colors.accent : colors.borderDefault,
            }}
          >
            <Text style={{ fontWeight: '600', color: viewMode === 'stepByStep' ? '#fff' : colors.textPrimary }}>
              {t('menus.stepByStep')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'timeline' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 120 }}>
          {/* Serve time picker */}
          <TouchableOpacity
            onPress={() => setShowServeTimePicker(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              padding: 12,
              backgroundColor: colors.bgCard,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.borderDefault,
            }}
          >
            <Ionicons name="time-outline" size={20} color={colors.accent} />
            <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 14 }}>
              {serveTime
                ? `${t('menus.serveAt')}: ${serveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : t('menus.setServeTime')}
            </Text>
            {serveTime && (
              <TouchableOpacity onPress={() => setServeTime(null)}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Time Picker Modal */}
          <Modal visible={showServeTimePicker} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, width: 280 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 16 }}>
                  {t('menus.setServeTime')}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                  <ScrollView style={{ height: 120, width: 60 }} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          const d = serveTime ? new Date(serveTime) : new Date();
                          d.setHours(i);
                          setServeTime(d);
                        }}
                        style={{
                          padding: 8,
                          alignItems: 'center',
                          backgroundColor: serveTime?.getHours() === i ? colors.accentSoft : 'transparent',
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ fontSize: 16, color: serveTime?.getHours() === i ? colors.accent : colors.textPrimary }}>
                          {i.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary }}>:</Text>
                  <ScrollView style={{ height: 120, width: 60 }} showsVerticalScrollIndicator={false}>
                    {[0, 15, 30, 45].map((m) => (
                      <TouchableOpacity
                        key={m}
                        onPress={() => {
                          const d = serveTime ? new Date(serveTime) : new Date();
                          d.setMinutes(m);
                          setServeTime(d);
                        }}
                        style={{
                          padding: 8,
                          alignItems: 'center',
                          backgroundColor: serveTime?.getMinutes() === m ? colors.accentSoft : 'transparent',
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ fontSize: 16, color: serveTime?.getMinutes() === m ? colors.accent : colors.textPrimary }}>
                          {m.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  <TouchableOpacity
                    onPress={() => setShowServeTimePicker(false)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.bgBase, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowServeTimePicker(false)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.ok')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Recipe rows */}
          {timelineRecipes.map((recipe) => {
            const isExpanded = expandedRecipeId === recipe.id;
            const isChecked = checkedRecipes.has(recipe.id);
            const startLabel = formatStartLabel(recipe);
            const barWidth = recipe.totalMinutes > 0 ? (recipe.totalMinutes / Math.max(...timelineRecipes.map((r) => r.totalMinutes))) * 100 : 0;
            const prepWidth = recipe.totalMinutes > 0 ? (recipe.prepMinutes / recipe.totalMinutes) * 100 : 0;

            return (
              <View
                key={recipe.id}
                style={{
                  backgroundColor: colors.bgCard,
                  borderRadius: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                  overflow: 'hidden',
                }}
              >
                <TouchableOpacity
                  onPress={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}
                  style={{ flexDirection: 'row', padding: 12, alignItems: 'center' }}
                >
                  {/* Recipe image */}
                  <View style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.bgBase, marginRight: 12 }}>
                    {recipe.imageUrl ? (
                      <Image
                        source={{ uri: recipe.imageUrl, headers: { apikey: SUPABASE_ANON_KEY } }}
                        style={{ width: 48, height: 48 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="restaurant-outline" size={20} color={colors.textMuted} />
                      </View>
                    )}
                  </View>

                  {/* Recipe info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {recipe.title}
                      </Text>
                      {startLabel && (
                        <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '500' }}>{startLabel}</Text>
                      )}
                    </View>

                    {recipe.totalMinutes > 0 ? (
                      <>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                          {t('menus.prepLabel')}: {recipe.prepMinutes}m | {t('menus.cookLabel')}: {recipe.cookMinutes}m
                        </Text>
                        {/* Time bar */}
                        <View style={{ height: 8, backgroundColor: colors.bgBase, borderRadius: 4, marginTop: 6, overflow: 'hidden', width: `${barWidth}%` }}>
                          <View style={{ height: '100%', flexDirection: 'row' }}>
                            <View style={{ width: `${prepWidth}%`, backgroundColor: colors.accent }} />
                            <View style={{ flex: 1, backgroundColor: '#f5a623' }} />
                          </View>
                        </View>
                      </>
                    ) : (
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' }}>
                        {t('menus.noTimeEstimate')}
                      </Text>
                    )}
                  </View>

                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} style={{ marginLeft: 8 }} />
                </TouchableOpacity>

                {/* Expanded content */}
                {isExpanded && (
                  <View style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.borderDefault }}>
                    {recipe.ingredients.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>
                          {t('recipe.ingredients')}
                        </Text>
                        {recipe.ingredients.slice(0, 5).map((ing, i) => (
                          <Text key={i} style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 2 }}>
                            • {ing.quantity ?? ''} {ing.unit ?? ''} {ing.ingredient}
                          </Text>
                        ))}
                        {recipe.ingredients.length > 5 && (
                          <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
                            +{recipe.ingredients.length - 5} more
                          </Text>
                        )}
                      </View>
                    )}

                    {recipe.steps.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>
                          {t('recipe.steps')}
                        </Text>
                        {recipe.steps.slice(0, 3).map((step) => (
                          <Text key={step.step_number} style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                            {step.step_number}. {step.instruction}
                          </Text>
                        ))}
                        {recipe.steps.length > 3 && (
                          <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
                            +{recipe.steps.length - 3} more steps
                          </Text>
                        )}
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => router.push(`/recipe/${recipe.id}` as any)}
                      style={{ marginTop: 12, alignSelf: 'flex-start' }}
                    >
                      <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '600' }}>
                        {t('menus.goToRecipe')} →
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {/* All prepped checklist */}
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>
              {t('menus.allPreppedQuestion')}
            </Text>
            {timelineRecipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                onPress={() => toggleRecipeCheck(recipe.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderDefault,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: checkedRecipes.has(recipe.id) ? colors.accentGreen : colors.borderDefault,
                    backgroundColor: checkedRecipes.has(recipe.id) ? colors.accentGreen : 'transparent',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  {checkedRecipes.has(recipe.id) && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{recipe.title} — {t('menus.ready')}</Text>
              </TouchableOpacity>
            ))}

            {allChecked && (
              <View
                style={{
                  marginTop: 16,
                  padding: 16,
                  backgroundColor: colors.accentGreenSoft,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.accentGreen }}>
                  {t('menus.allPrepped')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        /* Step by Step view */
        <View style={{ flex: 1 }} {...panResponder.panHandlers}>
          {allSteps.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('menus.noSteps')}</Text>
            </View>
          ) : (
            <>
              {/* Progress indicator */}
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                  {t('menus.stepOf', { current: currentStepIndex + 1, total: allSteps.length })}
                </Text>
              </View>

              {/* Course divider */}
              {getCourseDivider(currentStepIndex) && (
                <View
                  style={{
                    marginHorizontal: 16,
                    marginBottom: 16,
                    padding: 16,
                    backgroundColor: colors.bgCard,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.accent }}>
                    {t('menus.nowStartingCourse', { course: getCourseDivider(currentStepIndex) })}
                  </Text>
                </View>
              )}

              {/* Step card */}
              <Animated.View
                style={{
                  flex: 1,
                  marginHorizontal: 16,
                  transform: [{ translateX: panX }],
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.bgCard,
                    borderRadius: 16,
                    padding: 24,
                    borderWidth: 1,
                    borderColor: colors.borderDefault,
                  }}
                >
                  {/* Recipe title */}
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>
                    {currentStep.recipeTitle}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
                    Step {currentStep.stepNumber}
                  </Text>

                  {/* Instruction */}
                  <ScrollView style={{ flex: 1 }}>
                    <Text style={{ fontSize: 20, color: colors.textPrimary, lineHeight: 30 }}>
                      {currentStep.instruction}
                    </Text>

                    {currentStep.timerMinutes && (
                      <View
                        style={{
                          marginTop: 20,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          padding: 12,
                          backgroundColor: colors.accentSoft,
                          borderRadius: 10,
                        }}
                      >
                        <Ionicons name="timer-outline" size={20} color={colors.accent} />
                        <Text style={{ color: colors.accent, fontWeight: '600' }}>
                          {currentStep.timerMinutes} {t('menus.minutes')}
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </Animated.View>

              {/* Navigation buttons */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  padding: 16,
                  paddingBottom: insets.bottom + 16,
                  backgroundColor: colors.bgScreen,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Button
                    title={t('common.prev')}
                    onPress={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
                    variant="secondary"
                    disabled={currentStepIndex === 0}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  {currentStepIndex < allSteps.length - 1 ? (
                    <Button title={t('common.next')} onPress={() => setCurrentStepIndex((i) => i + 1)} />
                  ) : (
                    <Button title={t('common.done')} onPress={confirmExit} />
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* Exit confirmation dialog */}
      <ChefsDialog
        visible={showExitDialog}
        title={t('menus.exitCooking')}
        body={t('menus.exitCookingBody')}
        onClose={() => setShowExitDialog(false)}
        buttons={[
          { label: t('common.cancel'), variant: 'cancel', onPress: () => setShowExitDialog(false) },
          { label: t('common.exit'), variant: 'secondary', onPress: confirmExit },
        ]}
      />
    </View>
  );
}
