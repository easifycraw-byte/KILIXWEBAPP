import { supabase } from '../config/supabaseConfig';

const getDisplayName = (row) => [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim() || 'مستخدم';

export async function getOrCreateChat(currentUserId, otherUserId, relatedOrderId = null) {
  if (!currentUserId || !otherUserId || currentUserId === otherUserId) throw new Error('معرفات المحادثة غير صالحة');
  // The RPC uses auth.uid() as the caller identity; currentUserId is validated client-side only.
  const { data, error } = await supabase.rpc('get_or_create_chat', { p_other_user_id: otherUserId, p_related_order_id: relatedOrderId });
  if (error) throw error;
  return data;
}

export async function sendMessage(conversationId, senderId, text) {
  const content = String(text || '').trim();
  if (!conversationId || !senderId || !content) return { success: false, error: 'بيانات الرسالة غير مكتملة' };
  const { data, error } = await supabase.from('chat_messages').insert({ chat_id: conversationId, sender_id: senderId, content }).select('*').single();
  return error ? { success: false, error: error.message } : { success: true, data };
}

export async function getChatMessages(conversationId, { limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const { data, error } = await supabase.from('chat_messages').select('id,chat_id,sender_id,content,read,created_at').eq('chat_id', conversationId).order('created_at', { ascending: true }).range(safeOffset, safeOffset + safeLimit - 1);
  if (error) throw error;
  return data || [];
}

export async function getUserChats(userId) {
  if (!userId) return [];
  const { data: chats, error } = await supabase
    .from('chats')
    .select('id,participant_1_id,participant_2_id,related_order_id,last_message_at,created_at,updated_at')
    .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  if (!chats?.length) return [];

  const otherIds = [...new Set(chats.map((c) => c.participant_1_id === userId ? c.participant_2_id : c.participant_1_id))];
  const relatedOrderIds = [...new Set(chats.map((c) => c.related_order_id).filter(Boolean))];

  const [{ data: profiles, error: profilesError }, { data: stores, error: storesError }, { data: ownStores, error: ownStoresError }, { data: relatedOrders, error: relatedOrdersError }] = await Promise.all([
    supabase.from('public_profiles').select('auth_id,user_code,first_name,last_name,avatar_url').in('auth_id', otherIds),
    supabase.from('stores').select('owner_id,store_name,logo_url').in('owner_id', otherIds),
    supabase.from('stores').select('id,owner_id').eq('owner_id', userId),
    relatedOrderIds.length
      ? supabase.from('orders').select('id,store_id,user_id').in('id', relatedOrderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesError) throw profilesError;
  if (storesError) throw storesError;
  if (ownStoresError) throw ownStoresError;
  if (relatedOrdersError) throw relatedOrdersError;

  const profilesMap = new Map((profiles || []).map((p) => [p.auth_id, p]));
  const storesMap = new Map((stores || []).map((st) => [st.owner_id, st]));
  const ownStoreIds = new Set((ownStores || []).map((st) => st.id));
  const ordersMap = new Map((relatedOrders || []).map((o) => [o.id, o]));

  // Resolve per-chat message metadata concurrently. The previous sequential
  // loop performed two round-trips per chat one after another (2N latency).
  // Promise.all keeps the same result while allowing the database/client to
  // overlap independent reads.
  const result = await Promise.all(chats.map(async (chat) => {
    const otherId = chat.participant_1_id === userId ? chat.participant_2_id : chat.participant_1_id;
    const profile = profilesMap.get(otherId);
    const otherStore = storesMap.get(otherId);
    const relatedOrder = chat.related_order_id ? ordersMap.get(chat.related_order_id) : null;

    // Order conversations are role-aware: the merchant sees the buyer's registered
    // name, while the buyer sees the merchant's store name. Generic conversations
    // opened from a store use the store name for the store owner.
    const currentUserIsMerchantForOrder = !!relatedOrder && ownStoreIds.has(relatedOrder.store_id) && relatedOrder.user_id === otherId;
    const displayName = currentUserIsMerchantForOrder
      ? getDisplayName(profile)
      : (otherStore?.store_name?.trim() || getDisplayName(profile));
    const avatarUrl = currentUserIsMerchantForOrder
      ? (profile?.avatar_url || otherStore?.logo_url || null)
      : (otherStore?.logo_url || profile?.avatar_url || null);

    const [unreadResult, latest] = await Promise.all([
      supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .eq('read', false)
        .neq('sender_id', userId),
      supabase
        .from('chat_messages')
        .select('content,created_at')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (unreadResult.error) throw unreadResult.error;
    if (latest.error) throw latest.error;

    return {
      id: chat.id,
      otherUserId: otherId,
      relatedOrderId: chat.related_order_id,
      name: displayName,
      avatarUrl,
      initial: displayName.slice(0, 1),
      color: '#1A237E',
      tag: null,
      tagColorKey: 'default',
      lastMessage: latest.data?.content || '',
      lastMessageDate: latest.data?.created_at || chat.last_message_at || chat.updated_at || chat.created_at,
      unread: unreadResult.count || 0,
    };
  }));
  return result;
}

export async function markMessageAsRead(messageId, userId) {
  const { error } = await supabase.from('chat_messages').update({ read: true }).eq('id', messageId).neq('sender_id', userId);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function markChatAsRead(chatId, userId) {
  const { error } = await supabase.from('chat_messages').update({ read: true }).eq('chat_id', chatId).neq('sender_id', userId);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function deleteChat(conversationId) {
  const { error } = await supabase.from('chats').delete().eq('id', conversationId);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function findChatWithUser(currentUserId, otherUserId) {
  const { data, error } = await supabase.from('chats').select('*').or(`and(participant_1_id.eq.${currentUserId},participant_2_id.eq.${otherUserId}),and(participant_1_id.eq.${otherUserId},participant_2_id.eq.${currentUserId})`).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getUnreadMessageCount(userId) {
  const { data: chats, error } = await supabase.from('chats').select('id').or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`);
  if (error) throw error;
  const ids = (chats || []).map((c) => c.id);
  if (!ids.length) return 0;
  const { count, error: countError } = await supabase.from('chat_messages').select('id', { count: 'exact', head: true }).in('chat_id', ids).neq('sender_id', userId).eq('read', false);
  if (countError) throw countError;
  return count || 0;
}

export function subscribeToChat(conversationId, callback) {
  if (!conversationId) return () => {};
  const channel = supabase.channel(`chat:${conversationId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${conversationId}` }, callback).subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function subscribeToUserChats(userId, callback) {
  if (!userId) return () => {};
  const channel = supabase.channel(`user-chats:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, callback)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, callback)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
