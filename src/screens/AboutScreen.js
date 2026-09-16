import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';
import { supabase } from '../config/supabaseConfig';

const FEATURES = [
  { icon: 'storefront',     title: 'توريد مباشر',     sub: 'تواصل مباشر مع الموردين' },
  { icon: 'local-shipping', title: 'شحن موثوق',         sub: 'شحن امن ودفع عند الاستلام' },
  { icon: 'verified-user',  title: 'أمان المعاملات',     sub: 'معاملا امنة وتوثيق كامل للطلبات' },
];

const INITIAL_STATS = [
  { value: '—', label: 'منتج متاح', accent: true },
  { value: '—', label: 'تاجر نشط' },
  { value: '—', label: 'شركة شحن' },
  { value: '—', label: 'مستخدم' },
];

const formatCount = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '0';

async function loadAboutStats() {
  const [productsResult, storesResult, usersResult] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('stores').select('id', { count: 'exact', head: true }),
    supabase.rpc('get_public_user_count'),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (storesResult.error) throw storesResult.error;
  if (usersResult.error) throw usersResult.error;

  // "تاجر نشط" = متجر لديه منتج واحد نشط على الأقل.
  // لا توجد حالياً في قاعدة البيانات كيانات مستقلة لشركات الشحن، لذلك لا نخترع رقماً لها.
  const { data: activeStoreIds, error: activeStoresError } = await supabase
    .from('products')
    .select('store_id')
    .eq('is_active', true);
  if (activeStoresError) throw activeStoresError;

  const activeMerchantCount = new Set((activeStoreIds || []).map((row) => row.store_id).filter(Boolean)).size;
  return {
    products: productsResult.count || 0,
    activeMerchants: activeMerchantCount,
    shippingCompanies: 0,
    users: Number(usersResult.data) || 0,
  };
}

export default function AboutScreen({ navigation }) {
  const [stats, setStats] = useState(INITIAL_STATS);

  const refreshStats = useCallback(async () => {
    try {
      const result = await loadAboutStats();
      setStats([
        { value: formatCount(result.products), label: 'منتج متاح', accent: true },
        { value: formatCount(result.activeMerchants), label: 'تاجر نشط' },
        { value: formatCount(result.shippingCompanies), label: 'شركة شحن' },
        { value: formatCount(result.users), label: 'مستخدم' },
      ]);
    } catch (error) {
      if (__DEV__) console.error('[AboutScreen] stats load error:', error);
    }
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="عن Kilix" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.brandBlock}>
          <Image
            source={require('../../assets/images/kilix-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.version}>الإصدار 1.2.0</Text>
          <Text style={styles.tagline}>
            وسيط ذكي يربط التجار الجملة بتجار التجزئة  — بدون وسطاء، بدون تعقيد.
          </Text>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, s.accent && { color: colors.orangeVibrant }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>لماذا Kilix؟</Text>
          <View style={styles.card}>
            {FEATURES.map((f, i) => (
              <View key={f.title} style={[styles.featureRow, i < FEATURES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow }]}>
                <View style={styles.featureIconWrap}>
                  <MaterialIcons name={f.icon} size={20} color={colors.navyDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureSub}>{f.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>© 2026 Kilix · الجزائر</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  brandBlock: { alignItems: 'center', paddingVertical: spacing.lg },
  logo: { width: 140, height: 64 },
  version: { ...typography.caption, color: colors.outline, marginTop: spacing.xs },
  tagline: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.sm, maxWidth: 280, lineHeight: 22 },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    ...cardShadow.level1,
    flexBasis: '47%', flex: 1,
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center',
  },
  statValue: { ...typography.titleMd, color: colors.charcoalText, fontWeight: '800' },
  statLabel: { ...typography.caption, color: colors.onSurfaceVariant, marginTop: 2, textAlign: 'center' },
  section: { marginBottom: spacing.md, gap: spacing.xs },
  sectionTitle: { ...typography.bodySm, fontWeight: '700', color: colors.outline, textAlign: 'right', marginBottom: spacing.xs },
  card: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden' },
  featureRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md },
  featureIconWrap: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { ...typography.bodySm, fontWeight: '700', color: colors.charcoalText, textAlign: 'right' },
  featureSub: { ...typography.caption, color: colors.onSurfaceVariant, textAlign: 'right', marginTop: 2, lineHeight: 16 },
  footer: { ...typography.caption, color: colors.outlineVariant, textAlign: 'center', marginTop: spacing.md },
});
