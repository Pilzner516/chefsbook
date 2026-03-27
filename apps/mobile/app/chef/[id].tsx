import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '@chefsbook/db';
import type { UserProfile, Recipe } from '@chefsbook/db';
import { Avatar, RecipeCard, Loading, EmptyState } from '../../components/UIKit';
import { getInitials } from '@chefsbook/ui';

export default function ChefProfile() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [chef, setChef] = useState<UserProfile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadChef();
  }, [id]);

  const loadChef = async () => {
    const [{ data: profile }, { data: publicRecipes }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', id).single(),
      supabase.from('recipes').select('*').eq('user_id', id).eq('visibility', 'public').order('created_at', { ascending: false }),
    ]);
    setChef(profile as UserProfile | null);
    setRecipes((publicRecipes ?? []) as Recipe[]);
    setLoading(false);
  };

  if (loading) return <Loading message="Loading chef profile..." />;
  if (!chef) return <EmptyState icon="?" title="Chef not found" message="This profile doesn't exist." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <View style={{ alignItems: 'center', padding: 24 }}>
        <Avatar uri={chef.avatar_url} initials={getInitials(chef.display_name)} size={80} />
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 12 }}>
          {chef.display_name}
        </Text>
        {chef.username && (
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>@{chef.username}</Text>
        )}
        {chef.bio && (
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' }}>{chef.bio}</Text>
        )}
      </View>

      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
          Public Recipes ({recipes.length})
        </Text>
        {recipes.length === 0 ? (
          <EmptyState icon={'\uD83D\uDCD6'} title="No public recipes" message="This chef hasn't shared any recipes yet." />
        ) : (
          recipes.map((r) => (
            <RecipeCard
              key={r.id}
              title={r.title}
              imageUrl={r.image_url}
              cuisine={r.cuisine}
              totalMinutes={r.total_minutes}
              onPress={() => router.push(`/recipe/${r.id}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}
