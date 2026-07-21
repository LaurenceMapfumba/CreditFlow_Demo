import { Ionicons } from '@expo/vector-icons';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

const BLUE = '#2563EB';
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  Home:     { active: 'home',             inactive: 'home-outline'             },
  Market:   { active: 'storefront',       inactive: 'storefront-outline'       },
  'My Loans': { active: 'document-text', inactive: 'document-text-outline'    },
  Wallet:   { active: 'wallet',           inactive: 'wallet-outline'           },
  Admin:    { active: 'shield-checkmark', inactive: 'shield-checkmark-outline' },
};

export default function AppTabs() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CreditFlowTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Market</TabButton>
          </TabTrigger>
          {!isAdmin && (
            <TabTrigger name="loans" href="/loans" asChild>
              <TabButton>My Loans</TabButton>
            </TabTrigger>
          )}
          <TabTrigger name="wallet" href="/wallet" asChild>
            <TabButton>Wallet</TabButton>
          </TabTrigger>
          {isAdmin && (
            <TabTrigger name="admin" href="/admin" asChild>
              <TabButton>Admin</TabButton>
            </TabTrigger>
          )}
        </CreditFlowTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  const label = typeof children === 'string' ? children : '';
  const iconSet = TAB_ICONS[label];
  const iconName = iconSet
    ? (isFocused ? iconSet.active : iconSet.inactive)
    : 'ellipse-outline';
  const color = isFocused ? BLUE : theme.textSecondary;

  return (
    <Pressable {...props} style={({ pressed }) => [pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabBtn}>
        <Ionicons name={iconName} size={18} color={color} />
        <ThemedText
          type="small"
          style={[{ color }, isFocused && styles.tabBtnActiveText]}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CreditFlowTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brand}>
          CreditFlow
        </ThemedText>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brand: {
    marginRight: 'auto',
    color: '#2563EB',
  },
  pressed: { opacity: 0.7 },
  tabBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  tabBtnActiveText: {
    fontWeight: '700',
  },
});
