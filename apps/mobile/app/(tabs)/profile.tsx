import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { AppHeader } from '@/components/ui/AppHeader';
import { DrawerProvider } from '@/components/ui/DrawerProvider';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { studentService } from '@/lib/studentService';
import type { StudentResponseDto } from '@monteai/types';

const MENU = [
  { icon: 'person-outline', label: 'Edit Profile' },
  { icon: 'lock-outline', label: 'Change Password' },
  { icon: 'notifications-none', label: 'Notifications' },
  { icon: 'help-outline', label: 'Help & Support' },
  { icon: 'info-outline', label: 'About' },
];

function initials(first?: string, last?: string): string {
  return `${(first?.[0] ?? '').toUpperCase()}${(last?.[0] ?? '').toUpperCase()}` || '??';
}

export default function ProfileScreen() {
  const background = useThemeColor({}, 'background');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surfaceContainerLow');
  const outline = useThemeColor({}, 'outlineVariant');
  const primary = useThemeColor({}, 'primary');

  const [student, setStudent] = useState<StudentResponseDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const students = await studentService.getStudents();
        if (active && students.length > 0) {
          setStudent(students[0]); // first student as current user
        }
      } catch {
        // stays null
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const fullName = student
    ? `${student.firstName} ${student.middleInitial ? student.middleInitial + '. ' : ''}${student.lastName}${student.suffix ? ' ' + student.suffix : ''}`
    : 'Jane Doe';
  const email = student?.email ?? 'jane.doe@student.pnm.edu.ph';
  const role = student?.program ?? 'Academic Researcher';
  const ini = student ? initials(student.firstName, student.lastName) : 'JD';

  return (
    <DrawerProvider>
      {(openDrawer) => (
    <View style={[s.root, { backgroundColor: background }]}>
      <SafeAreaView style={{ flex: 0 }} edges={['top']}>
        <AppHeader title="MonteSkolar" onLeftPress={openDrawer} rightIcons={[{ icon: 'settings' }]} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          {loading ? (
            <ActivityIndicator size="small" color={body} />
          ) : (
            <>
              <View style={[s.avatar, { backgroundColor: primary }]}>
                <Text style={s.avatarText}>{ini}</Text>
              </View>
              <Text style={[s.name, { color: heading }]}>{fullName}</Text>
              <Text style={[s.role, { color: body }]}>{role}</Text>
              <Text style={[s.email, { color: body }]}>{email}</Text>
            </>
          )}
        </View>

        {/* Stats */}
        <View style={[s.stats, { backgroundColor: surface, borderColor: outline }]}>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: primary }]}>{student?.researchGroup ? 1 : 0}</Text>
            <Text style={[s.statLabel, { color: body }]}>Groups</Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: outline }]} />
          <View style={s.stat}>
            <Text style={[s.statNum, { color: primary }]}>{student?.yearLevel ?? '-'}</Text>
            <Text style={[s.statLabel, { color: body }]}>Year Level</Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: outline }]} />
          <View style={s.stat}>
            <Text style={[s.statNum, { color: primary }]}>{student?.position ?? '-'}</Text>
            <Text style={[s.statLabel, { color: body }]}>Position</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={[s.menu, { backgroundColor: surface, borderColor: outline }]}>
          {MENU.map((m, i) => (
            <React.Fragment key={m.label}>
              {i > 0 ? <View style={[s.divider, { backgroundColor: outline }]} /> : null}
              <Pressable style={s.menuRow} accessibilityRole="button">
                <MaterialIcons name={m.icon as any} size={22} color={body} />
                <Text style={[s.menuLabel, { color: heading }]}>{m.label}</Text>
                <MaterialIcons name="chevron-right" size={20} color={body} />
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* Logout */}
        <Pressable style={[s.logoutBtn, { borderColor: '#dc2626' }]}>
          <MaterialIcons name="logout" size={20} color="#dc2626" />
          <Text style={s.logoutText}>Log Out</Text>
        </Pressable>

        <Text style={[s.version, { color: body }]}>MonteScholar v1.0.0</Text>
      </ScrollView>
    </View>
      )}
    </DrawerProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: 100, gap: Spacing.xl, alignItems: 'center' },
  avatarSection: { alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: FontSize.xxl, fontWeight: '700' },
  name: { fontSize: FontSize.xxl, fontWeight: '700' },
  role: { fontSize: FontSize.md },
  email: { fontSize: FontSize.sm },
  stats: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, width: '100%' },
  stat: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  statNum: { fontSize: FontSize.xl, fontWeight: '700' },
  statLabel: { fontSize: FontSize.xs },
  statDivider: { width: StyleSheet.hairlineWidth },
  menu: { borderWidth: 1, borderRadius: Radius.md, width: '100%', overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md },
  menuLabel: { flex: 1, fontSize: FontSize.md },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.lg + 22 + Spacing.md },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: Spacing.sm, width: '100%', justifyContent: 'center' },
  logoutText: { color: '#dc2626', fontSize: FontSize.md, fontWeight: '600' },
  version: { fontSize: FontSize.xs, opacity: 0.5 },
});
