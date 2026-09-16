import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  KeyboardAvoidingView, Platform, Alert, Modal, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme/theme';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { getChatMessages, sendMessage, markChatAsRead, subscribeToChat, deleteChat } from '../services/chatService';

// جميع عمليات المحادثة تمر عبر chatService للحفاظ على عقد قاعدة بيانات واحد.


const HEADER_HEIGHT = 64;

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : `اليوم، ${d.toLocaleDateString('ar', { day: 'numeric', month: 'long' })}`;
}

// يحوّل صف chat_messages الخام (من قاعدة البيانات) إلى الشكل الذي تتوقعه الواجهة
function normalizeMessage(row, currentUserId) {
  return {
    id: row.id,
    text: row.content || '',
    date: row.created_at,
    fromMe: row.sender_id === currentUserId,
    read: !!row.read,
  };
}

export default function ChatScreen({ route, navigation }) {
  // ✅ استدعاء الخطاف هنا - داخل component مباشرة
  const insets = useSafeAreaInsets();

  const { conversationId, otherUserId: routeOtherUserId, title: routeTitle, chat: routeChat } = route.params || {};
  const { conversations = [] } = useData();
  const { user } = useAuth();
  const currentUserId = user?.auth_id || null;

  const [text, setText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const conversation = useMemo(() => {
    const existing = conversations.find((c) => c?.id === conversationId);
    if (existing) return existing;
    if (!conversationId) return null;
    const otherId = routeOtherUserId || routeChat?.participant_1_id || routeChat?.participant_2_id || null;
    const fallbackName = routeTitle || routeChat?.name || 'المحادثة';
    return {
      id: conversationId,
      otherUserId: otherId,
      name: fallbackName,
      initial: String(fallbackName).trim().slice(0, 1) || '?',
      tag: null,
      tagColorKey: 'default',
    };
  }, [conversations, conversationId, routeOtherUserId, routeTitle, routeChat]);

  // ── تحميل الرسائل الحقيقية + القراءة + Realtime عبر خدمة موحّدة ─────────
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await getChatMessages(conversationId);
      setMessages((data || []).map((row) => normalizeMessage(row, currentUserId)));
    } catch (error) {
      if (__DEV__) console.warn('[ChatScreen] loadMessages error:', error?.message || error);
    }
  }, [conversationId, currentUserId]);

  const markAsRead = useCallback(async () => {
    if (!conversationId || !currentUserId) return;
    try {
      const result = await markChatAsRead(conversationId, currentUserId);
      if (!result?.success && __DEV__) console.warn('[ChatScreen] markAsRead error:', result?.error);
    } catch (error) {
      if (__DEV__) console.warn('[ChatScreen] markAsRead error:', error?.message || error);
    }
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!conversationId) return undefined;
    void loadMessages();
    void markAsRead();

    const unsubscribe = subscribeToChat(conversationId, (payload) => {
      if (payload?.eventType === 'INSERT' && payload?.new) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, normalizeMessage(payload.new, currentUserId)];
        });
        if (payload.new.sender_id !== currentUserId) void markAsRead();
      } else {
        void loadMessages();
      }
    });

    return unsubscribe;
  }, [conversationId, currentUserId, loadMessages, markAsRead]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !conversationId || !currentUserId || sending) return;

    setText('');
    setSending(true);
    try {
      const result = await sendMessage(conversationId, currentUserId, trimmed);
      if (!result?.success) {
        throw new Error(result?.error || 'تعذّر إرسال الرسالة');
      }
      const data = result.data;
      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, normalizeMessage(data, currentUserId)];
        });
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      if (__DEV__) console.warn('[ChatScreen] handleSend error:', error?.message || error);
      Alert.alert('تعذّر الإرسال', 'لم تُرسَل رسالتك، يرجى المحاولة مرة أخرى.');
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const dayLabel = messages.length > 0 && messages[0]?.date
    ? formatDayLabel(messages[0].date)
    : '';

  // keyboardVerticalOffset: نعوّض ارتفاع الهيدر + safe-area العلوي على iOS فقط
  // Android يستخدم behavior="height" دون الحاجة لـ offset
  const keyboardOffset = Platform.OS === 'ios' ? HEADER_HEIGHT + insets.top : 0;

  // ✅ الفحص الشرطي بعد كل الخطافات (Hooks) وليس قبلها، لاحترام قواعد الـ Hooks
  if (!conversation) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── الهيدر الثابت ───────────────────────────────────────────────── */}
      <View style={styles.chatHeader}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <MaterialIcons name="arrow-forward" size={24} color={colors.charcoalText} />
        </Pressable>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{conversation?.initial || '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chatHeaderName} numberOfLines={1}>{conversation?.name || ''}</Text>
          {conversation?.tag ? (
            <View style={styles.headerTag}>
              <Text style={styles.headerTagText}>{conversation.tag}</Text>
            </View>
          ) : null}
        </View>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
          <MaterialIcons name="more-vert" size={22} color={colors.charcoalText} />
        </Pressable>
      </View>

      {/* ── القائمة المنبثقة (Modal) ─────────────────────────────────────── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.dropdown, { top: insets.top + HEADER_HEIGHT }]}>
            <Pressable
              style={styles.dropdownItem}
              onPress={() => { setMenuOpen(false); setPinned((value) => !value); Alert.alert(pinned ? 'تم إلغاء تثبيت المحادثة' : 'تم تثبيت المحادثة'); }}
            >
              <Text style={styles.dropdownText}>تثبيت المحادثة</Text>
              <MaterialIcons name="push-pin" size={18} color={colors.charcoalText} />
            </Pressable>
            <Pressable
              style={styles.dropdownItem}
              onPress={async () => {
                setMenuOpen(false);
                try {
                  await Share.share({ message: `محادثة مع ${conversation?.name || 'المستخدم'}` });
                } catch (error) {
                  if (__DEV__) console.warn('[ChatScreen] share error:', error?.message || error);
                }
              }}
            >
              <Text style={styles.dropdownText}>مشاركة المحادثة</Text>
              <MaterialIcons name="share" size={18} color={colors.charcoalText} />
            </Pressable>
            <View style={styles.dropdownDivider} />
            <Pressable
              style={styles.dropdownItem}
              onPress={() => {
                setMenuOpen(false);
                Alert.alert('حذف المحادثة', 'هل أنت متأكد؟', [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'حذف',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const result = await deleteChat(conversationId);
                        if (!result?.success) throw new Error(result?.error || 'تعذّر حذف المحادثة');
                        navigation.goBack();
                      } catch (error) {
                        Alert.alert('تعذر حذف المحادثة', error?.message || 'حاول مرة أخرى.');
                      }
                    },
                  },
                ]);
              }}
            >
              <Text style={[styles.dropdownText, { color: colors.error }]}>حذف المحادثة</Text>
              <MaterialIcons name="delete" size={18} color={colors.error} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── حاوية الكيبورد ───────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
      >
        {/* قائمة الرسائل — flex:1 لتأخذ كل المساحة المتاحة فوق inputRow */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(i, index) => i?.id || index.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            dayLabel ? (
              <View style={styles.dayChip}>
                <Text style={styles.dayChipText}>{dayLabel}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (!item) return null;
            return (
              <View style={[styles.bubbleRow, item.fromMe && styles.bubbleRowMine]}>
                {!item.fromMe ? (
                  <View style={styles.miniAvatar}>
                    <Text style={styles.miniAvatarText}>{conversation?.initial || '?'}</Text>
                  </View>
                ) : null}
                <View style={{ maxWidth: '80%' }}>
                  <View style={[styles.bubble, item.fromMe ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, item.fromMe && { color: colors.white }]}>
                      {item.text || ''}
                    </Text>
                  </View>
                  <View style={[styles.bubbleMetaRow, item.fromMe && styles.bubbleMetaRowMine]}>
                    <Text style={styles.bubbleTime}>{formatTime(item.date)}</Text>
                    {item.fromMe && item.read ? (
                      <MaterialIcons name="done-all" size={12} color={colors.orangeVibrant} />
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* ── شريط الإدخال السفلي ──────────────────────────────────────────── */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.md }]}>
          <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending}>
            <MaterialIcons name="send" size={20} color={colors.white} />
          </Pressable>
          <TextInput
            style={styles.messageInput}
            placeholder="اكتب رسالة..."
            textAlign="right"
            placeholderTextColor={colors.outline}
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            multiline
            maxHeight={120}
          />
          <Pressable style={styles.iconBtn} hitSlop={8}>
            <MaterialIcons name="photo-camera" size={22} color={colors.charcoalText} />
          </Pressable>
          <Pressable style={styles.iconBtn} hitSlop={8}>
            <MaterialIcons name="attach-file" size={22} color={colors.charcoalText} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  flex1:            { flex: 1 },
  chatHeader:       { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, height: HEADER_HEIGHT, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow },
  headerAvatar:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navyDeep },
  headerAvatarText: { color: colors.white, fontWeight: '800' },
  chatHeaderName:   { color: colors.charcoalText, fontFamily: 'Cairo_700Bold', fontSize: 14, textAlign: 'right' },
  headerTag:        { backgroundColor: colors.orangeVibrant, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-end', marginTop: 2 },
  headerTagText:    { color: colors.white, fontSize: 9, fontWeight: '700' },
  menuBackdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  dropdown: {
    position: 'absolute',
    left: spacing.md,
    width: 200,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: 4,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  dropdownItem:     { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  dropdownText:     { ...typography.bodySm, color: colors.charcoalText, flex: 1, textAlign: 'right' },
  dropdownDivider:  { height: 1, backgroundColor: colors.surfaceContainerLow, marginVertical: 2 },
  messagesList:     { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  dayChip:          { alignSelf: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4, marginBottom: spacing.md },
  dayChipText:      { fontSize: 10, fontWeight: '700', color: colors.outline },
  bubbleRow:        { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: spacing.sm, alignSelf: 'flex-end' },
  bubbleRowMine:    { flexDirection: 'row', alignSelf: 'flex-start' },
  miniAvatar:       { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText:   { color: colors.white, fontSize: 11, fontWeight: '700' },
  bubble:           { padding: spacing.md, borderRadius: radius.lg },
  bubbleTheirs:     { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceContainerLow },
  bubbleMine:       { backgroundColor: colors.orangeVibrant },
  bubbleText:       { ...typography.bodySm, color: colors.charcoalText, textAlign: 'right', lineHeight: 20 },
  bubbleMetaRow:    { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 2, paddingHorizontal: 2 },
  bubbleMetaRowMine:{ flexDirection: 'row' },
  bubbleTime:       { fontSize: 10, color: colors.outline },
  inputRow:         { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.surfaceContainerLow },
  messageInput:     { flex: 1, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 10 },
  sendBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orangeVibrant, alignItems: 'center', justifyContent: 'center' },
  iconBtn:          { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});