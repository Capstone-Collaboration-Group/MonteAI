import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useDrawerChats } from '@/hooks/useDrawerChats';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { BottomSheet } from '@/components/thesis/BottomSheet';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { thesisService } from '@/lib/thesisService';
import { THESIS_PROGRAMS, type ThesisProgram, type ThesisResponseDto } from '@monteai/types';

/**
 * Library tab — published-thesis catalog.
 *
 * Filtering is backend-driven: the selected program is passed to
 * `thesisService.getTheses(program)` (?program=ICS), matching the server's
 * keyword filter on the research group leader's institute. Search is
 * client-side over the returned set so both can be active at once. The
 * selection lives in screen state, which survives tab switches and
 * detail push/back (expo-router keeps tab screens mounted).
 */
export default function LibraryScreen() {
  const router = useRouter();
  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const outline = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');

  const [theses, setTheses] = useState<ThesisResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<ThesisProgram | null>(null);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const { recentChats, loading: chatsLoading } = useDrawerChats();

  const loadTheses = useCallback(async () => {
    try {
      const data = await thesisService.getTheses(program ?? undefined);
      setTheses(data);
    } catch {
      // stays empty
    }
  }, [program]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadTheses().finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadTheses]);

  const { refreshControl } = usePullToRefresh(loadTheses);

  // Search composes with the backend program filter — both can be active.
  const visibleTheses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return theses;
    return theses.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) ||
        (t.authors ?? []).some((a) => a.toLowerCase().includes(q)) ||
        (t.institute ?? '').toLowerCase().includes(q) ||
        t.abstract?.toLowerCase().includes(q),
    );
  }, [theses, search]);

  const hasFilter = program !== null || search.trim().length > 0;

  return (
    <DrawerProvider recentChats={recentChats} recentLoading={chatsLoading}>
      {(openDrawer) => (
    <View style={[s.root, { backgroundColor: background }]}>
      <SafeAreaView style={{ flex: 0 }} edges={['top']}>
        <AppHeader title="MonteScholar" onLeftPress={openDrawer} rightIcons={[{ icon: 'notifications-none' }]} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={refreshControl}>
        {/* Header */}
        <Text style={[s.heading, { color: heading }]}>Published Theses</Text>
        <Text style={[s.sub, { color: body }]}>
          Explore a curated collection of peer-reviewed research and institutional defense records.
        </Text>

        {/* Search */}
        <View style={[s.searchBar, { backgroundColor: surface, borderColor: outline }]}>
          <MaterialIcons name="search" size={20} color={body} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title, author, or keywords..."
            placeholderTextColor={body}
            style={[s.searchInput, { color: heading }]}
            returnKeyType="search"
            accessibilityLabel="Search theses"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
              <MaterialIcons name="close" size={18} color={body} />
            </Pressable>
          )}
        </View>

        {/* Filter — opens the program selection sheet */}
        <Pressable
          onPress={() => setFilterOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={program ? `Filter results, ${program} selected` : 'Filter results'}
          style={({ pressed }) => [
            s.filterBtn,
            { backgroundColor: primary },
            pressed && { opacity: 0.85 },
          ]}>
          <MaterialIcons name="filter-list" size={18} color="#fff" />
          <Text style={s.filterText}>{program ? `Filter · ${program}` : 'Filter Results'}</Text>
          {program ? <MaterialIcons name="check-circle" size={16} color="#fff" /> : null}
        </Pressable>

        {/* Thesis cards */}
        {loading ? (
          <ActivityIndicator size="small" color={body} style={{ marginVertical: Spacing.xl }} />
        ) : visibleTheses.length === 0 ? (
          <Text style={[s.emptyText, { color: body }]}>
            {hasFilter ? 'No theses match your filters' : 'No theses found'}
          </Text>
        ) : (
          visibleTheses.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.push(`/thesis/${t.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${t.title}`}
              style={({ pressed }) => [
                s.card,
                { backgroundColor: surface, borderColor: outline },
                pressed && { opacity: 0.85 },
              ]}>
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
            </Pressable>
          ))
        )}

        {!loading && visibleTheses.length > 0 && (
          <Pressable style={s.loadMore}>
            <Text style={[s.loadMoreText, { color: primary }]}>Load More</Text>
            <MaterialIcons name="expand-more" size={20} color={primary} />
          </Pressable>
        )}
      </ScrollView>

      {/* Program filter sheet — selection applies immediately and closes */}
      <BottomSheet
        visible={filterOpen}
        title="Filter by program"
        subtitle={program ? `Showing ${program} theses` : 'Showing all programs'}
        onClose={() => setFilterOpen(false)}>
        <View style={s.filterList}>
          <FilterRow
            label="All Programs"
            sub="No program filter"
            active={program === null}
            onPress={() => {
              setProgram(null);
              setFilterOpen(false);
            }}
          />
          {THESIS_PROGRAMS.map((p) => (
            <FilterRow
              key={p.code}
              label={p.code}
              sub={p.label}
              active={program === p.code}
              onPress={() => {
                setProgram(p.code);
                setFilterOpen(false);
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
      )}
    </DrawerProvider>
  );
}

function FilterRow({
  label,
  sub,
  active,
  onPress,
}: {
  label: string;
  sub: string;
  active: boolean;
  onPress: () => void;
}) {
  const primary = useThemeColor({}, 'primary');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const outline = useThemeColor({}, 'outlineVariant');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        s.filterRow,
        { borderColor: outline },
        active && { borderColor: primary },
        pressed && { opacity: 0.85 },
      ]}>
      <View style={s.filterRowText}>
        <Text style={[s.filterRowTitle, { color: active ? primary : heading }]}>{label}</Text>
        <Text style={[s.filterRowMeta, { color: body }]}>{sub}</Text>
      </View>
      {active ? <MaterialIcons name="check" size={18} color={primary} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: 100, gap: Spacing.md },
  heading: { fontSize: FontSize.xxl, fontWeight: '700' },
  sub: { fontSize: FontSize.sm, lineHeight: 20 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.md, padding: 0 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  filterList: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, gap: Spacing.md },
  filterRowText: { flex: 1 },
  filterRowTitle: { fontSize: FontSize.md, fontWeight: '700' },
  filterRowMeta: { fontSize: FontSize.xs, marginTop: 2 },
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
