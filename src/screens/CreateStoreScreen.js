import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { createStoreService, getStoreByOwner, updateStoreService } from '../services/storeService';
import { createProduct, updateProduct, deleteProduct, getProducts } from '../services/productService';
import { getBillingSummary, getPaymentHistory, recordPayment, BILLING_THRESHOLD } from '../services/billingService';
import { merchantUpdateOrderStatus, getStoreOrders } from '../services/orderService';
import { setupTableListener } from '../services/Realtimeservice';
import { ORDER_STATUS } from '../constants/orderStatus';
import { pickImage, pickVideo, requestMediaPermissions, formatFileSize } from '../utils/mediaPickerUtil';
import { uploadImage, uploadVideo, uploadStoreLogo, validateMediaFile } from '../services/mediaUploadService';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  Share,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
  RefreshControl,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const colors = {
  backgroundLight: '#F5F5F5',
  white: '#FFFFFF',
  charcoalText: '#1A1A1A',
  borderLight: '#E0E0E0',
  orangeVibrant: '#FF6B00',
  navyDeep: '#1A237E',
  outline: '#757575',
  success: '#2E7D32',
  error: '#C62828',
  warning: '#E65100',
};

const PRODUCT_CATEGORY_OPTIONS = [
  { key: 'electronics', label: 'إلكترونيات' },
  { key: 'clothing', label: 'نسيج وملابس' },
  { key: 'home', label: 'أدوات منزلية' },
  { key: 'construction', label: 'بناء وإنشاء' },
  { key: 'other', label: 'أخرى' },
];

// خيارات نوع المنتج الظاهرة للتاجر. المفاتيح الجديدة مستقلة عن تصنيفات المتجر
// حتى لا نخلط بين نوع المنتج (template) وتصنيف المنتج (category).
const PRODUCT_TEMPLATES = [
  { key: 'women', label: 'للنساء' },
  { key: 'electronics', label: 'الإلكترونيات' },
  { key: 'fashion_accessories', label: 'إكسسوارات للأزياء' },
  { key: 'jewelry', label: 'المجوهرات' },
  { key: 'clothing_shoes', label: 'ملابس و أحذية' },
  { key: 'toys_hobbies', label: 'ألعاب وهوايات' },
  { key: 'security_protection', label: 'الأمن و الحماية' },
  { key: 'mothers_kids', label: 'الأمهات و الأطفال' },
  { key: 'beauty_health', label: 'الجمال والصحة' },
  { key: 'cars', label: 'للسيارات' },
];

const NEW_SIZE_OPTIONS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54'];
const NEW_RAM_OPTIONS = ['4GB', '6GB', '8GB', '12GB', '16GB', '24GB', '32GB', '64GB'];
const NEW_STORAGE_OPTIONS = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '1TB SSD', '2TB', '4TB'];
const NEW_COLOR_OPTIONS = ['أبيض', 'أسود', 'أزرق', 'أزرق داكن', 'رمادي', 'فضي', 'ذهبي', 'أسود عسكري', 'أحمر', 'أحمر خمري', 'أخضر', 'أصفر', 'برتقالي', 'وردي', 'بنفسجي', 'بني', 'بيج', 'فيروزي', 'أزرق سماوي'];

// أسماء الأنواع القديمة تبقى مفهومة عند فتح منتج سبق إنشاؤه قبل هذا التعديل.
const LEGACY_TEMPLATE_LABELS = {
  clothing: 'أزياء وملابس',
  computer: 'حواسيب وأجهزة',
  phone: 'هواتف ذكية',
  watch: 'ساعات وإكسسوارات',
  home: 'أجهزة منزلية',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const radius = {
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
};

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};

const screenWidth = Dimensions.get('window').width;

// روابط تحديث التطبيق الرسمية. Android يعتمد على package المشروع الحالي.
const ANDROID_APP_STORE_URL = 'https://play.google.com/store/search?q=Kilix&c=apps';
// يجب استبدال هذا الرابط بمعرّف تطبيق Kilix الفعلي في App Store عند نشر نسخة iOS.
const IOS_APP_STORE_URL = 'https://apps.apple.com/us/search?term=Kilix';

export default function CreateStoreScreen({ navigation }) {
  // ==================== جميع الـ States ====================
  
  const [currentScreen, setCurrentScreen] = useState('setup_store');
  const [checkingStore, setCheckingStore] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Store Setup States
  const [storeName, setStoreName] = useState('');
  const [storeType, setStoreType] = useState('wholesaler');
  const [storeProductsType, setStoreProductsType] = useState('');
  const [storeDesc, setStoreDesc] = useState('');
  const [storeLogoUri, setStoreLogoUri] = useState(null);
  const [uploadingStoreLogo, setUploadingStoreLogo] = useState(false);
  const [currency, setCurrency] = useState('دج');
  const [storeDocId, setStoreDocId] = useState(null);
  const [storeCode, setStoreCode] = useState('');

  // Products States
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Orders States
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Refs for cleanup
  const ordersMapRef = useRef({});

  // Subscription & Usage States
  const [maxLimit, setMaxLimit] = useState(BILLING_THRESHOLD);
  const [currentUsage, setCurrentUsage] = useState(0); // accumulated fee
  const [outstandingFee, setOutstandingFee] = useState(0);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const openUpdateRequired = () => {
    setUpdateRequiredModalVisible(true);
  };

  const openUpdatePlatformChooser = () => {
    setUpdateRequiredModalVisible(false);
    setUpdatePlatformModalVisible(true);
  };

  const openStoreLink = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        alert('تعذر فتح متجر التطبيقات. يرجى المحاولة مرة أخرى.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      if (__DEV__) console.error('[CreateStoreScreen] update store link error:', error);
      alert('تعذر فتح متجر التطبيقات.');
    } finally {
      setUpdatePlatformModalVisible(false);
    }
  };

  // Modal States
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [updateRequiredModalVisible, setUpdateRequiredModalVisible] = useState(false);
  const [updatePlatformModalVisible, setUpdatePlatformModalVisible] = useState(false);
  const [feeDetailsVisible, setFeeDetailsVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [confirmDeleteModalVisible, setConfirmDeleteModalVisible] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState(null);

  // New Product Form States
  const [newTemplate, setNewTemplate] = useState('clothing');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRam, setNewRam] = useState([]);
  const [newStorage, setNewStorage] = useState([]);
  const [newSizes, setNewSizes] = useState([]);
  const [newColors, setNewColors] = useState([]);
  const [customOptionModal, setCustomOptionModal] = useState({ visible: false, type: null, value: '' });
  const [newImages, setNewImages] = useState([]);
  const [newVideos, setNewVideos] = useState([]);
  const [newMinOrderQuantity, setNewMinOrderQuantity] = useState('1');
  const [newMaxOrderQuantity, setNewMaxOrderQuantity] = useState('1000000');
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('electronics');
  const [savingProduct, setSavingProduct] = useState(false);

  // Edit Product Form States
  const [editTemplate, setEditTemplate] = useState('clothing');
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRam, setEditRam] = useState([]);
  const [editStorage, setEditStorage] = useState([]);
  const [editSizes, setEditSizes] = useState([]);
  const [editColors, setEditColors] = useState([]);
  const [editImages, setEditImages] = useState([]);
  const [editVideos, setEditVideos] = useState([]);
  const [editMinOrderQuantity, setEditMinOrderQuantity] = useState('1');
  const [editMaxOrderQuantity, setEditMaxOrderQuantity] = useState('1000000');
  const [editDropdownOpen, setEditDropdownOpen] = useState(false);
  const [editCategory, setEditCategory] = useState('electronics');

  // Media Upload States
  const [uploadingNewImages, setUploadingNewImages] = useState(false);
  const [uploadingNewVideos, setUploadingNewVideos] = useState(false);
  const [uploadingEditImages, setUploadingEditImages] = useState(false);
  const [uploadingEditVideos, setUploadingEditVideos] = useState(false);

  // Status Labels
  const ORDER_STATUS_LABELS = {
    [ORDER_STATUS.PENDING]: 'قيد الانتظار',
    [ORDER_STATUS.SHIPPING]: 'قيد الشحن',
    [ORDER_STATUS.DELIVERED]: 'تم الاستلام',
    [ORDER_STATUS.COMPLETED]: 'مكتمل',
    [ORDER_STATUS.OUT_OF_STOCK]: 'نفد المخزون',
    [ORDER_STATUS.CANCELLED]: 'ملغاة',
  };

  const mapMerchantOrder = (order) => ({
    id: order.id,
    customerId: order.customerId || null,
    customerName: order.customerName || '',
    phone: order.phone || '',
    status: ORDER_STATUS_LABELS[order.status] || order.status || 'قيد الانتظار',
    rawStatus: order.status || ORDER_STATUS.PENDING,
    title: order.title || '',
    quantity: Number(order.qty) || 0,
    total: Number(order.total) || 0,
    unitPrice: Number(order.unitPrice) || 0,
    currency: order.currency || 'دج',
    deliveryType: order.deliveryType || '',
    wilaya: order.wilaya || '',
    commune: order.commune || '',
    streetAddress: order.streetAddress || '',
    notes: order.notes || '',
    details: Array.isArray(order.details) ? order.details : [],
    created_at: order.date,
  });

  const formatOrderOptionValue = (value) => {
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value)) return value.join('، ');
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  };

  const getDeliveryTypeLabel = (deliveryType) => {
    if (deliveryType === 'office') return 'مكتب التوصيل';
    if (deliveryType === 'home') return 'البيت';
    return deliveryType || 'غير محدد';
  };

  // ==================== Effects ====================

  // فحص وجود المتجر عند فتح التطبيق
  useEffect(() => {
    const checkExistingStore = async () => {
      const userId = user?.auth_id;
      if (!userId) {
        setCheckingStore(false);
        return;
      }

      try {
        const storeData = await getStoreByOwner(userId);
        if (storeData) {
          setStoreDocId(storeData.id);
          setStoreCode(storeData.store_code || '');
          setStoreName(storeData.store_name || '');
          setStoreProductsType(storeData.products_type || '');
          setStoreDesc(storeData.description || '');
          setStoreType(storeData.merchant_type || 'wholesaler');
          setCurrentScreen('orders');
        }
      } catch (error) {
        console.log('Error checking store on start:', error);
      } finally {
        setCheckingStore(false);
      }
    };

    checkExistingStore();
  }, [user]);

  // جلب الاستحقاق المالي الحقيقي من قاعدة البيانات. لا توجد قيم تجريبية.
  useEffect(() => {
    if (!storeDocId) {
      setCurrentUsage(0);
      setOutstandingFee(0);
      setPaymentHistory([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const [summary, history] = await Promise.all([getBillingSummary(storeDocId), getPaymentHistory(storeDocId)]);
        if (!active) return;
        setCurrentUsage(Number(summary.accumulated_fee) || 0);
        setOutstandingFee(Number(summary.outstanding_fee) || 0);
        setMaxLimit(Number(summary.payment_threshold) || BILLING_THRESHOLD);
        setPaymentHistory(history || []);
      } catch (error) {
        if (__DEV__) console.error('[CreateStoreScreen] billing load error:', error);
        if (active) { setCurrentUsage(0); setOutstandingFee(0); setPaymentHistory([]); }
      }
    })();
    return () => { active = false; };
  }, [storeDocId]);

  // الاشتراك في طلبات المتجر - Real-time
  useEffect(() => {
    const currentStoreId = storeDocId;
    if (!currentStoreId) { setOrders([]); setLoadingOrders(false); return; }
    let active = true;
    const refreshOrders = async () => {
      try {
        setLoadingOrders(true);
        const rows = await getStoreOrders(currentStoreId);
        if (!active) return;
        const mapped = rows.map(mapMerchantOrder);
        setOrders(mapped);
        ordersMapRef.current = Object.fromEntries(mapped.map((row) => [row.id, row]));
      } catch (error) {
        if (__DEV__) console.error('[CreateStoreScreen] orders load error:', error);
        if (active) setOrders([]);
      } finally { if (active) setLoadingOrders(false); }
    };
    void refreshOrders();
    const unsubscribe = setupTableListener('orders', currentStoreId, refreshOrders);
    return () => { active = false; unsubscribe(); };
  }, [storeDocId]);

  // الاشتراك في منتجات المتجر - Real-time
  useEffect(() => {
    const currentStoreId = storeDocId;
    if (!currentStoreId) { setProducts([]); setLoadingProducts(false); return; }
    let active = true;
    const refreshProducts = async () => {
      try {
        setLoadingProducts(true);
        const rows = await getProducts({ storeId: currentStoreId, includeInactive: false });
        if (!active) return;
        setProducts(rows.map(mapSupabaseProductDoc));
      } catch (error) {
        if (__DEV__) console.error('[CreateStoreScreen] products load error:', error);
        if (active) setProducts([]);
      } finally { if (active) setLoadingProducts(false); }
    };
    void refreshProducts();
    const unsubscribe = setupTableListener('products', currentStoreId, refreshProducts);
    return () => { active = false; unsubscribe(); };
  }, [storeDocId]);

  // ==================== Helper Functions ====================


  const mapSupabaseProductDoc = (product) => {
    return {
      id: product.id,
      name: product.title || '',
      price: typeof product.price === 'number' ? String(product.price) : (product.price || ''),
      template: product.template || 'clothing',
      category: product.category || 'electronics',
      desc: product.description || '',
      description: product.description || '',
      ram: Array.isArray(product.ram) ? product.ram : [],
      storage: Array.isArray(product.storage) ? product.storage : [],
      sizes: Array.isArray(product.sizes) ? product.sizes : [],
      colors: Array.isArray(product.colors) ? product.colors : [],
      min_order_quantity: Number(product.min_order_quantity) || 1,
      max_order_quantity: Number(product.max_order_quantity) || 1000000,
      images: Array.isArray(product.images) ? product.images : [],
      videos: Array.isArray(product.videos) ? product.videos : [],
    };
  };

  const getTemplateBadgeText = (tmpl) => {
    const template = PRODUCT_TEMPLATES.find((t) => t.key === tmpl);
    if (template) return template.label;
    return LEGACY_TEMPLATE_LABELS[tmpl] || 'عام';
  };

  // ==================== Orders Management ====================

  const updateOrderStatus = async (orderId, newStatus, statusLabel) => {
    try {
      await merchantUpdateOrderStatus(orderId, newStatus);
      alert(`تم تحديث الطلبية إلى: ${statusLabel}`);
    } catch (error) {
      if (__DEV__) console.error('[CreateStoreScreen] order update error:', error);
      alert(error?.message || 'تعذّر تحديث الطلبية.');
    }
  };

  const handleConfirmOrder = (orderId) => {
    updateOrderStatus(orderId, ORDER_STATUS.SHIPPING, 'قيد الشحن');
  };

  const handleOutOfStockOrder = (orderId) => {
    updateOrderStatus(orderId, 'out_of_stock', 'نفد المخزون');
  };


  // ==================== Products Management ====================

  const openCustomOptionModal = (type) => setCustomOptionModal({ visible: true, type, value: '' });
  const closeCustomOptionModal = () => setCustomOptionModal({ visible: false, type: null, value: '' });
  const handleAddCustomOption = () => {
    const value = String(customOptionModal.value || '').trim();
    if (!value) return;
    const isEdit = String(customOptionModal.type || '').startsWith('edit-');
    const isSize = customOptionModal.type === 'size' || customOptionModal.type === 'edit-size';
    const isRam = customOptionModal.type === 'ram' || customOptionModal.type === 'edit-ram';
    const isStorage = customOptionModal.type === 'storage' || customOptionModal.type === 'edit-storage';
    const current = isEdit ? (isSize ? editSizes : isRam ? editRam : isStorage ? editStorage : editColors) : (isSize ? newSizes : isRam ? newRam : isStorage ? newStorage : newColors);
    const setter = isEdit ? (isSize ? setEditSizes : isRam ? setEditRam : isStorage ? setEditStorage : setEditColors) : (isSize ? setNewSizes : isRam ? setNewRam : isStorage ? setNewStorage : setNewColors);
    if (!current.some((item) => String(item).trim().toLowerCase() === value.toLowerCase())) {
      setter([...current, value]);
    }
    closeCustomOptionModal();
  };

  // Keep custom values visible in the selector immediately after adding them.
  // Fixed options are shown first, followed by any custom values already selected.
  const getVisibleOptions = (fixedOptions, selectedValues) => {
    const selected = Array.isArray(selectedValues) ? selectedValues : [];
    return [...fixedOptions, ...selected.filter((value) => !fixedOptions.some((fixed) => String(fixed).trim().toLowerCase() === String(value).trim().toLowerCase()))];
  };

  const handleAddNewProduct = async () => {
    if (!newName.trim() || !newPrice.trim() || !newDesc.trim()) { alert('يرجى إدخال اسم المنتج والسعر والوصف.'); return; }
    if (!storeDocId) { alert('يجب إنشاء المتجر أولاً.'); return; }
    const minOrder = Number(newMinOrderQuantity);
    const maxOrder = Number(newMaxOrderQuantity);
    if (!Number.isInteger(minOrder) || minOrder < 1 || !Number.isInteger(maxOrder) || maxOrder < minOrder) { alert('الحد الأدنى والحد الأقصى للطلب غير صالحين.'); return; }
    setSavingProduct(true);
    try {
      await createProduct(storeDocId, {
        title: newName.trim(), price: Number(newPrice), description: newDesc.trim(), category: newCategory, template: newTemplate,
        images: newImages, videos: newVideos, ram: newRam, storage: newStorage, sizes: newSizes, colors: newColors,
        min_order_quantity: Number(newMinOrderQuantity), max_order_quantity: Number(newMaxOrderQuantity),
      });
      setNewName(''); setNewPrice(''); setNewDesc(''); setNewCategory('electronics'); setNewTemplate('clothing');
      setNewRam([]); setNewStorage([]); setNewSizes([]); setNewColors([]); setNewImages([]); setNewVideos([]); setNewMinOrderQuantity('1'); setNewMaxOrderQuantity('1000000'); setAddModalVisible(false); setSuccessModalVisible(true);
    } catch (error) {
      if (__DEV__) console.error('Error publishing product:', error);
      alert(error.message || 'حدث خطأ أثناء نشر المنتج.');
    } finally { setSavingProduct(false); }
  };

  const handleSaveEditedProduct = async () => {
    if (!selectedProduct) return;
    const minOrder = Number(editMinOrderQuantity);
    const maxOrder = Number(editMaxOrderQuantity);
    if (!Number.isInteger(minOrder) || minOrder < 1 || !Number.isInteger(maxOrder) || maxOrder < minOrder) {
      alert('الحد الأدنى والحد الأقصى للطلب غير صالحين.');
      return;
    }
    try {
      await updateProduct(selectedProduct.id, { title: editName.trim(), price: Number(editPrice), description: editDesc.trim(), category: editCategory, template: editTemplate, images: editImages, videos: editVideos, ram: editRam, storage: editStorage, sizes: editSizes, colors: editColors, min_order_quantity: Number(editMinOrderQuantity), max_order_quantity: Number(editMaxOrderQuantity) });
      setEditModalVisible(false); setSelectedProduct(null); alert('تم تعديل المنتج بنجاح!');
    } catch (error) {
      if (__DEV__) console.error('Error updating product:', error);
      alert(error.message || 'تعذّر حفظ التعديلات.');
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      await deleteProduct(productId);
      setProducts((current) => current.filter((product) => product.id !== productId));
      setConfirmDeleteModalVisible(false); setDeleteProductId(null); alert('تم حذف المنتج وإزالته من إدارة المخزن والعرض بنجاح.');
    } catch (error) {
      if (__DEV__) console.error('Error deleting product:', error);
      alert(error.message || 'تعذّر حذف المنتج.');
    }
  };

  const openEditModal = (item) => {
    setSelectedProduct(item);
    setEditName(item.name);
    setEditPrice(item.price);
    setEditTemplate(item.template || 'clothing');
    setEditDesc(item.desc || '');
    setEditCategory(item.category || 'electronics');
    setEditRam(item.ram || []);
    setEditStorage(item.storage || []);
    setEditSizes(item.sizes || []);
    setEditColors(item.colors || []);
    setEditMinOrderQuantity(String(item.min_order_quantity || 1));
    setEditMaxOrderQuantity(String(item.max_order_quantity || 1000000));
    setEditImages(item.images || []);
    setEditVideos(item.videos || []);
    setEditModalVisible(true);
  };

  const handleShareProduct = async (item) => {
    try {
      await Share.share({
        message: `شاهد هذا المنتج المميز من متجري: ${item.name} - السعر: ${item.price} ${currency}. اطلبه الآن عبر التطبيق!`,
        title: item.name,
      });
    } catch (error) {
      alert('حدث خطأ أثناء محاولة المشاركة');
    }
  };

  // ==================== Media Upload ====================

  const handlePickAndUploadNewImages = async () => {
    try {
      const currentStoreId = storeDocId;
      if (!currentStoreId) {
        alert('خطأ: لم يتمكن من تحديد معرف المتجر.');
        return;
      }

      const permissionResult = await requestMediaPermissions();
      if (!permissionResult.granted) {
        alert(permissionResult.error);
        return;
      }

      setUploadingNewImages(true);

      const imageData = await pickImage();
      if (!imageData) {
        setUploadingNewImages(false);
        return;
      }

      const mediaSource = imageData.file || imageData.uri;
      const validation = await validateMediaFile(mediaSource, 'image', imageData.mimeType);
      if (!validation.isValid) {
        alert(validation.error);
        setUploadingNewImages(false);
        return;
      }

      const downloadURL = await uploadImage(mediaSource, currentStoreId, null, imageData.mimeType);
      setNewImages([...newImages, downloadURL]);
      alert('تم رفع الصورة بنجاح!');
    } catch (error) {
      if (__DEV__) console.error('Error uploading new image:', error);
      alert(error.message || 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setUploadingNewImages(false);
    }
  };

  const handlePickAndUploadNewVideo = async () => {
    try {
      if (newVideos.length >= 1) {
        alert('يمكنك رفع فيديو واحد فقط لكل منتج.');
        return;
      }

      const currentStoreId = storeDocId;
      if (!currentStoreId) {
        alert('خطأ: لم يتمكن من تحديد معرف المتجر.');
        return;
      }

      const permissionResult = await requestMediaPermissions();
      if (!permissionResult.granted) {
        alert(permissionResult.error);
        return;
      }

      setUploadingNewVideos(true);

      const videoData = await pickVideo();
      if (!videoData) {
        setUploadingNewVideos(false);
        return;
      }

      const validation = await validateMediaFile(videoData.uri, 'video', videoData.mimeType);
      if (!validation.isValid) {
        alert(validation.error);
        setUploadingNewVideos(false);
        return;
      }

      const downloadURL = await uploadVideo(videoData.uri, currentStoreId, null, videoData.mimeType);
      setNewVideos([downloadURL]);
      alert('تم رفع الفيديو بنجاح!');
    } catch (error) {
      if (__DEV__) console.error('Error uploading new video:', error);
      alert(error.message || 'فشل رفع الفيديو. يرجى المحاولة مرة أخرى.');
    } finally {
      setUploadingNewVideos(false);
    }
  };

  const handlePickAndUploadEditImages = async () => {
    try {
      if (!selectedProduct) return;

      const currentStoreId = storeDocId;
      if (!currentStoreId) {
        alert('خطأ: لم يتمكن من تحديد معرف المتجر.');
        return;
      }

      const permissionResult = await requestMediaPermissions();
      if (!permissionResult.granted) {
        alert(permissionResult.error);
        return;
      }

      setUploadingEditImages(true);

      const imageData = await pickImage();
      if (!imageData) {
        setUploadingEditImages(false);
        return;
      }

      const mediaSource = imageData.file || imageData.uri;
      const validation = await validateMediaFile(mediaSource, 'image', imageData.mimeType);
      if (!validation.isValid) {
        alert(validation.error);
        setUploadingEditImages(false);
        return;
      }

      const downloadURL = await uploadImage(mediaSource, currentStoreId, selectedProduct.id, imageData.mimeType);
      setEditImages([...editImages, downloadURL]);
      alert('تم رفع الصورة بنجاح!');
    } catch (error) {
      if (__DEV__) console.error('Error uploading edit image:', error);
      alert(error.message || 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setUploadingEditImages(false);
    }
  };

  const handlePickAndUploadEditVideo = async () => {
    try {
      if (!selectedProduct) return;

      if (editVideos.length >= 1) {
        alert('يمكنك رفع فيديو واحد فقط لكل منتج.');
        return;
      }

      const currentStoreId = storeDocId;
      if (!currentStoreId) {
        alert('خطأ: لم يتمكن من تحديد معرف المتجر.');
        return;
      }

      const permissionResult = await requestMediaPermissions();
      if (!permissionResult.granted) {
        alert(permissionResult.error);
        return;
      }

      setUploadingEditVideos(true);

      const videoData = await pickVideo();
      if (!videoData) {
        setUploadingEditVideos(false);
        return;
      }

      const validation = await validateMediaFile(videoData.uri, 'video', videoData.mimeType);
      if (!validation.isValid) {
        alert(validation.error);
        setUploadingEditVideos(false);
        return;
      }

      const downloadURL = await uploadVideo(videoData.uri, currentStoreId, selectedProduct.id, videoData.mimeType);
      setEditVideos([downloadURL]);
      alert('تم رفع الفيديو بنجاح!');
    } catch (error) {
      if (__DEV__) console.error('Error uploading edit video:', error);
      alert(error.message || 'فشل رفع الفيديو. يرجى المحاولة مرة أخرى.');
    } finally {
      setUploadingEditVideos(false);
    }
  };

  // ==================== Store Setup ====================

  const handlePickStoreLogo = async () => {
    try {
      const permissionResult = await requestMediaPermissions();
      if (!permissionResult.granted) {
        alert(permissionResult.error);
        return;
      }
      const imageData = await pickImage();
      if (!imageData?.uri) return;
      const mediaSource = imageData.file || imageData.uri;
      const validation = await validateMediaFile(mediaSource, 'image', imageData.mimeType);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }
      setStoreLogoUri(imageData.uri);\n      setStoreLogoFile(imageData.file || null);
    } catch (error) {
      if (__DEV__) console.error('[CreateStoreScreen] store logo picker error:', error);
      alert(error?.message || 'تعذر اختيار صورة المتجر.');
    }
  };

  const handleSaveStoreToDatabase = async () => {
    if (!storeName.trim() || !storeProductsType.trim()) { alert('يرجى إدخال اسم المتجر ونوع المنتجات على الأقل.'); return; }
    const ownerId = user?.auth_id;
    if (!ownerId) { alert('خطأ: لم يتم التعرف على المستخدم الحالي.'); return; }
    setLoading(true);
    try {
      const result = await createStoreService(ownerId, { storeName: storeName.trim(), productsType: storeProductsType.trim(), description: storeDesc.trim(), merchantType: storeType });
      if (!result.success) throw new Error(result.message);
      setStoreDocId(result.storeId);
      setStoreCode(result.storeCode);

      let logoWarning = '';
      if (storeLogoUri) {
        setUploadingStoreLogo(true);
        try {
          const logoSource = storeLogoFile || storeLogoUri;\n          const logoUrl = await uploadStoreLogo(logoSource, result.storeId);
          await updateStoreService(result.storeId, { logo_url: logoUrl });
        } catch (logoError) {
          logoWarning = '\n⚠️ تم إنشاء المتجر، لكن تعذر رفع صورة المتجر. يمكنك المحاولة لاحقاً.';
          if (__DEV__) console.error('[CreateStoreScreen] store logo upload error:', logoError);
        } finally {
          setUploadingStoreLogo(false);
        }
      }

      setStoreLogoUri(null);
      alert(`✅ تم إنشاء متجرك بنجاح!\n📌 معرف البحث: ${result.storeCode}${logoWarning}`);
      setCurrentScreen('orders');
    } catch (error) {
      if (__DEV__) console.error('Error saving store:', error);
      alert(error.message || 'حدث خطأ أثناء الاتصال بقاعدة البيانات.');
    } finally { setLoading(false); }
  };

  const handleBackNavigation = () => {
    if (currentScreen === 'inventory') {
      setCurrentScreen('orders');
    } else if (currentScreen === 'payments' || currentScreen === 'history') {
      setCurrentScreen('inventory');
    } else if (currentScreen === 'orders') {
      navigation.navigate('Main', { screen: 'حسابي' });
    } else {
      setCurrentScreen('setup_store');
    }
  };

  const refreshOrders = async () => {
    if (!storeDocId) return;
    try { setLoadingOrders(true); const rows = await getStoreOrders(storeDocId); const mapped = rows.map(mapMerchantOrder); setOrders(mapped); } catch (error) { if (__DEV__) console.error('[CreateStoreScreen] orders refresh error:', error); } finally { setLoadingOrders(false); }
  };
  const refreshProducts = async () => {
    if (!storeDocId) return;
    try { setLoadingProducts(true); const rows = await getProducts({ storeId: storeDocId, includeInactive: false }); setProducts(rows.map(mapSupabaseProductDoc)); } catch (error) { if (__DEV__) console.error('[CreateStoreScreen] products refresh error:', error); } finally { setLoadingProducts(false); }
  };
  const refreshBilling = async () => {
    if (!storeDocId) return;
    try { const [summary, history] = await Promise.all([getBillingSummary(storeDocId), getPaymentHistory(storeDocId)]); setCurrentUsage(Number(summary.accumulated_fee) || 0); setOutstandingFee(Number(summary.outstanding_fee) || 0); setMaxLimit(Number(summary.payment_threshold) || BILLING_THRESHOLD); setPaymentHistory(history || []); } catch (error) { if (__DEV__) console.error('[CreateStoreScreen] billing refresh error:', error); }
  };

  // ==================== Render Logic ====================

  if (checkingStore) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={colors.orangeVibrant} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {currentScreen !== 'setup_store' && (
        <View style={styles.header}>
          <Pressable style={styles.headerIconBtn} onPress={handleBackNavigation}>
            <MaterialIcons name="arrow-forward" size={26} color={colors.charcoalText} />
          </Pressable>

          <Text style={styles.headerTitle}>{storeName}</Text>

          <Pressable style={styles.headerIconBtn} onPress={() => setDrawerOpen(!drawerOpen)}>
            <MaterialIcons name="menu" size={26} color={colors.charcoalText} />
          </Pressable>
        </View>
      )}

      {drawerOpen && (
        <View style={styles.drawer}>
          {[
            { key: 'orders', label: 'إدارة الطلبات', icon: 'shopping-bag' },
            { key: 'inventory', label: 'إدارة المخزون', icon: 'inventory' },
            { key: 'payments', label: 'المدفوعات والاشتراكات', icon: 'payment' },
            { key: 'history', label: 'السجل', icon: 'history' },
          ].map((item) => (
            <Pressable
              key={item.key}
              style={styles.drawerItem}
              onPress={() => {
                setCurrentScreen(item.key);
                setDrawerOpen(false);
              }}
            >
              <MaterialIcons name={item.icon} size={20} color={colors.navyDeep} />
              <Text style={styles.drawerText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flex: 1, padding: spacing.md }}>
        
        {currentScreen === 'setup_store' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
            <View style={styles.welcomeWrap}>
              <View style={styles.welcomeIconCircle}>
                <MaterialIcons name="store" size={48} color={colors.orangeVibrant} />
              </View>
              <Text style={styles.welcomeTitle}>إنشاء متجرك الجديد</Text>
              <Text style={styles.welcomeSub}>
                أدخل تفاصيل متجرك أدناه للبدء في إدارة الطلبات والمخزون بكل احترافية.
              </Text>

              <View style={[styles.card, { width: '100%', alignItems: 'stretch' }]}>
                <Text style={styles.sectionHeader}>بيانات المتجر الأساسية</Text>
                
                <Text style={styles.label}>صورة بروفايل المتجر (اختيارية)</Text>
                <View style={styles.storeLogoSetupCard}>
                  <View style={styles.storeLogoPreview}>
                    {storeLogoUri ? (
                      <Image source={{ uri: storeLogoUri }} style={styles.storeLogoPreviewImage} />
                    ) : (
                      <MaterialIcons name="storefront" size={38} color={colors.orangeVibrant} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.storeLogoHint}>ستظهر هذه الصورة للمستخدمين في صفحة المنتج وصفحة تفاصيل المتجر.</Text>
                    <Pressable style={styles.uploadBtn} onPress={handlePickStoreLogo} disabled={uploadingStoreLogo}>
                      <MaterialIcons name="add-a-photo" size={18} color={colors.charcoalText} />
                      <Text style={styles.uploadBtnText}>{storeLogoUri ? 'تغيير الصورة' : 'رفع صورة بروفايل'}</Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.label}>اسم المتجر</Text>
                <TextInput
                  style={styles.input}
                  value={storeName}
                  onChangeText={setStoreName}
                  placeholder="أدخل اسم المتجر"
                  placeholderTextColor={colors.outline}
                />

                <Text style={styles.label}>نوع المنتجات التي يبيعها المتجر</Text>
                <TextInput
                  style={styles.input}
                  value={storeProductsType}
                  onChangeText={setStoreProductsType}
                  placeholder="مثال: أزياء وملابس، هواتف ذكية..."
                  placeholderTextColor={colors.outline}
                />

                <Text style={styles.label}>نوع النشاط التجاري</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                  <Pressable
                    style={[styles.uploadBtn, { flex: 1 }, storeType === 'wholesaler' && { borderColor: colors.orangeVibrant, backgroundColor: '#FFF3E0' }]}
                    onPress={() => setStoreType('wholesaler')}
                  >
                    <Text style={[styles.uploadBtnText, storeType === 'wholesaler' && { color: colors.orangeVibrant }]}>بائع جملة</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.uploadBtn, { flex: 1 }, storeType === 'factory' && { borderColor: colors.orangeVibrant, backgroundColor: '#FFF3E0' }]}
                    onPress={() => setStoreType('factory')}
                  >
                    <Text style={[styles.uploadBtnText, storeType === 'factory' && { color: colors.orangeVibrant }]}>مصنع</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>وصف للمتجر</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  value={storeDesc}
                  onChangeText={setStoreDesc}
                  placeholder="اكتب وصفاً موجزاً عن متجرك..."
                  placeholderTextColor={colors.outline}
                />

                <Pressable 
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]} 
                  onPress={handleSaveStoreToDatabase}
                  disabled={loading || uploadingStoreLogo}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>استمرار</Text>
                      <MaterialIcons name="arrow-forward" size={18} color={colors.white} />
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {currentScreen === 'orders' && (
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionHeader}>إدارة ومتابعة الطلبات ({orders.length})</Text>
            
            {loadingOrders ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.orangeVibrant} />
              </View>
            ) : orders.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialIcons name="shopping-bag" size={48} color={colors.borderLight} />
                <Text style={{ marginTop: spacing.md, color: colors.outline }}>لا توجد طلبات حالياً</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={loadingOrders} onRefresh={refreshOrders} />} >
                {orders.map((order) => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderHeaderRow}>
                      <Text style={styles.orderId}>{order.id}</Text>
                      <Text style={[
                        styles.orderStatus, 
                        order.rawStatus === ORDER_STATUS.COMPLETED ? styles.statusGreen : 
                        order.status === 'نفد المخزون' ? styles.statusRed : styles.statusOrange
                      ]}>
                        {order.status}
                      </Text>
                    </View>
                    <Text style={styles.customerName}>الزبون: {order.customerName}</Text>
                    <Text style={styles.orderSubText}>رقم الهاتف: {order.phone}</Text>

                    <View style={[styles.orderActionRow, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs }]}>
                      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                        {order.rawStatus === ORDER_STATUS.PENDING && (
                          <Pressable style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => handleConfirmOrder(order.id)}>
                            <MaterialIcons name="check" size={16} color={colors.white} />
                            <Text style={styles.actionBtnText}>تأكيد</Text>
                          </Pressable>
                        )}
                        
                        {order.rawStatus === ORDER_STATUS.PENDING && (
                          <Pressable style={[styles.actionBtn, { backgroundColor: colors.error }]} onPress={() => handleOutOfStockOrder(order.id)}>
                            <MaterialIcons name="inventory" size={16} color={colors.white} />
                            <Text style={styles.actionBtnText}>نفد</Text>
                          </Pressable>
                        )}
                      </View>

                      <Pressable style={styles.actionBtn} onPress={() => setSelectedOrder(order)}>
                        <MaterialIcons name="visibility" size={16} color={colors.white} />
                        <Text style={styles.actionBtnText}>التفاصيل</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {currentScreen === 'inventory' && (
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionHeader}>إدارة المخزون والمنتجات ({products.length})</Text>
            
            {loadingProducts ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.orangeVibrant} />
              </View>
            ) : products.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <MaterialIcons name="inventory" size={48} color={colors.borderLight} />
                <Text style={{ marginTop: spacing.md, color: colors.outline }}>لا توجد منتجات حالياً</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={loadingProducts} onRefresh={refreshProducts} />} >
                {products.map((item) => (
                  <View key={item.id} style={styles.orderCard}>
                    <View style={styles.orderHeaderRow}>
                      <Text style={styles.orderId} numberOfLines={1}>{item.id}</Text>
                      <Text style={styles.productBadge}>{getTemplateBadgeText(item.template)}</Text>
                    </View>
                    <Text style={styles.customerName}>{item.name}</Text>
                    <Text style={styles.orderSubText}>السعر: <Text style={styles.boldText}>{item.price} {currency}</Text></Text>
                    
                    {item.desc ? <Text style={[styles.orderSubText, { marginTop: 4 }]} numberOfLines={2}>{item.desc}</Text> : null}

                    <View style={[styles.orderActionRow, { justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs }]}>
                      <Pressable style={[styles.actionBtn, { backgroundColor: colors.orangeVibrant }]} onPress={() => handleShareProduct(item)}>
                        <MaterialIcons name="share" size={16} color={colors.white} />
                        <Text style={styles.actionBtnText}>مشاركة</Text>
                      </Pressable>

                      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                        <Pressable style={styles.actionBtn} onPress={() => openEditModal(item)}>
                          <MaterialIcons name="edit" size={16} color={colors.white} />
                          <Text style={styles.actionBtnText}>تعديل</Text>
                        </Pressable>
                        <Pressable 
                          style={[styles.actionBtn, { backgroundColor: colors.error }]} 
                          onPress={() => {
                            setDeleteProductId(item.id);
                            setConfirmDeleteModalVisible(true);
                          }}
                        >
                          <MaterialIcons name="delete" size={16} color={colors.white} />
                          <Text style={styles.actionBtnText}>حذف</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <Pressable style={styles.floatingAddBtn} onPress={() => {
              setNewName('');
              setNewPrice('');
              setNewDesc('');
              setNewCategory('electronics');
              setNewTemplate('clothing');
              setNewRam([]);
              setNewStorage([]);
              setNewSizes([]);
              setNewColors([]);
              setNewMinOrderQuantity('1');
              setNewMaxOrderQuantity('1000000');
              setNewImages([]);
              setNewVideos([]);
              setAddModalVisible(true);
            }}>
              <MaterialIcons name="add" size={22} color={colors.white} />
              <Text style={styles.floatingAddBtnText}>إضافة منتج</Text>
            </Pressable>
          </View>
        )}

        {currentScreen === 'payments' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={paymentLoading} onRefresh={refreshBilling} />} >
            <View style={styles.feeNoticeCard}>
              <View style={styles.feeNoticeContent}>
                <MaterialIcons name="info-outline" size={22} color={colors.orangeVibrant} />
                <View style={styles.feeNoticeTextWrap}>
                  <Text style={styles.feeNoticeTitle}>ملاحظة بسيطة</Text>
                  <Text style={styles.feeNoticeText}>الرسوم التي يتم دفعها لا تتجاوز 0.3%</Text>
                </View>
              </View>
              <Pressable style={styles.feeDetailsBtn} onPress={() => setFeeDetailsVisible(true)}>
                <Text style={styles.feeDetailsBtnText}>مزيد من التفاصيل</Text>
                <MaterialIcons name="chevron-left" size={18} color={colors.orangeVibrant} />
              </Pressable>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <MaterialIcons name="analytics" size={22} color={colors.orangeVibrant} />
                <Text style={styles.cardTitle}>رسوم الاشتراك والطلبات</Text>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min((currentUsage / Math.max(maxLimit, 1)) * 100, 100)}%` }]} />
              </View>

              <View style={styles.progressInfoRow}>
                <Text style={styles.progressTextValue}>{Number(currentUsage).toLocaleString('ar-DZ')} دج رسوم متراكمة</Text>
                <Text style={styles.progressLabel}>المستحق للدفع: {Number(outstandingFee).toLocaleString('ar-DZ')} دج</Text>
              </View>

              <Pressable style={styles.primaryBtn} onPress={() => outstandingFee >= maxLimit && openUpdateRequired()}>
                <MaterialIcons name="payment" size={18} color={colors.white} />
                <Text style={styles.primaryBtnText}>{outstandingFee >= maxLimit ? 'دفع الرصيد المستحق' : 'لا يوجد رصيد مستحق للدفع'}</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionHeader}>سجل الفواتير والدفعات</Text>
            {paymentHistory.map((inv) => (
              <View key={inv.id} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <Text style={styles.historyId}>{inv.invoice_code || inv.id}</Text>
                  <Text style={styles.historyStatus}>{inv.status === 'paid' ? 'مدفوعة' : inv.status === 'pending' ? 'قيد المعالجة' : inv.status === 'failed' ? 'فشلت' : 'ملغاة'}</Text>
                </View>
                <View style={styles.historyDetailsRow}>
                  <Text style={styles.historyText}>المبلغ: <Text style={styles.boldText}>{Number(inv.amount || 0).toLocaleString('en-US')} دج</Text></Text>
                  <Text style={styles.historyText}>الطريقة: {inv.method || 'manual'}</Text>
                  <Text style={styles.historyText}>{inv.created_at ? new Date(inv.created_at).toLocaleDateString('ar-DZ') : ''}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {currentScreen === 'history' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={loadingOrders} onRefresh={refreshOrders} />} >
            <Text style={styles.sectionHeader}>سجل المعاملات والطلبات ({orders.length})</Text>
            <Text style={styles.cardSub}>اضغط على أي معاملة لعرض التفاصيل الكاملة.</Text>

            {orders.length === 0 ? (
              <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl }}>
                <MaterialIcons name="history" size={48} color={colors.borderLight} />
                <Text style={{ marginTop: spacing.md, color: colors.outline }}>لا توجد معاملات حالياً</Text>
              </View>
            ) : (
              orders.map((order) => (
                <Pressable 
                  key={order.id} 
                  style={styles.historyCard}
                  onPress={() => setSelectedOrder(order)}
                >
                  <View style={styles.historyRow}>
                    <Text style={styles.historyId}>{order.id} - {order.customerName}</Text>
                    <Text style={[
                      styles.orderStatus, 
                      order.rawStatus === ORDER_STATUS.COMPLETED ? styles.statusGreen : 
                      order.status === 'نفد المخزون' ? styles.statusRed : styles.statusOrange
                    ]}>
                      {order.status}
                    </Text>
                  </View>
                  <View style={styles.historyDetailsRow}>
                    <Text style={styles.historyText}>الهاتف: {order.phone}</Text>
                    <Text style={[styles.historyText, { color: colors.orangeVibrant, fontWeight: 'bold' }]}>عرض التفاصيل</Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* ==================== Modals ==================== */}

      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>تعديل بيانات المنتج</Text>

              <Text style={styles.label}>نموذج المنتج</Text>
              <Pressable style={styles.dropdownSelector} onPress={() => setEditDropdownOpen(!editDropdownOpen)}>
                <Text style={styles.dropdownText}>{getTemplateBadgeText(editTemplate)}</Text>
                <MaterialIcons name="arrow-drop-down" size={24} color={colors.charcoalText} />
              </Pressable>
              {editDropdownOpen && (
                <View style={styles.dropdownList}>
                  {PRODUCT_TEMPLATES.map((item) => (
                    <Pressable
                      key={item.key}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setEditTemplate(item.key);
                        setEditDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.label}>اسم المنتج</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="اسم المنتج"
                placeholderTextColor={colors.outline}
              />

              <Text style={styles.label}>السعر الأساسي (دج)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editPrice}
                onChangeText={setEditPrice}
                placeholder="0"
                placeholderTextColor={colors.outline}
              />

              <Text style={styles.label}>وصف المنتج</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                multiline
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="وصف المنتج"
                placeholderTextColor={colors.outline}
              />

              <Text style={styles.label}>تصنيف المنتج</Text>
              <View style={styles.chipsRow}>
                {PRODUCT_CATEGORY_OPTIONS.map((c) => {
                  const selected = editCategory === c.key;
                  return (
                    <Pressable
                      key={c.key}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setEditCategory(c.key)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {(editTemplate === 'computer' || editTemplate === 'phone' || editTemplate === 'electronics') && (
                <>
                  <Text style={styles.label}>خيارات الرام (RAM)</Text>
                  <View style={styles.chipsRow}>
                    {getVisibleOptions(NEW_RAM_OPTIONS, editRam).map((r) => {
                      const selected = editRam.includes(r);
                      return (
                        <Pressable
                          key={r}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            if (selected) setEditRam(editRam.filter((x) => x !== r));
                            else setEditRam([...editRam, r]);
                          }}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{r}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('ram')}>
                    <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                    <Text style={styles.addOptionText}>إضافة RAM مخصص</Text>
                  </Pressable>

                  <Text style={styles.label}>سعات التخزين</Text>
                  <View style={styles.chipsRow}>
                    {getVisibleOptions(NEW_STORAGE_OPTIONS, newStorage).map((s) => {
                      const selected = editStorage.includes(s);
                      return (
                        <Pressable
                          key={s}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            if (selected) setEditStorage(editStorage.filter((x) => x !== s));
                            else setEditStorage([...editStorage, s]);
                          }}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('edit-storage')}>
                    <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                    <Text style={styles.addOptionText}>إضافة تخزين مخصص</Text>
                  </Pressable>
                </>
              )}

              {(editTemplate === 'clothing' || editTemplate === 'women' || editTemplate === 'clothing_shoes' || editTemplate === 'mothers_kids') && (
                <>
                  <Text style={styles.label}>الأحجام المتوفرة</Text>
                  <View style={styles.chipsRow}>
                    {getVisibleOptions(NEW_SIZE_OPTIONS, editSizes).map((sz) => {
                      const selected = editSizes.includes(sz);
                      return (
                        <Pressable
                          key={sz}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            if (selected) setEditSizes(editSizes.filter((x) => x !== sz));
                            else setEditSizes([...editSizes, sz]);
                          }}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{sz}</Text>
                        </Pressable>
                      );
                    })}
                    <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('edit-size')}>
                      <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                      <Text style={styles.addOptionText}>إضافة مقاس</Text>
                    </Pressable>
                  </View>
                </>
              )}

              <Text style={styles.label}>الألوان المتوفرة</Text>
              <View style={styles.chipsRow}>
                {getVisibleOptions(NEW_COLOR_OPTIONS, editColors).map((c) => {
                  const selected = editColors.includes(c);
                  return (
                    <Pressable
                      key={c}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => {
                        if (selected) setEditColors(editColors.filter((x) => x !== c));
                        else setEditColors([...editColors, c]);
                      }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{c}</Text>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('edit-color')}>
                  <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                  <Text style={styles.addOptionText}>إضافة لون</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, { marginTop: spacing.md }]}>الحد الأدنى للطلب</Text>
              <TextInput
                style={styles.input}
                placeholder="مثال: 1"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                value={editMinOrderQuantity}
                onChangeText={setEditMinOrderQuantity}
              />

              <Text style={styles.label}>الحد الأقصى للطلب</Text>
              <TextInput
                style={styles.input}
                placeholder="مثال: 100"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                value={editMaxOrderQuantity}
                onChangeText={setEditMaxOrderQuantity}
              />

              <Text style={[styles.label, { marginTop: spacing.md }]}>رفع الصور والفيديوهات</Text>
              <View style={styles.mediaContainer}>
                {editImages.map((img, idx) => (
                  <View key={idx} style={styles.mediaThumb}>
                    <MaterialIcons name="image" size={24} color={colors.orangeVibrant} />
                    <Text style={styles.mediaThumbText}>{`صورة ${idx + 1}`}</Text>
                    <Pressable onPress={() => setEditImages(editImages.filter((_, i) => i !== idx))}>
                      <MaterialIcons name="close" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
                {editVideos.map((vid, idx) => (
                  <View key={idx} style={styles.mediaThumb}>
                    <MaterialIcons name="videocam" size={24} color={colors.navyDeep} />
                    <Text style={styles.mediaThumbText}>{`فيديو ${idx + 1}`}</Text>
                    <Pressable onPress={() => setEditVideos(editVideos.filter((_, i) => i !== idx))}>
                      <MaterialIcons name="close" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                <Pressable 
                  style={[styles.uploadBtn, { flex: 1 }, uploadingEditImages && { opacity: 0.6 }]} 
                  onPress={handlePickAndUploadEditImages}
                  disabled={uploadingEditImages}
                >
                  <MaterialIcons name="add-photo-alternate" size={18} color={colors.orangeVibrant} />
                  <Text style={styles.uploadBtnText}>{uploadingEditImages ? 'جارٍ الرفع...' : 'رفع صورة'}</Text>
                </Pressable>
                <View style={[styles.uploadBtn, { flex: 1, opacity: 0.6 }]} >
                  <MaterialIcons name="video-call" size={18} color={colors.navyDeep} />
                  <Text style={styles.uploadBtnText}>الفيديوهات — متاح قريبًا</Text>
                </View>
              </View>

              <Pressable style={styles.primaryBtn} onPress={handleSaveEditedProduct}>
                <Text style={styles.primaryBtnText}>حفظ التعديلات</Text>
              </Pressable>

              <Pressable style={styles.closeModalBtn} onPress={() => {
                setEditModalVisible(false);
                setSelectedProduct(null);
              }}>
                <Text style={styles.closeModalText}>إلغاء</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={addModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>إضافة منتج جديد</Text>

              <Text style={styles.label}>نموذج المنتج</Text>
              <Pressable style={styles.dropdownSelector} onPress={() => setNewDropdownOpen(!newDropdownOpen)}>
                <Text style={styles.dropdownText}>{getTemplateBadgeText(newTemplate)}</Text>
                <MaterialIcons name="arrow-drop-down" size={24} color={colors.charcoalText} />
              </Pressable>
              {newDropdownOpen && (
                <View style={styles.dropdownList}>
                  {PRODUCT_TEMPLATES.map((item) => (
                    <Pressable
                      key={item.key}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setNewTemplate(item.key);
                        setNewDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.label}>اسم المنتج</Text>
              <TextInput
                style={styles.input}
                placeholder="أدخل اسم المنتج"
                placeholderTextColor={colors.outline}
                value={newName}
                onChangeText={setNewName}
              />

              <Text style={styles.label}>السعر الأساسي (دج)</Text>
              <TextInput
                style={styles.input}
                placeholder="مثال: 3500"
                placeholderTextColor={colors.outline}
                keyboardType="numeric"
                value={newPrice}
                onChangeText={setNewPrice}
              />

              <Text style={styles.label}>وصف المنتج (اختياري)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="تفاصيل إضافية عن المنتج..."
                placeholderTextColor={colors.outline}
                multiline
                value={newDesc}
                onChangeText={setNewDesc}
              />

              <Text style={styles.label}>تصنيف المنتج</Text>
              <View style={styles.chipsRow}>
                {PRODUCT_CATEGORY_OPTIONS.map((c) => {
                  const selected = newCategory === c.key;
                  return (
                    <Pressable
                      key={c.key}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setNewCategory(c.key)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {(newTemplate === 'computer' || newTemplate === 'phone' || newTemplate === 'electronics') && (
                <>
                  <Text style={styles.label}>خيارات الرام (RAM)</Text>
                  <View style={styles.chipsRow}>
                    {getVisibleOptions(NEW_RAM_OPTIONS, newRam).map((r) => {
                      const selected = newRam.includes(r);
                      return (
                        <Pressable
                          key={r}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            if (selected) setNewRam(newRam.filter((x) => x !== r));
                            else setNewRam([...newRam, r]);
                          }}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{r}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('ram')}>
                    <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                    <Text style={styles.addOptionText}>إضافة RAM مخصص</Text>
                  </Pressable>

                  <Text style={styles.label}>سعات التخزين</Text>
                  <View style={styles.chipsRow}>
                    {getVisibleOptions(NEW_STORAGE_OPTIONS, newStorage).map((s) => {
                      const selected = newStorage.includes(s);
                      return (
                        <Pressable
                          key={s}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => {
                            if (selected) setNewStorage(newStorage.filter((x) => x !== s));
                            else setNewStorage([...newStorage, s]);
                          }}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('storage')}>
                    <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                    <Text style={styles.addOptionText}>إضافة تخزين مخصص</Text>
                  </Pressable>
                </>
              )}

              {(newTemplate === 'clothing' || newTemplate === 'women' || newTemplate === 'clothing_shoes' || newTemplate === 'mothers_kids') && (
                <>
                  <Text style={styles.label}>الأحجام المتوفرة</Text>
              <View style={styles.chipsRow}>
                {getVisibleOptions(NEW_SIZE_OPTIONS, newSizes).map((sz) => {
                  const selected = newSizes.includes(sz);
                  return (
                    <Pressable key={sz} style={[styles.chip, selected && styles.chipSelected]} onPress={() => {
                      if (selected) setNewSizes(newSizes.filter((x) => x !== sz));
                      else setNewSizes([...newSizes, sz]);
                    }}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{sz}</Text>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('size')}>
                  <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                  <Text style={styles.addOptionText}>إضافة مقاس</Text>
                </Pressable>
              </View>
                </>
              )}

              <Text style={styles.label}>الألوان المتوفرة</Text>
              <View style={styles.chipsRow}>
                {getVisibleOptions(NEW_COLOR_OPTIONS, newColors).map((c) => {
                  const selected = newColors.includes(c);
                  return (
                    <Pressable key={c} style={[styles.chip, selected && styles.chipSelected]} onPress={() => {
                      if (selected) setNewColors(newColors.filter((x) => x !== c));
                      else setNewColors([...newColors, c]);
                    }}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{c}</Text>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.addOptionChip} onPress={() => openCustomOptionModal('color')}>
                  <MaterialIcons name="add" size={17} color={colors.orangeVibrant} />
                  <Text style={styles.addOptionText}>إضافة لون</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, { marginTop: spacing.md }]}>الحد الأدنى للطلب</Text>
              <TextInput
                style={styles.input}
                placeholder="مثال: 1"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                value={newMinOrderQuantity}
                onChangeText={setNewMinOrderQuantity}
              />

              <Text style={styles.label}>الحد الأقصى للطلب</Text>
              <TextInput
                style={styles.input}
                placeholder="مثال: 100"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                value={newMaxOrderQuantity}
                onChangeText={setNewMaxOrderQuantity}
              />

              <Text style={[styles.label, { marginTop: spacing.md }]}>رفع الصور والفيديوهات</Text>
              <View style={styles.mediaContainer}>
                {newImages.map((img, idx) => (
                  <View key={idx} style={styles.mediaThumb}>
                    <MaterialIcons name="image" size={24} color={colors.orangeVibrant} />
                    <Text style={styles.mediaThumbText}>{`صورة ${idx + 1}`}</Text>
                    <Pressable onPress={() => setNewImages(newImages.filter((_, i) => i !== idx))}>
                      <MaterialIcons name="close" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
                {newVideos.map((vid, idx) => (
                  <View key={idx} style={styles.mediaThumb}>
                    <MaterialIcons name="videocam" size={24} color={colors.navyDeep} />
                    <Text style={styles.mediaThumbText}>{`فيديو ${idx + 1}`}</Text>
                    <Pressable onPress={() => setNewVideos(newVideos.filter((_, i) => i !== idx))}>
                      <MaterialIcons name="close" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                <Pressable 
                  style={[styles.uploadBtn, { flex: 1 }, uploadingNewImages && { opacity: 0.6 }]} 
                  onPress={handlePickAndUploadNewImages}
                  disabled={uploadingNewImages}
                >
                  <MaterialIcons name="add-photo-alternate" size={18} color={colors.orangeVibrant} />
                  <Text style={styles.uploadBtnText}>{uploadingNewImages ? 'جارٍ الرفع...' : 'رفع صورة'}</Text>
                </Pressable>
                <View style={[styles.uploadBtn, { flex: 1, opacity: 0.6 }]} >
                  <MaterialIcons name="video-call" size={18} color={colors.navyDeep} />
                  <Text style={styles.uploadBtnText}>الفيديوهات — متاح قريبًا</Text>
                </View>
              </View>

              <Pressable
                style={[styles.primaryBtn, savingProduct && { opacity: 0.6 }]}
                onPress={handleAddNewProduct}
                disabled={savingProduct}
              >
                <Text style={styles.primaryBtnText}>{savingProduct ? 'جارٍ النشر...' : 'حفظ المنتج'}</Text>
              </Pressable>

              <Pressable style={styles.closeModalBtn} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.closeModalText}>إلغاء</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

            <Modal visible={customOptionModal.visible} animationType="fade" transparent={true} onRequestClose={closeCustomOptionModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.optionModalContent}>
            <Text style={styles.modalTitle}>إضافة {(['size','edit-size'].includes(customOptionModal.type) ? 'مقاس' : ['ram','edit-ram'].includes(customOptionModal.type) ? 'RAM' : ['storage','edit-storage'].includes(customOptionModal.type) ? 'سعة تخزين' : 'لون')} جديد</Text>
            <TextInput
              style={styles.input}
              placeholder={(['size','edit-size'].includes(customOptionModal.type) ? 'مثال: 6XL أو 56' : ['ram','edit-ram'].includes(customOptionModal.type) ? 'مثال: 128GB' : ['storage','edit-storage'].includes(customOptionModal.type) ? 'مثال: 2TB' : 'مثال: تركوازي فاتح')}
              placeholderTextColor={colors.outline}
              value={customOptionModal.value}
              onChangeText={(value) => setCustomOptionModal((prev) => ({ ...prev, value }))}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={handleAddCustomOption}>
                <Text style={styles.primaryBtnText}>إضافة</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.outline }]} onPress={closeCustomOptionModal}>
                <Text style={styles.primaryBtnText}>إلغاء</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={feeDetailsVisible} animationType="fade" transparent={true} onRequestClose={() => setFeeDetailsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.feeDetailsModal}>
            <View style={styles.feeDetailsHeader}>
              <MaterialIcons name="percent" size={24} color={colors.orangeVibrant} />
              <Text style={styles.modalTitle}>كيفية حساب الرسوم</Text>
            </View>

            <Text style={styles.feeDetailsIntro}>
              تُحسب الرسوم بنسبة 0.3% من قيمة المنتجات التي تم بيعها فقط.
            </Text>

            <View style={styles.feeFormulaBox}>
              <Text style={styles.feeFormulaTitle}>طريقة الحساب</Text>
              <Text style={styles.feeFormulaText}>قيمة المنتجات × 0.003 = الرسوم</Text>
            </View>

            <View style={styles.feeExampleBox}>
              <Text style={styles.feeExampleTitle}>مثال 1</Text>
              <Text style={styles.feeExampleText}>
                قيمة المنتجات المباعة: <Text style={styles.boldText}>100,000 دج</Text>
              </Text>
              <Text style={styles.feeExampleText}>
                أي <Text style={styles.boldText}>10,000,000 سنتيم</Text>
              </Text>
              <Text style={styles.feeExampleText}>
                الرسوم: <Text style={styles.boldText}>300 دج</Text> = <Text style={styles.boldText}>30,000 سنتيم</Text>
              </Text>
            </View>

            <View style={styles.feeExampleBox}>
              <Text style={styles.feeExampleTitle}>مثال 2</Text>
              <Text style={styles.feeExampleText}>
                قيمة المنتجات المباعة: <Text style={styles.boldText}>200,000 دج</Text>
              </Text>
              <Text style={styles.feeExampleText}>
                أي <Text style={styles.boldText}>20,000,000 سنتيم</Text>
              </Text>
              <Text style={styles.feeExampleText}>
                الرسوم: <Text style={styles.boldText}>600 دج</Text> = <Text style={styles.boldText}>60,000 سنتيم</Text>
              </Text>
            </View>

            <View style={styles.feeExampleBox}>
              <Text style={styles.feeExampleTitle}>مثال 3</Text>
              <Text style={styles.feeExampleText}>
                قيمة المنتجات المباعة: <Text style={styles.boldText}>1,000,000 دج</Text>
              </Text>
              <Text style={styles.feeExampleText}>
                أي <Text style={styles.boldText}>100,000,000 سنتيم</Text>
              </Text>
              <Text style={styles.feeExampleText}>
                الرسوم: <Text style={styles.boldText}>3,000 دج</Text> = <Text style={styles.boldText}>300,000 سنتيم</Text>
              </Text>
            </View>

            <Text style={styles.feeDetailsNote}>
              يتم احتساب الرسوم بنفس النسبة دائمًا: <Text style={styles.boldText}>0.3%</Text> من قيمة المنتجات المباعة.
            </Text>

            <Pressable style={styles.closeModalBtn} onPress={() => setFeeDetailsVisible(false)}>
              <Text style={styles.closeModalText}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={updateRequiredModalVisible} animationType="fade" transparent={true} onRequestClose={() => setUpdateRequiredModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFF3E8', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="system-update" size={30} color={colors.orangeVibrant} />
              </View>
            </View>
            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>قم بتحديث التطبيق</Text>
            <Text style={[styles.cardSub, { textAlign: 'center', lineHeight: 22 }]}>قم بتحديث التطبيق للاستمرار في الاستفادة من الخدمات وإتمام الدفع.</Text>
            <Pressable style={[styles.primaryBtn, { marginTop: spacing.md }]} onPress={openUpdatePlatformChooser}>
              <MaterialIcons name="system-update-alt" size={18} color={colors.white} />
              <Text style={styles.primaryBtnText}>تحديث التطبيق</Text>
            </Pressable>
            <Pressable style={styles.closeModalBtn} onPress={() => setUpdateRequiredModalVisible(false)}>
              <Text style={styles.closeModalText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={updatePlatformModalVisible} animationType="fade" transparent={true} onRequestClose={() => setUpdatePlatformModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>اختر نوع جهازك</Text>
            <Text style={[styles.cardSub, { textAlign: 'center', lineHeight: 22 }]}>سيتم نقلك مباشرة إلى صفحة Kilix في متجر التطبيقات.</Text>
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Pressable style={styles.dropdownSelector} onPress={() => openStoreLink(ANDROID_APP_STORE_URL)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <MaterialIcons name="android" size={22} color="#3DDC84" />
                  <Text style={styles.dropdownText}>Android - Google Play</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.charcoalText} />
              </Pressable>
              <Pressable style={styles.dropdownSelector} onPress={() => openStoreLink(IOS_APP_STORE_URL)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <MaterialIcons name="phone-iphone" size={22} color={colors.charcoalText} />
                  <Text style={styles.dropdownText}>iPhone - App Store</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.charcoalText} />
              </Pressable>
            </View>
            <Pressable style={styles.closeModalBtn} onPress={() => setUpdatePlatformModalVisible(false)}>
              <Text style={styles.closeModalText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={invoiceModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>دفع الرصيد المستحق</Text>
            <Text style={styles.cardSub}>
              اختر وسيلة الدفع المناسبة لإتمام التسوية.
            </Text>
            <View style={{ marginVertical: spacing.md, gap: spacing.sm }}>
              <Pressable style={[styles.dropdownSelector, (paymentLoading || outstandingFee < BILLING_THRESHOLD) && { opacity: 0.5 }]} disabled={paymentLoading || outstandingFee < BILLING_THRESHOLD} onPress={async () => {
                try {
                  if (outstandingFee < BILLING_THRESHOLD) return;
                  openUpdateRequired();
                  return;

                  const [summary, history] = await Promise.all([getBillingSummary(storeDocId), getPaymentHistory(storeDocId)]);
                  setCurrentUsage(Number(summary.accumulated_fee) || 0);
                  setOutstandingFee(Number(summary.outstanding_fee) || 0);
                  setPaymentHistory(history || []);
                  setInvoiceModalVisible(false);
                  alert('تم تسجيل الدفعة في سجل المدفوعات.');
                } catch (error) { alert(error?.message || 'تعذر تسجيل الدفعة.'); }
                finally { setPaymentLoading(false); }
              }}>
                <Text style={styles.dropdownText}>بريدي موب (BaridiMob)</Text>
                <MaterialIcons name="chevron-right" size={24} color={colors.charcoalText} />
              </Pressable>
              <Pressable style={[styles.dropdownSelector, (paymentLoading || outstandingFee < BILLING_THRESHOLD) && { opacity: 0.5 }]} disabled={paymentLoading || outstandingFee < BILLING_THRESHOLD} onPress={async () => {
                try {
                  if (outstandingFee < BILLING_THRESHOLD) return;
                  openUpdateRequired();
                  return;

                  const [summary, history] = await Promise.all([getBillingSummary(storeDocId), getPaymentHistory(storeDocId)]);
                  setCurrentUsage(Number(summary.accumulated_fee) || 0);
                  setOutstandingFee(Number(summary.outstanding_fee) || 0);
                  setPaymentHistory(history || []);
                  setInvoiceModalVisible(false);
                  alert('تم تسجيل الدفعة في سجل المدفوعات.');
                } catch (error) { alert(error?.message || 'تعذر تسجيل الدفعة.'); }
                finally { setPaymentLoading(false); }
              }}>
                <Text style={styles.dropdownText}>البطاقة الذهبية (Dahabia)</Text>
                <MaterialIcons name="chevron-right" size={24} color={colors.charcoalText} />
              </Pressable>
            </View>
            <Pressable style={styles.closeModalBtn} onPress={() => setInvoiceModalVisible(false)}>
              <Text style={styles.closeModalText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmDeleteModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={[styles.deleteIconCircle, { backgroundColor: '#FFEBEE' }]}>
              <MaterialIcons name="warning" size={36} color={colors.error} />
            </View>
            <Text style={styles.deleteModalTitle}>حذف المنتج؟</Text>
            <Text style={styles.deleteModalSub}>
              هل أنت متأكد من رغبتك في حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <Pressable style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.error }]} onPress={() => {
                handleDeleteProduct(deleteProductId);
              }}>
                <Text style={styles.primaryBtnText}>حذف</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { flex: 1, backgroundColor: colors.outline }]} onPress={() => setConfirmDeleteModalVisible(false)}>
                <Text style={styles.primaryBtnText}>إلغاء</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={successModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={[styles.deleteIconCircle, { backgroundColor: '#E8F5E9' }]}>
              <MaterialIcons name="check-circle" size={36} color={colors.success} />
            </View>
            <Text style={styles.deleteModalTitle}>تمت إضافة المنتج بنجاح</Text>
            <Text style={styles.deleteModalSub}>
              أصبح منتجك الجديد متاحاً الآن في المخزون وجاهزاً لاستقبال الطلبات.
            </Text>
            <Pressable style={[styles.primaryBtn, { marginTop: spacing.lg }]} onPress={() => setSuccessModalVisible(false)}>
              <Text style={styles.primaryBtnText}>حسناً</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={selectedOrder !== null} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOrder && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.sm }}>
                <Text style={styles.modalTitle}>تفاصيل الطلبية {selectedOrder.id}</Text>

                <Text style={styles.detailText}>الاسم: <Text style={styles.boldText}>{selectedOrder.customerName || 'غير متوفر'}</Text></Text>
                <Text style={styles.detailText}>رقم الهاتف: <Text style={styles.boldText}>{selectedOrder.phone || 'غير متوفر'}</Text></Text>
                <Text style={styles.detailText}>الولاية: <Text style={styles.boldText}>{selectedOrder.wilaya || 'غير متوفرة'}</Text></Text>
                <Text style={styles.detailText}>البلدية: <Text style={styles.boldText}>{selectedOrder.commune || 'غير متوفرة'}</Text></Text>
                <Text style={styles.detailText}>طريقة التوصيل: <Text style={styles.boldText}>{getDeliveryTypeLabel(selectedOrder.deliveryType)}</Text></Text>
                {selectedOrder.deliveryType === 'home' ? (
                  <Text style={styles.detailText}>عنوان البيت: <Text style={styles.boldText}>{selectedOrder.streetAddress || 'غير متوفر'}</Text></Text>
                ) : (
                  <Text style={styles.detailText}>نقطة التسليم: <Text style={styles.boldText}>مكتب التوصيل في البلدية المحددة</Text></Text>
                )}
                <Text style={styles.detailText}>الملاحظة: <Text style={styles.boldText}>{selectedOrder.notes || 'لا توجد ملاحظة'}</Text></Text>
                <Text style={styles.detailText}>الحالة: <Text style={styles.boldText}>{selectedOrder.status}</Text></Text>
                <Text style={styles.detailText}>المجموع: <Text style={styles.boldText}>{selectedOrder.total || 0} {selectedOrder.currency || 'دج'}</Text></Text>
                <Text style={styles.detailText}>إجمالي الكمية: <Text style={styles.boldText}>{selectedOrder.quantity || 0}</Text></Text>

                <Text style={[styles.label, { marginTop: spacing.md }]}>المجموعات المطلوبة ({selectedOrder.details?.length || 0}):</Text>
                {selectedOrder.details && selectedOrder.details.length > 0 ? (
                  selectedOrder.details.map((item, idx) => {
                    const optionEntries = Object.entries(item.options || {}).filter(([, value]) => formatOrderOptionValue(value));
                    return (
                      <View key={`${selectedOrder.id}-group-${idx}`} style={styles.orderGroupCard}>
                        <View style={styles.orderGroupHeader}>
                          <Text style={styles.orderGroupTitle}>المجموعة {idx + 1}</Text>
                          <Text style={styles.orderGroupQuantity}>الكمية: {item.quantity || 0}</Text>
                        </View>
                        <Text style={styles.boldText}>{item.title || selectedOrder.title || 'المنتج'}</Text>
                        {optionEntries.length > 0 ? (
                          <View style={{ marginTop: spacing.xs }}>
                            {optionEntries.map(([key, value]) => (
                              <Text key={`${selectedOrder.id}-${idx}-${key}`} style={styles.orderSubText}>
                                {key}: <Text style={styles.boldText}>{formatOrderOptionValue(value)}</Text>
                              </Text>
                            ))}
                          </View>
                        ) : (
                          <Text style={[styles.orderSubText, { marginTop: spacing.xs }]}>بدون خيارات إضافية</Text>
                        )}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.orderSubText}>لا توجد تفاصيل مجموعات محفوظة لهذه الطلبية.</Text>
                )}

                <Pressable
                  style={[styles.primaryBtn, { marginTop: spacing.lg }]}
                  onPress={() => setSelectedOrder(null)}
                >
                  <Text style={styles.primaryBtnText}>إغلاق</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerIconBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.charcoalText,
    textAlign: 'center',
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 60,
    right: spacing.md,
    width: 240,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    zIndex: 100,
    ...cardShadow,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  drawerText: {
    fontSize: 14,
    color: colors.charcoalText,
    fontWeight: '500',
  },
  welcomeWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  welcomeIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.charcoalText,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  welcomeSub: {
    fontSize: 14,
    color: colors.outline,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: colors.orangeVibrant,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.xs,
    width: '100%',
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.charcoalText,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    ...cardShadow,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.charcoalText,
  },
  cardSub: {
    fontSize: 13,
    color: colors.outline,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...cardShadow,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.navyDeep,
    flex: 1,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusOrange: {
    backgroundColor: '#FFF3E0',
    color: '#E65100',
  },
  statusGreen: {
    backgroundColor: '#E8F5E9',
    color: colors.success,
  },
  statusRed: {
    backgroundColor: '#FFEBEE',
    color: colors.error,
  },
  customerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.charcoalText,
    marginBottom: 2,
  },
  orderSubText: {
    fontSize: 13,
    color: colors.outline,
  },
  orderActionRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyDeep,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    gap: 4,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  orderGroupCard: {
    backgroundColor: '#F8F9FA',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  orderGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  orderGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.charcoalText,
  },
  orderGroupQuantity: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.orangeVibrant,
  },
  historyCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...cardShadow,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.charcoalText,
    flex: 1,
  },
  historyDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  historyText: {
    fontSize: 12,
    color: colors.outline,
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  boldText: {
    fontWeight: 'bold',
    color: colors.charcoalText,
  },
  floatingAddBtn: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: colors.orangeVibrant,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: spacing.xs,
    ...cardShadow,
    zIndex: 10,
  },
  floatingAddBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  progressTrack: {
    height: 10,
    backgroundColor: colors.borderLight,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.orangeVibrant,
    borderRadius: radius.pill,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  progressTextValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.charcoalText,
  },
  progressLabel: {
    fontSize: 13,
    color: colors.outline,
  },
  feeNoticeCard: {
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#FFD9B3',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  feeNoticeContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  feeNoticeTextWrap: {
    flex: 1,
  },
  feeNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoalText,
    marginBottom: 4,
  },
  feeNoticeText: {
    fontSize: 14,
    color: colors.charcoalText,
    lineHeight: 21,
  },
  feeDetailsBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
  feeDetailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orangeVibrant,
  },
  feeDetailsModal: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    ...cardShadow,
  },
  feeDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  feeDetailsIntro: {
    fontSize: 14,
    color: colors.charcoalText,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  feeFormulaBox: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  feeFormulaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoalText,
    marginBottom: 6,
    textAlign: 'center',
  },
  feeFormulaText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.orangeVibrant,
    textAlign: 'center',
  },
  feeExampleBox: {
    backgroundColor: '#FFF8F1',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  feeExampleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.orangeVibrant,
    marginBottom: 6,
  },
  feeExampleText: {
    fontSize: 13,
    color: colors.charcoalText,
    lineHeight: 21,
  },
  feeDetailsNote: {
    fontSize: 12,
    color: colors.outline,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
    ...cardShadow,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.charcoalText,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.charcoalText,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.charcoalText,
    backgroundColor: '#FAFAFA',
    marginBottom: spacing.sm,
  },
  dropdownSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FAFAFA',
    marginBottom: spacing.sm,
  },
  dropdownText: {
    fontSize: 14,
    color: colors.charcoalText,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  dropdownItem: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.charcoalText,
  },
  closeModalBtn: {
    marginTop: spacing.sm,
    alignItems: 'center',
    padding: spacing.sm,
  },
  closeModalText: {
    color: colors.outline,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteModalContent: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...cardShadow,
  },
  deleteIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.charcoalText,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  deleteModalSub: {
    fontSize: 13,
    color: colors.outline,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  productBadge: {
    fontSize: 12,
    backgroundColor: '#E3F2FD',
    color: '#1565C0',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    fontWeight: '600',
  },
  detailText: {
    fontSize: 13,
    color: colors.outline,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: '#FAFAFA',
  },
  chipSelected: {
    backgroundColor: colors.orangeVibrant,
    borderColor: colors.orangeVibrant,
  },
  chipText: {
    fontSize: 12,
    color: colors.charcoalText,
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: 'bold',
  },
  addOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.orangeVibrant,
    borderStyle: 'dashed',
    backgroundColor: '#FFF6EF',
  },
  addOptionText: { fontSize: 12, color: colors.orangeVibrant, fontWeight: 'bold' },
  optionModalContent: { width: '92%', maxWidth: 420, backgroundColor: colors.white, borderRadius: 18, padding: spacing.lg },
  mediaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  mediaThumb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F4',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    gap: 6,
  },
  mediaThumbText: {
    fontSize: 12,
    color: colors.charcoalText,
    maxWidth: 100,
  },
  storeLogoSetupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    backgroundColor: '#FAFAFA',
  },
  storeLogoPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  storeLogoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  storeLogoHint: {
    fontSize: 12,
    color: colors.outline,
    lineHeight: 18,
    marginBottom: 6,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: '#FAFAFA',
    marginBottom: spacing.sm,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.charcoalText,
  },
});