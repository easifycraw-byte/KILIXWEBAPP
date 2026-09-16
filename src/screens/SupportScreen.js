import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import PrimaryButton from '../components/PrimaryButton';
import { colors, spacing, radius, typography, cardShadow } from '../theme/theme';

const TOPICS = ['مشكلة في الدفع', 'الشحن والتتبع', 'الحساب', 'أخرى'];

export default function SupportScreen({ navigation }) {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!message.trim()) {
      Alert.alert('يرجى كتابة رسالتك قبل الإرسال');
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader
          title="الدعم والمساعدة"
          rightAction={
            <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
              <MaterialIcons name="notifications" size={22} color={colors.charcoalText} />
            </Pressable>
          }
        />
        <View style={styles.successWrap}>
          <MaterialIcons name="check-circle" size={64} color={colors.success} />
          <Text style={styles.successTitle}>تم إرسال طلبك</Text>
          <Text style={styles.successSub}>لقد استلمنا رسالتك وسيتواصل معك فريق الدعم قريباً.</Text>
          <PrimaryButton title="إرسال طلب آخر" variant="outline" onPress={() => { setSent(false); setMessage(''); }} style={{ marginTop: spacing.xl }} />
          <PrimaryButton title="العودة للرئيسية" onPress={() => navigation.navigate('Main')} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="الدعم والمساعدة" />
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Text style={styles.sectionTitle}>قنوات التواصل</Text>
        <View style={styles.channelsCard}>
          <View style={styles.channelRow}>
            <MaterialIcons name="call" size={22} color={colors.charcoalText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>اتصل بنا</Text>
              <Text style={styles.channelSub}>0556512603</Text>
            </View>
            <MaterialIcons name="chevron-left" size={20} color={colors.outline} />
          </View>
          <View style={styles.channelRow}>
            <MaterialIcons name="chat-bubble" size={22} color={colors.charcoalText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>دردشة مباشرة</Text>
              <Text style={styles.channelSub}>متاح ٨ص – ١٠م</Text>
            </View>
            <MaterialIcons name="chevron-left" size={20} color={colors.outline} />
          </View>
          <View style={[styles.channelRow, { borderBottomWidth: 0 }]}>
            <MaterialIcons name="mail" size={22} color={colors.charcoalText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>البريد الإلكتروني</Text>
              <Text style={styles.channelSub}>kilixservise@gmail.com</Text>
            </View>
            <MaterialIcons name="chevron-left" size={20} color={colors.outline} />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>أرسل طلب دعم</Text>
        <Text style={styles.hint}>سنرد عليك خلال ٢٤ ساعة.</Text>

        <Text style={styles.label}>الموضوع</Text>
        <View style={styles.chipRow}>
          {TOPICS.map((t) => (
            <Pressable key={t} onPress={() => setTopic(t)} style={[styles.chip, topic === t && styles.chipActive]}>
              <Text style={[styles.chipText, topic === t && { color: colors.white }]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>رسالتك</Text>
        <TextInput
          style={styles.textArea}
          placeholder="اكتب رسالتك هنا..."
          placeholderTextColor={colors.outline}
          value={message}
          onChangeText={setMessage}
          multiline
          textAlign="right"
        />

        <PrimaryButton title="إرسال" onPress={handleSend} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  sectionTitle: { ...typography.titleMd, fontSize: 16, color: colors.charcoalText, textAlign: 'right', marginBottom: spacing.sm },
  channelsCard: { ...cardShadow.level1, backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden' },
  channelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  channelTitle: { ...typography.bodyLg, fontWeight: '700', color: colors.charcoalText, textAlign: 'right' },
  channelSub: { ...typography.bodySm, color: colors.outline, textAlign: 'right', marginTop: 2 },
  hint: { ...typography.bodySm, color: colors.outline, textAlign: 'right', marginBottom: spacing.md },
  label: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'right', marginBottom: spacing.xs, fontWeight: '600' },
  chipRow: { flexDirection: 'row-reverse', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.navyDeep, borderColor: colors.navyDeep },
  chipText: { ...typography.bodySm, color: colors.charcoalText },
  textArea: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.md, padding: spacing.md, minHeight: 120, ...typography.bodyLg, color: colors.charcoalText, textAlignVertical: 'top' },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  successTitle: { ...typography.headlineMobile, color: colors.charcoalText, marginTop: spacing.md },
  successSub: { ...typography.bodyLg, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.sm },
});
