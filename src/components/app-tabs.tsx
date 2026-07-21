import { Ionicons } from '@expo/vector-icons';
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

const BLUE = '#2563EB';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName; label: string }> = {
  home:    { active: 'home',              inactive: 'home-outline',              label: 'Home'     },
  explore: { active: 'storefront',        inactive: 'storefront-outline',        label: 'Market'   },
  loans:   { active: 'document-text',     inactive: 'document-text-outline',     label: 'My Loans' },
  wallet:  { active: 'wallet',            inactive: 'wallet-outline',            label: 'Wallet'   },
  admin:   { active: 'shield-checkmark',  inactive: 'shield-checkmark-outline',  label: 'Admin'    },
};

export default function AppTabs() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <NativeTabBar>
          <TabTrigger name="home" href="/" asChild>
            <TabBtn tabKey="home" />
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabBtn tabKey="explore" />
          </TabTrigger>
          {!isAdmin && (
            <TabTrigger name="loans" href="/loans" asChild>
              <TabBtn tabKey="loans" />
            </TabTrigger>
          )}
          <TabTrigger name="wallet" href="/wallet" asChild>
            <TabBtn tabKey="wallet" />
          </TabTrigger>
          {isAdmin && (
            <TabTrigger name="admin" href="/admin" asChild>
              <TabBtn tabKey="admin" />
            </TabTrigger>
          )}
        </NativeTabBar>
      </TabList>
    </Tabs>
  );
}

function NativeTabBar({ children, ...props }: { children: React.ReactNode; [k: string]: any }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <View
      {...props}
      style={[
        styles.barOuter,
        { paddingBottom: insets.bottom || 8, backgroundColor: theme.background },
      ]}>
      <View style={[styles.barShadow, { backgroundColor: theme.backgroundElement }]}>
        {children}
      </View>
    </View>
  );
}

function TabBtn({ tabKey, isFocused, ...props }: TabTriggerSlotProps & { tabKey: string }) {
  const theme = useTheme();
  const iconSet = TAB_ICONS[tabKey];
  const iconName = isFocused ? iconSet.active : iconSet.inactive;
  const color = isFocused ? BLUE : theme.textSecondary;

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
        <Ionicons name={iconName} size={22} color={color} />
      </View>
      <ThemedText
        style={[styles.label, { color, fontWeight: isFocused ? '700' : '400' }]}>
        {iconSet.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barOuter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  barShadow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: BLUE + '18',
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  pressed: { opacity: 0.6 },
});
