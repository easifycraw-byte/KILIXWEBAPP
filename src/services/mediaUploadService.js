import { supabase } from '../config/supabaseConfig';
import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = 'media';

/**
 * قراءة ملف الجهاز بطريقة متوافقة مع Expo SDK 54 وAndroid release builds.
 * لا نعتمد على FileSystem.readAsStringAsync/EncodingType القديمة، لأن SDK 54
 * نقل هذه الواجهات إلى expo-file-system/legacy.
 */
const getFile = (fileUri) => {
  if (!fileUri) throw new Error('مسار الملف غير موجود');
  const file = new ExpoFile(fileUri);
  if (!file.exists) throw new Error('تعذر الوصول إلى الملف المحدد');
  return file;
};

const getFileInfo = async (fileSource, providedMimeType = '') => {
  if (!fileSource) throw new Error('الملف غير موجود');

  // Web: expo-image-picker returns the browser File object as asset.file.
  // Detect it by the standard File/Blob binary interface rather than
  // relying on instanceof, which can fail across browser realms.
  if (
    typeof fileSource === 'object' &&
    typeof fileSource.arrayBuffer === 'function' &&
    typeof fileSource.size === 'number'
  ) {
    const type = String(providedMimeType || fileSource.type || '').toLowerCase();
    return {
      size: Number(fileSource.size) || 0,
      type,
      extension: type === 'image/png'
        ? '.png'
        : type === 'image/webp'
          ? '.webp'
          : type.startsWith('image/')
            ? '.jpg'
            : type.includes('quicktime')
              ? '.mov'
              : type.includes('webm')
                ? '.webm'
                : type.startsWith('video/')
                  ? '.mp4'
                  : '',
      arrayBuffer: () => fileSource.arrayBuffer(),
    };
  }

  // Native platforms: the URI is handled by Expo FileSystem's File API.
  if (Platform.OS !== 'web') {
    return getFile(fileSource);
  }

  // Web fallback for a URI/string returned by the picker.
  try {
    const response = await fetch(fileSource);
    if (!response.ok) throw new Error('تعذر الوصول إلى الصورة المحددة');
    const blob = await response.blob();
    const type = String(providedMimeType || blob.type || '').toLowerCase();
    return {
      size: Number(blob.size) || 0,
      type,
      extension: type === 'image/png'
        ? '.png'
        : type === 'image/webp'
          ? '.webp'
          : type.startsWith('image/')
            ? '.jpg'
            : '',
      arrayBuffer: () => blob.arrayBuffer(),
    };
  } catch (error) {
    console.error('❌ Web file read error:', error);
    throw new Error('تعذر قراءة الملف المحدد من المتصفح');
  }
};

/**
 * يقرأ الملف من الجهاز على iOS/Android، أو من URI الخاص بالويب.
 * في React Native Web يعيد Expo ImagePicker غالباً blob/data URI،
 * وليس مسار ملف محلي يمكن لـ expo-file-system.File قراءته مباشرة.
 */


/**
 * ✅ الحصول على حجم الملف
 */
export const getFileSizeFromUri = async (fileUri) => {
  try {
    const file = await getFileInfo(fileUri);
    return Number(file.size) || 0;
  } catch (error) {
    console.error('❌ Error getting file size:', error);
    return 0;
  }
};

const getMimeAndExtension = (file, fallbackType = 'image', providedMimeType = '') => {
  const mime = String(providedMimeType || file.type || '').toLowerCase();
  if (mime.startsWith('image/')) {
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    return { mime: mime || 'image/jpeg', ext };
  }
  if (mime.startsWith('video/')) {
    const ext = mime.includes('quicktime') ? 'mov' : mime.includes('webm') ? 'webm' : 'mp4';
    return { mime: mime || 'video/mp4', ext };
  }
  return fallbackType === 'video'
    ? { mime: 'video/mp4', ext: 'mp4' }
    : { mime: 'image/jpeg', ext: 'jpg' };
};

const readFileBytes = async (fileSource) => {
  try {
    return await getFileInfo(fileSource).then((file) => file.arrayBuffer());
  } catch (error) {
    console.error('❌ Error reading file bytes:', error);
    throw new Error('فشل قراءة الصورة/الملف من الجهاز');
  }
};

/**
 * ✅ رفع صورة - متوافق مع Android release وExpo Go
 */

/**
 * رفع صورة الملف التعريفي للمتجر داخل مساحة تخزين مستقلة.
 * لا يستخدم مسارات المنتجات ولا يغيّر منطق رفع صور المنتجات.
 */
export const uploadStoreLogo = async (fileUri, storeId, providedMimeType = '') => {
  try {
    if (!fileUri || !storeId) throw new Error('بيانات صورة المتجر غير مكتملة');

    const file = await getFileInfo(fileUri, providedMimeType);
    const fileSize = Number(file.size) || 0;
    if (fileSize === 0) throw new Error('الملف فارغ أو تالف');
    if (fileSize > MAX_IMAGE_SIZE) throw new Error('حجم صورة المتجر يتجاوز 10MB');

    const { mime, ext } = getMimeAndExtension(file, 'image', providedMimeType);
    if (!mime.startsWith('image/')) throw new Error('الملف المحدد ليس صورة');

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).slice(2, 9);
    const storagePath = `stores/${storeId}/avatar/store_${timestamp}_${randomString}.${ext}`;
    const fileBytes = await readFileBytes(fileUri);

    const { error } = await supabase.storage
      .from('store-avatars')
      .upload(storagePath, fileBytes, {
        contentType: mime,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw new Error(`فشل رفع صورة المتجر: ${error.message}`);

    const { data: urlData } = supabase.storage.from('store-avatars').getPublicUrl(storagePath);
    if (!urlData?.publicUrl) throw new Error('تم رفع الصورة لكن تعذر إنشاء رابطها');
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Error uploading store logo:', error);
    throw error;
  }
};

export const uploadImage = async (fileUri, storeId, productId = null, providedMimeType = '') => {
  try {
    if (!fileUri || !storeId) throw new Error('بيانات غير كاملة');

    const file = await getFileInfo(fileUri, providedMimeType);
    const fileSize = Number(file.size) || 0;
    if (fileSize === 0) throw new Error('الملف فارغ أو تالف');
    if (fileSize > MAX_IMAGE_SIZE) {
      throw new Error(`حجم الصورة يتجاوز 10MB (الحالي: ${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    const { mime, ext } = getMimeAndExtension(file, 'image', providedMimeType);
    if (!mime.startsWith('image/')) throw new Error('الملف المحدد ليس صورة');

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 9);
    const fileName = `image_${timestamp}_${randomString}.${ext}`;
    const storagePath = `stores/${storeId}/products/${productId || 'new'}/images/${fileName}`;

    console.log(`📤 Uploading image to: ${storagePath}`);

    const fileBytes = await readFileBytes(fileUri);
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBytes, {
        contentType: mime,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('❌ Upload error:', error);
      if (error.message?.includes('Bucket not found')) {
        throw new Error('مساحة التخزين "media" غير موجودة في Supabase.');
      }
      throw new Error(`فشل الرفع: ${error.message}`);
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    if (!urlData?.publicUrl) throw new Error('تم رفع الصورة لكن تعذر إنشاء رابطها');

    console.log('✅ Image uploaded:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    throw error;
  }
};

/**
 * ✅ رفع فيديو - بنفس مسار القراءة الآمن للـ release build
 */
export const uploadVideo = async (fileUri, storeId, productId = null, providedMimeType = '') => {
  try {
    if (!fileUri || !storeId) throw new Error('بيانات غير كاملة');

    const file = await getFileInfo(fileUri, providedMimeType);
    const fileSize = Number(file.size) || 0;
    if (fileSize === 0) throw new Error('الملف فارغ أو تالف');
    if (fileSize > MAX_VIDEO_SIZE) {
      throw new Error(`حجم الفيديو يتجاوز 100MB (الحالي: ${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    const { mime, ext } = getMimeAndExtension(file, 'video', providedMimeType);
    if (!mime.startsWith('video/')) throw new Error('الملف المحدد ليس فيديو');

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 9);
    const fileName = `video_${timestamp}_${randomString}.${ext}`;
    const storagePath = `stores/${storeId}/products/${productId || 'new'}/videos/${fileName}`;

    console.log(`📤 Uploading video to: ${storagePath}`);
    const fileBytes = await readFileBytes(fileUri);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBytes, {
        contentType: mime,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('❌ Upload error:', error);
      if (error.message?.includes('Bucket not found')) {
        throw new Error('مساحة التخزين "media" غير موجودة في Supabase.');
      }
      throw new Error(`فشل الرفع: ${error.message}`);
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    if (!urlData?.publicUrl) throw new Error('تم رفع الفيديو لكن تعذر إنشاء رابطه');
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Error uploading video:', error);
    throw error;
  }
};

/**
 * ✅ رفع صور متعددة
 */
const mapWithUploadConcurrency = async (items, worker, concurrency = 3) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = null;
      }
    }
  });
  await Promise.all(runners);
  return results;
};

export const uploadMultipleImages = async (fileUris, storeId, productId = null) => {
  if (!Array.isArray(fileUris) || fileUris.length === 0) return [];
  const results = await mapWithUploadConcurrency(fileUris, (uri) =>
    uploadImage(uri, storeId, productId).catch((error) => {
      console.error('❌ Error uploading single image:', error);
      return null;
    }), 3
  );
  return results.filter((url) => url !== null);
};

/**
 * ✅ رفع فيديوهات متعددة
 */
export const uploadMultipleVideos = async (fileUris, storeId, productId = null) => {
  if (!Array.isArray(fileUris) || fileUris.length === 0) return [];
  const results = await mapWithUploadConcurrency(fileUris, (uri) =>
    uploadVideo(uri, storeId, productId).catch((error) => {
      console.error('❌ Error uploading single video:', error);
      return null;
    }), 2
  );
  return results.filter((url) => url !== null);
};

/**
 * ✅ حذف ملف من Storage
 */
export const deleteMediaFile = async (publicUrl) => {
  try {
    if (!publicUrl) return false;

    const urlParts = publicUrl.split(`/storage/v1/object/public/${BUCKET_NAME}/`);
    if (urlParts.length < 2) {
      console.error('❌ Invalid URL format');
      return false;
    }

    const storagePath = urlParts[1];
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.error('❌ Delete error:', error);
      return false;
    }

    console.log('✅ File deleted');
    return true;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
};

/**
 * ✅ التحقق من الملف قبل الرفع
 * لا نعتمد على امتداد URI فقط؛ Android release قد يعيد content:// URI بدون امتداد.
 */
export const validateMediaFile = async (fileUri, fileType, mimeType = '') => {
  try {
    const file = await getFileInfo(fileUri, mimeType);
    const fileSize = Number(file.size) || 0;
    const detectedMime = String(mimeType || file.type || '').toLowerCase();
    const extension = String(file.extension || '').replace('.', '').toLowerCase();

    const allowed = fileType === 'image'
      ? ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
      : ['mp4', 'mov', 'avi', 'webm', 'm4v'];

    const mimeOkay = fileType === 'image'
      ? detectedMime.startsWith('image/')
      : detectedMime.startsWith('video/');
    const extOkay = allowed.includes(extension);

    if (!mimeOkay && !extOkay) {
      return { isValid: false, error: `صيغة الملف غير مدعومة. الصيغ المسموحة: ${allowed.join(', ')}` };
    }
    if (fileSize === 0) return { isValid: false, error: 'الملف فارغ أو غير قابل للقراءة' };

    const maxSize = fileType === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (fileSize > maxSize) {
      return { isValid: false, error: `حجم الملف يتجاوز ${maxSize / 1024 / 1024}MB` };
    }
    return { isValid: true };
  } catch (error) {
    console.error('❌ Media validation error:', error);
    return { isValid: false, error: 'تعذر قراءة الملف من الجهاز' };
  }
};

/**
 * ✅ الحصول على رابط عام للملف
 */
export const getMediaPublicUrl = (storagePath) => {
  if (!storagePath) return null;
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);
  return data?.publicUrl || null;
};