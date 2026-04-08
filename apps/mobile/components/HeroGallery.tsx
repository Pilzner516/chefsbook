import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Image, FlatList, Dimensions, StyleSheet } from 'react-native';
import type { ViewToken } from 'react-native';
import { listRecipePhotos } from '@chefsbook/db';
import type { RecipeUserPhoto } from '@chefsbook/db';
import { RecipeImage } from './RecipeImage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = 220;
const MAX_IMAGES = 4;

interface Props {
  recipeId: string;
  /** Fallback image URL from recipe.image_url (imported/scraped images) */
  fallbackImageUrl?: string | null;
}

function imageSource(uri: string) {
  const isSupabase = SUPABASE_URL && uri.startsWith(SUPABASE_URL);
  return isSupabase
    ? { uri, headers: { apikey: SUPABASE_ANON_KEY } }
    : { uri };
}

export function HeroGallery({ recipeId, fallbackImageUrl }: Props) {
  const [photos, setPhotos] = useState<RecipeUserPhoto[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    listRecipePhotos(recipeId).then((all) => setPhotos(all.slice(0, MAX_IMAGES)));
  }, [recipeId]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderItem = useCallback(
    ({ item }: { item: RecipeUserPhoto }) => (
      <Image
        source={imageSource(item.url)}
        style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
        resizeMode="cover"
        onError={(e) => console.error('Hero image error:', e.nativeEvent.error, item.url)}
      />
    ),
    [],
  );

  // No user photos — show fallback (imported image_url or chef's hat)
  if (photos.length === 0) {
    return <RecipeImage uri={fallbackImageUrl} style={{ width: '100%', height: HERO_HEIGHT }} />;
  }

  // Single image — no pager needed
  if (photos.length === 1) {
    return (
      <Image
        source={imageSource(photos[0].url)}
        style={{ width: '100%', height: HERO_HEIGHT }}
        resizeMode="cover"
      />
    );
  }

  // 2-4 images — swipeable pager with dots
  return (
    <View>
      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />
      <View style={styles.dots}>
        {photos.map((p, i) => (
          <View
            key={p.id}
            style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#ce2b37',
  },
  dotInactive: {
    backgroundColor: '#ccc',
  },
});
