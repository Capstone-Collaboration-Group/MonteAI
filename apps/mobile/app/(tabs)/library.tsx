import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { thesisService } from '@/lib/thesisService';
import type { ThesisResponseDto } from '@monteai/types';

export default function LibraryScreen() {
  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const outline = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');

  const [theses, setTheses] = useState<ThesisResponseDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await thesisService.getTheses();
        if (active) setTheses(data);
      } catch {
        // stays empty
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <DrawerProvider>
      {(openDrawer) => (
    <View style={[s.root, { backgroundColor: background }]}>
      <SafeAreaView style={{ flex: 0 }} edges={['top']}>
        <AppHeader title="MonteScholar" onLeftPress={openDrawer} rightIcons={[{ icon: 'notifications-none' }]} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={[s.heading, { color: heading }]}>Published Theses</Text>
        <Text style={[s.sub, { color: body }]}>
          Explore a curated collection of peer-reviewed research and institutional defense records.
        </Text>

        {/* Search */}
        <View style={[s.searchBar, { backgroundColor: surface, borderColor: outline }]}>
          <MaterialIcons name="search" size={20} color={body} />
          <Text style={[s.searchPlaceholder, { color: body }]}>Search by title, author, or keywords...</Text>
        </View>

        {/* Filter */}
        <Pressable style={[s.filterBtn, { backgroundColor: primary }]}>
          <MaterialIcons name="filter-list" size={18} color="#fff" />
          <Text style={s.filterText}>Filter Results</Text>
        </Pressable>

        {/* Thesis cards */}
        {loading ? (
          <ActivityIndicator size="small" color={body} style={{ marginVertical: Spacing.xl }} />
        ) : theses.length === 0 ? (
          <Text style={[s.emptyText, { color: body }]}>No theses found</Text>
        ) : (
          theses.map((t) => (
            <View key={t.id} style={[s.card, { backgroundColor: surface, borderColor: outline }]}>
              <View style={s.cardHeader}>
                <MaterialIcons name="description" size={20} color={primary} />
                <Text style={[s.cardYear, { color: body }]}>
                  {t.submittedAt ? new Date(t.submittedAt).getFullYear() : ''}
                </Text>
              </View>
              <Text style={[s.cardTitle, { color: heading }]}>{t.title}</Text>
              <Text style={[s.cardAuthor, { color: body }]}>
                {t.authors?.join(', ')}
              </Text>
              <View style={s.cardFooter}>
                <Text style={[s.cardInstitute, { color: primary }]}>{t.institute}</Text>
                <MaterialIcons name="arrow-forward" size={16} color={primary} />
              </View>
            </View>
          ))
        )}

        {!loading && theses.length > 0 && (
          <Pressable style={s.loadMore}>
            <Text style={[s.loadMoreText, { color: primary }]}>Load More</Text>
            <MaterialIcons name="expand-more" size={20} color={primary} />
          </Pressable>
        )}
      </ScrollView>
    </View>
      )}
    </DrawerProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: 100, gap: Spacing.md },
  heading: { fontSize: FontSize.xxl, fontWeight: '700' },
  sub: { fontSize: FontSize.sm, lineHeight: 20 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  searchPlaceholder: { fontSize: FontSize.md, flex: 1 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardYear: { fontSize: FontSize.xs },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '600', lineHeight: 24 },
  cardAuthor: { fontSize: FontSize.sm },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  cardInstitute: { fontSize: FontSize.xs, fontWeight: '500' },
  loadMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.lg },
  loadMoreText: { fontSize: FontSize.md, fontWeight: '600' },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center', marginVertical: Spacing.xl },
});
