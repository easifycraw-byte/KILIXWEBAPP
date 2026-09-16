import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme/theme';
import { useData } from '../context/DataContext';

const TAG_COLORS = {
  default: { bg: colors.surfaceContainerLow, text: colors.charcoalText },
  success: { bg: '#DCFCE7', text: '#15803D' },
  purple: { bg: '#F3E8FF', text: '#7E22CE' },
};

// تنسيق الوقت: اليوم -> ساعة، أمس -> "أمس"، أقدم -> يوم/شهر (مطابق لتصميم Stitch)
function formatConversationTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  if (isYesterday) return 'أمس';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function MessagesScreen({ navigation }) {
  const { conversations, loading, loadConversations } = useData();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => c.name.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>الرسائل</Text>
        <View style={styles.searchRow}>
          <MaterialIcons name="search" size={18} color={colors.outline} />
          <TextInput
            placeholder="البحث في الرسائل..."
            placeholderTextColor={colors.outline}
            style={styles.searchInput}
            textAlign="right"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={loading.conversations} onRefresh={loadConversations} colors={[colors.orangeVibrant]} />}
        renderItem={({ item }) => {
          const tagStyle = TAG_COLORS[item.tagColorKey] || TAG_COLORS.default;
          return (
            <Pressable style={styles.row} onPress={() => navigation.navigate('Chat', { conversationId: item.id })}>
              <View style={[styles.avatar, { backgroundColor: item.color || colors.charcoalText }]}>
                <Text style={styles.avatarText}>{item.initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.time}>{formatConversationTime(item.lastMessageDate)}</Text>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                </View>
                <View style={styles.previewRow}>
                  {item.tag ? (
                    <View style={[styles.tag, { backgroundColor: tagStyle.bg }]}>
                      <Text style={[styles.tagText, { color: tagStyle.text }]}>{item.tag}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.preview, item.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                </View>
              </View>
              {item.unread > 0 ? (
                <View style={styles.unreadDot}>
                  <Text style={styles.unreadDotText}>{item.unread}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>لا توجد محادثات بعد</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  title: { ...typography.headlineMobile, color: colors.charcoalText, fontFamily: 'Cairo_800ExtraBold', textAlign: 'right' },
  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10 },
  searchInput: { flex: 1, ...typography.bodySm, color: colors.charcoalText },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  rowTop: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  name: { ...typography.bodyLg, fontWeight: '700', color: colors.charcoalText, flexShrink: 1, textAlign: 'right' },
  time: { fontSize: 11, color: colors.outline },
  previewRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  tag: { borderRadius: 4, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '700' },
  preview: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'right', flexShrink: 1 },
  previewUnread: { color: colors.charcoalText, fontWeight: '700' },
  unreadDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.orangeVibrant, alignItems: 'center', justifyContent: 'center' },
  unreadDotText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  empty: { ...typography.bodySm, color: colors.outline, textAlign: 'center', marginTop: spacing.xl },
});
