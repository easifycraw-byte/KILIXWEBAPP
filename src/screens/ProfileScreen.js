import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { ENV } from '../config/env';
import { Linking, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ORDER_STATUS } from '../constants/orderStatus';
import LegalPoliciesSheet from '../components/LegalPoliciesSheet';

function formatK(n) {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return `${n}`;
}

function MenuRow({ icon, label, sub, onPress, danger, badge }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <MaterialIcons name="chevron-left" size={20} color={colors.outline} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, danger && { color: colors.error }]}>{label}</Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <MaterialIcons name={icon} size={22} color={danger ? colors.error : colors.charcoalText} />
    </Pressable>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, logout, deleteAccount } = useAuth();
  const { orders, unreadNotificationsCount, loadOrders, loadNotifications, loading } = useData();
  const [refreshing, setRefreshing] = React.useState(false);
  const [legalSheetVisible, setLegalSheetVisible] = React.useState(false);

  const handleSelectLegalOption = (route) => {
    setLegalSheetVisible(false);
    navigation.navigate(route);
  };

  const completedCount = orders.filter((o) => o.status === ORDER_STATUS.COMPLETED).length;
  // إجمالي المشتريات يعكس الطلبات المؤكدة فقط، وليس الطلبات المعلقة أو الملغاة أو التي نفد مخزونها.
  // حالات الشحن/الاستلام/الإكمال تعني أن الطلب خرج من مرحلة الانتظار وأصبح شراءً مؤكداً.
  const confirmedPurchaseStatuses = [ORDER_STATUS.SHIPPING, ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED];
  const totalSpent = orders
    .filter((o) => confirmedPurchaseStatuses.includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);
  // التوفير يُعرض حالياً بصفر بشكل ثابت إلى حين تفعيل منطق الخصومات/التوفير الفعلي.
  const totalSaved = 0;

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([loadOrders(), loadNotifications()]); } finally { setRefreshing(false); }
  }, [loadOrders, loadNotifications]);

  const handleDeleteAccount = () => {
    Alert.alert(
      'حذف الحساب نهائيًا',
      'سيتم حذف حسابك نهائيًا، بما في ذلك بريدك الإلكتروني وبياناتك الشخصية ومتجرك ومنتجاته وصوره وفيديوهاته والبيانات المرتبطة بحسابك. لا يمكن التراجع عن هذه العملية.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الحساب',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAccount();
            if (result?.success) {
              navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
            } else {
              Alert.alert('تعذر حذف الحساب', result?.message || 'حاول مرة أخرى.');
            }
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing || !!loading.orders || !!loading.notifications} onRefresh={handleRefresh} />}
      >
        <LinearGradient colors={[colors.surfaceContainerLow, colors.background]} style={styles.headerGradient}>
          <View style={styles.topBar}>
            <Text style={styles.topBarBrand}>Kilix</Text>
            <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
              <MaterialIcons name="notifications-none" size={24} color={colors.charcoalText} />
              {unreadNotificationsCount > 0 ? <View style={styles.topBarDot} /> : null}
            </Pressable>
          </View>

          <View style={styles.profileHeader}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{([user?.first_name, user?.last_name].filter(Boolean).join(' ') || '؟').charAt(0)}</Text>
              </View>
              <View style={styles.verifiedDot}>
                <MaterialIcons name="verified" size={16} color={colors.success} />
              </View>
            </View>
            <Text style={styles.name}>{[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'المستخدم'}</Text>
            <Text style={styles.phone}>{user?.phone || 'رقم الهاتف غير مضاف'}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{completedCount}</Text>
              <Text style={styles.statLabel}>طلبات مكتملة</Text>
            </View>
            <View style={[styles.statCard, styles.statCardDivider]}>
              <Text style={styles.statValue}>{formatK(totalSpent)}</Text>
              <Text style={styles.statLabel}>إجمالي المشتريات</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatK(totalSaved)}</Text>
              <Text style={styles.statLabel}>توفير إجمالي</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.md }}>
          <Pressable style={styles.referralCard} onPress={() => navigation.navigate('Referral')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.referralTitle}>ادعُ تاجراً واربح!</Text>
            <Text style={styles.referralSub}>شارك رابطك واحصل على خصومات</Text>
          </View>
          <Pressable style={styles.shareBtn} onPress={() => navigation.navigate('Referral')}>
            <Text style={styles.shareBtnText}>مشاركة</Text>
          </Pressable>
        </Pressable>

        <Section title="الحساب والإعدادات">
          <MenuRow icon="person-outline" label="المعلومات الشخصية" onPress={() => navigation.navigate('PersonalInfo')} />
          <MenuRow icon="notifications-none" label="التنبيهات" badge={unreadNotificationsCount} onPress={() => navigation.navigate('Notifications')} />
          <MenuRow icon="public" label="الدولة" sub="الجزائر" onPress={() => navigation.navigate('CountrySelection')} />
          <MenuRow icon="attach-money" label="العملة" sub="الدينار الجزائري (DZD)" onPress={() => navigation.navigate('CurrencySelection')} />
        </Section>

        <Section title="الطلبات والمعاملات">
          {/* تم استبدال زر الشحنات بـ زر متجرك */}
          <MenuRow icon="storefront" label="متجرك" sub="إدارة منتجاتك وعرضك التجاري" onPress={() => navigation.navigate('CreateStore')} />
        </Section>

        <Section title="الدعم والمساعدة">
          <MenuRow icon="help-outline" label="مركز المساعدة" onPress={() => navigation.navigate('Support')} />
          <MenuRow icon="info-outline" label="عن Kilix" onPress={() => navigation.navigate('About')} />
        </Section>

        <Section title="السياسات القانونية">
          <MenuRow icon="gavel" label="السياسات القانونية" onPress={() => setLegalSheetVisible(true)} />
          <MenuRow icon="language" label="سياسة الخصوصية العامة" sub="فتح رابط السياسة خارج التطبيق" onPress={() => Linking.openURL(ENV.PRIVACY_POLICY_URL)} />
        </Section>

        <Pressable style={styles.deleteAccountRow} onPress={handleDeleteAccount}>
          <Text style={styles.deleteAccountText}>حذف الحساب</Text>
          <MaterialIcons name="delete-outline" size={20} color={colors.error} />
        </Pressable>

        <Pressable style={styles.logout} onPress={handleLogout}>
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
          <MaterialIcons name="logout" size={20} color={colors.error} />
        </Pressable>
        </View>
      </ScrollView>

      <LegalPoliciesSheet
        visible={legalSheetVisible}
        onClose={() => setLegalSheetVisible(false)}
        onSelect={handleSelectLegalOption}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerGradient: { paddingTop: spacing.sm, paddingBottom: spacing.lg, paddingHorizontal: spacing.md, borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  topBarDot: { position: 'absolute', top: -2, left: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orangeVibrant },
  topBarBrand: { ...typography.titleMd, color: colors.orangeVibrant, fontFamily: 'Cairo_800ExtraBold' },
  profileHeader: { alignItems: 'center', gap: 4 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.orangeVibrant, borderWidth: 4, borderColor: colors.orangeVibrant, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.white, fontSize: 32, fontWeight: '800' },
  verifiedDot: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.headlineMobile, color: colors.charcoalText, marginTop: spacing.sm },
  phone: { ...typography.bodySm, color: colors.onSurfaceVariant },
  statsRow: { flexDirection: 'row-reverse', backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.surfaceContainerLow, padding: spacing.md, marginTop: spacing.lg, ...cardShadow.level1 },
  statCard: { flex: 1, alignItems: 'center', gap: 2 },
  statCardDivider: { borderRightWidth: 1, borderLeftWidth: 1, borderColor: colors.surfaceContainerLow },
  statValue: { ...typography.priceLg, fontSize: 18, color: colors.orangeVibrant },
  statLabel: { fontSize: 10, color: colors.outline, textAlign: 'center', marginTop: 2 },
  referralCard: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.surfaceContainerLow, padding: spacing.md, marginTop: -spacing.lg, gap: spacing.md, ...cardShadow.level1 },
  referralTitle: { color: colors.charcoalText, fontFamily: 'Cairo_700Bold', fontSize: 15, textAlign: 'right' },
  referralSub: { color: colors.onSurfaceVariant, fontSize: 12, textAlign: 'right', marginTop: 2 },
  shareBtn: { backgroundColor: colors.orangeVibrant, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full },
  shareBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  sectionTitle: { ...typography.bodySm, color: colors.outline, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'right' },
  card: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden' },
  menuRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  menuLabel: { ...typography.bodyLg, color: colors.charcoalText, textAlign: 'right' },
  menuSub: { ...typography.bodySm, color: colors.outline, textAlign: 'right' },
  badge: { backgroundColor: colors.orangeVibrant, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  deleteAccountRow: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.surfaceContainerLow,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteAccountText: {
    ...typography.bodyMd,
    color: colors.error,
    fontWeight: '700',
  },
  logout: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xl, padding: spacing.md },
  logoutText: { color: colors.error, fontFamily: 'Cairo_700Bold', fontSize: 15 },
});