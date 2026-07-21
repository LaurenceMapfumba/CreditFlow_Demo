import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  api,
  formatDateTime,
  formatMoney,
  isCreditTx,
  TransactionResponse,
  UserResponse,
} from '@/services/api';

const BLUE = '#2563EB';
const GREEN = '#16A34A';
const RED = '#DC2626';
const CARD_DARK = '#1E3A8A';

type ModalType = 'deposit' | 'withdraw' | null;

export default function WalletScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + BottomTabInset + Spacing.four;
  const topPad = Platform.OS === 'web' ? Spacing.six : insets.top + Spacing.three;

  const [user, setUser] = useState<UserResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [amountInput, setAmountInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  function loadData() {
    return Promise.allSettled([
      api.users.me().then(setUser),
      api.transactions.list(0, 20).then(setTransactions).catch(() => {}),
    ]);
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const balance = user?.walletBalance ?? 0;

  const deposited = transactions
    .filter(tx => tx.type === 'DEPOSIT')
    .reduce((s, tx) => s + tx.amount, 0);

  const loanFunded = transactions
    .filter(tx => tx.type === 'LOAN_DISBURSEMENT')
    .reduce((s, tx) => s + tx.amount, 0);

  const interestEarned = transactions
    .filter(tx => tx.type === 'INTEREST')
    .reduce((s, tx) => s + tx.amount, 0);

  function openModal(type: ModalType) {
    setAmountInput('');
    setModalError(null);
    setActiveModal(type);
  }

  function closeModal() {
    if (processing) return;
    setActiveModal(null);
    setAmountInput('');
    setModalError(null);
  }

  async function handleSubmit() {
    const amount = parseFloat(amountInput);
    if (!amountInput || isNaN(amount) || amount < 1) {
      setModalError('Enter a valid amount (minimum $1.00)');
      return;
    }
    if (activeModal === 'withdraw' && amount > balance) {
      setModalError(`Insufficient balance. Available: ${formatMoney(balance)}`);
      return;
    }

    setProcessing(true);
    setModalError(null);
    try {
      if (activeModal === 'deposit') {
        await api.transactions.deposit(amount);
      } else {
        await api.transactions.withdraw(amount);
      }
      // Refresh balance + history
      await loadData();
      closeModal();
    } catch (e: any) {
      setModalError(e?.message ?? 'Something went wrong');
    } finally {
      setProcessing(false);
    }
  }

  const isDeposit = activeModal === 'deposit';
  const modalTitle = isDeposit ? 'Add Funds' : 'Withdraw Funds';
  const modalBtnLabel = processing
    ? (isDeposit ? 'Adding...' : 'Withdrawing...')
    : (isDeposit ? 'Add Funds' : 'Withdraw');

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.inner}>
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: CARD_DARK }]}>
          <ThemedText style={styles.balanceLabel}>Total Balance</ThemedText>
          <ThemedText style={styles.balanceAmount}>
            {loading ? '—' : formatMoney(balance)}
          </ThemedText>
          <ThemedText style={styles.balanceSub}>CreditFlow Wallet · USD</ThemedText>

          <View style={styles.breakdown}>
            <View style={styles.breakdownItem}>
              <ThemedText style={styles.breakdownValue}>{formatMoney(deposited)}</ThemedText>
              <ThemedText style={styles.breakdownLabel}>Deposited</ThemedText>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <ThemedText style={styles.breakdownValue}>{formatMoney(loanFunded)}</ThemedText>
              <ThemedText style={styles.breakdownLabel}>In Loans</ThemedText>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <ThemedText style={[styles.breakdownValue, { color: '#4ade80' }]}>
                +{formatMoney(interestEarned)}
              </ThemedText>
              <ThemedText style={styles.breakdownLabel}>Earned</ThemedText>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => openModal('deposit')}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <ThemedText style={styles.primaryBtnText}>+ Add Funds</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => openModal('withdraw')}
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}>
            <ThemedText style={styles.outlineBtnText}>Withdraw</ThemedText>
          </Pressable>
        </View>

        {/* Account Info */}
        <ThemedText type="smallBold">Account Details</ThemedText>
        <ThemedView type="backgroundElement" style={[styles.card, styles.cardNoGap]}>
          <View style={styles.methodRow}>
            <View style={styles.methodIcon}>
              <ThemedText style={{ fontSize: 20 }}>👤</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">
                {user ? `${user.firstName} ${user.lastName}` : '—'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{user?.email ?? '—'}</ThemedText>
            </View>
            <View style={[styles.badge, { backgroundColor: GREEN + '22' }]}>
              <ThemedText style={[styles.badgeText, { color: GREEN }]}>
                ✓ {user?.role ?? '—'}
              </ThemedText>
            </View>
          </View>
          <ThemedView type="backgroundSelected" style={styles.separator} />
          <View style={styles.methodRow}>
            <View style={styles.methodIcon}>
              <ThemedText style={{ fontSize: 20 }}>📱</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">Mobile / Bank</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{user?.phoneNumber ?? '—'}</ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Transactions */}
        <ThemedText type="smallBold">Transaction History</ThemedText>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={BLUE} size="large" />
          </View>
        )}

        {!loading && transactions.length === 0 && (
          <ThemedView type="backgroundElement" style={styles.emptyBox}>
            <ThemedText themeColor="textSecondary">No transactions yet.</ThemedText>
          </ThemedView>
        )}

        {!loading && transactions.length > 0 && (
          <ThemedView type="backgroundElement" style={[styles.card, styles.cardNoGap]}>
            {transactions.map((tx, i) => {
              const credit = isCreditTx(tx.type);
              return (
                <View key={tx.id}>
                  <View style={styles.txRow}>
                    <View style={[styles.txDot, { backgroundColor: credit ? GREEN : RED }]} />
                    <View style={{ flex: 1 }}>
                      <ThemedText type="small">{tx.description || tx.type}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {tx.paymentMethod} · {formatDateTime(tx.createdAt)}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.txAmount, { color: credit ? GREEN : RED }]}>
                      {credit ? '+' : '-'}{formatMoney(tx.amount)}
                    </ThemedText>
                  </View>
                  {i < transactions.length - 1 && (
                    <ThemedView type="backgroundSelected" style={styles.separator} />
                  )}
                </View>
              );
            })}
          </ThemedView>
        )}
      </View>

      {/* Deposit / Withdraw Modal */}
      <Modal
        visible={activeModal !== null}
        transparent
        animationType="slide"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle" style={styles.modalTitle}>{modalTitle}</ThemedText>

            {!isDeposit && (
              <View style={styles.balanceHint}>
                <ThemedText type="small" themeColor="textSecondary">Available balance</ThemedText>
                <ThemedText type="smallBold" style={{ color: BLUE }}>{formatMoney(balance)}</ThemedText>
              </View>
            )}

            <ThemedText type="small" themeColor="textSecondary" style={styles.inputLabel}>
              Amount (USD)
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={amountInput}
              onChangeText={text => {
                setAmountInput(text.replace(/[^0-9.]/g, ''));
                setModalError(null);
              }}
              editable={!processing}
            />

            {modalError && (
              <View style={styles.errorBox}>
                <ThemedText style={{ color: RED, fontSize: 13 }}>{modalError}</ThemedText>
              </View>
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={processing}
              style={({ pressed }) => [
                styles.modalPrimaryBtn,
                { backgroundColor: isDeposit ? BLUE : '#7C3AED' },
                (pressed || processing) && styles.pressed,
              ]}>
              <ThemedText style={styles.modalBtnText}>{modalBtnLabel}</ThemedText>
            </Pressable>

            <Pressable onPress={closeModal} disabled={processing} style={styles.cancelBtn}>
              <ThemedText style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  inner: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four, gap: Spacing.three },
  balanceCard: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  balanceLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  balanceAmount: { color: '#fff', fontSize: 44, fontWeight: '700', lineHeight: 52 },
  balanceSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  breakdown: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  breakdownItem: { flex: 1, alignItems: 'center', gap: 2 },
  breakdownValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  breakdownLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  breakdownDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  actions: { flexDirection: 'row', gap: Spacing.three },
  primaryBtn: {
    flex: 1,
    backgroundColor: BLUE,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  outlineBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: BLUE,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  outlineBtnText: { color: BLUE, fontWeight: '700', fontSize: 15 },
  pressed: { opacity: 0.6 },
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  cardNoGap: { gap: 0, padding: 0, overflow: 'hidden' },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.two },
  badgeText: { fontSize: 12, fontWeight: '600' },
  separator: { height: 1 },
  centered: { alignItems: 'center', paddingVertical: Spacing.four },
  emptyBox: { borderRadius: Spacing.three, padding: Spacing.four },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, gap: Spacing.three },
  txDot: { width: 10, height: 10, borderRadius: 5 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.five,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  modalTitle: { textAlign: 'center', marginBottom: Spacing.one },
  balanceHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: BLUE + '11',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  inputLabel: { marginBottom: -Spacing.two },
  input: {
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: RED + '11',
    borderRadius: Spacing.two,
    padding: Spacing.two,
    alignItems: 'center',
  },
  modalPrimaryBtn: {
    paddingVertical: Spacing.three + 2,
    borderRadius: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
