import { Redirect, useLocalSearchParams } from 'expo-router';

export default function CookMenuIndex() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/cook-menu/${id}/setup`} />;
}
