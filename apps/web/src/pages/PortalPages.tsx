import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  Wallet,
  Star,
  Settings,
  Plus,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Users,
  Store,
  FileText,
  ArrowLeft,
  RotateCcw,
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  X,
  Clock,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatNpr, formatShortDate } from '../lib/api';
import {
  RoleSwitcherBar,
  StatusBadge,
  WearBirgunjLogo,
} from '../components/DesignSystem';

// ============================================================================
// SCREEN #13: CLOUDINARY PRODUCT MEDIA MANAGEMENT (MAGIC BYTES + CDN METADATA)
// ============================================================================
export const ProductMediaModal: React.FC<{
  product: any;
  onClose: () => void;
  onUpdated: () => void;
}> = ({ product, onClose, onUpdated }) => {
  const { showToast } = useAuth();
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/products/${product.id}`);
      setImages(res?.product?.media || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [product.id]);

  const handleFileUpload = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Only JPEG, PNG, and WebP images are supported.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds 5MB limit.', 'error');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const b64 = res.includes(',') ? res.split(',')[1] : res;
          resolve(b64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const fileBase64 = await base64Promise;

      await apiFetch(`/vendor/products/${product.id}/images/upload`, {
        method: 'POST',
        body: {
          fileBase64,
          filename: file.name,
          mimeType: file.type,
          isPrimary: images.length === 0,
        },
      });

      showToast('Image uploaded and verified with magic bytes!', 'success');
      await loadMedia();
      onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Image upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await apiFetch(`/vendor/products/${product.id}/images/${imageId}`, {
        method: 'DELETE',
      });
      showToast('Image deleted.', 'info');
      await loadMedia();
      onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Could not delete image.', 'error');
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      const reordered = [
        imageId,
        ...images.filter((i) => i.id !== imageId).map((i) => i.id),
      ];
      await apiFetch(`/vendor/products/${product.id}/images/reorder`, {
        method: 'PATCH',
        body: {
          imageIds: reordered,
        },
      });
      showToast('Primary cover image updated.', 'success');
      await loadMedia();
      onUpdated();
    } catch (err: any) {
      showToast(err.message || 'Could not update primary image.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Product Media Management
              </h3>
              <p className="text-xs text-slate-500">
                {product.title} • Cloudinary Media Integration
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security & Verification Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-800">
              Binary Magic Byte Inspection & Cloudinary Isolation
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
            JPEG • PNG • WebP &lt; 5MB
          </span>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all ${
            dragOver
              ? 'border-rose-500 bg-rose-50/50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
          }`}
        >
          <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-800">
            Drag & drop high-resolution product photos here
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            or browse files from your computer (auto-converts to WebP on Cloudinary CDN)
          </p>

          <label className="inline-block mt-3 px-4 py-2 rounded-xl bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs">
            {uploading ? 'Validating Magic Bytes & Uploading...' : 'Browse Images'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
          </label>
        </div>

        {/* Uploaded Gallery */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Product Images ({images.length})
            </h4>
            <span className="text-[11px] text-slate-400">
              First image is the primary storefront cover
            </span>
          </div>

          {loading ? (
            <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
          ) : images.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
              No custom media uploaded yet. Default catalog image will be shown.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square"
                >
                  <img
                    src={img.url}
                    alt={`Product image ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {img.is_primary && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#E11D48] text-white text-[10px] font-bold shadow-xs">
                      Primary Cover
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-1.5 rounded-xl backdrop-blur-xs">
                    {!img.is_primary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(img.id)}
                        className="px-2 py-1 rounded-lg bg-white/90 hover:bg-white text-[10px] font-bold text-slate-900"
                      >
                        Set Primary
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      className="p-1 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white ml-auto"
                      title="Delete Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SCREENS #12, #13, #14, #15: VENDOR PORTAL (DASHBOARD, PRODUCTS, ORDERS, RETURNS, FINANCE)
// ============================================================================
export const VendorPortalPage: React.FC = () => {
  const { user, loginWithCredentials, showToast } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'products' | 'orders' | 'returns' | 'finance'
  >('dashboard');
  const [productFilter, setProductFilter] = useState('ALL');
  const [orderFilter, setOrderFilter] = useState('ALL');
  const [returnFilter, setReturnFilter] = useState('ALL');

  const [dashboard, setDashboard] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [vendorReturns, setVendorReturns] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductForMedia, setSelectedProductForMedia] = useState<any | null>(null);
  const [rejectModalReturn, setRejectModalReturn] = useState<any | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [isReviewingReturn, setIsReviewingReturn] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newCategory, setNewCategory] = useState('cat-shoes');
  const [newPriceRupees, setNewPriceRupees] = useState(3499);
  const [newSku, setNewSku] = useState('');
  const [newStock, setNewStock] = useState(10);

  const loadVendorAll = async () => {
    setLoading(true);
    try {
      // Ensure vendor session is active
      if (!user?.vendorId) {
        await loginWithCredentials('vendor@fashionhub.np', 'VendorPass123!');
      }
      const [dRes, pRes, oRes, fRes, rRes] = await Promise.all([
        apiFetch('/vendor/dashboard'),
        apiFetch('/vendor/products'),
        apiFetch('/vendor/orders'),
        apiFetch('/vendor/finance'),
        apiFetch('/vendor/returns'),
      ]);
      setDashboard(dRes);
      setProducts(pRes.items || []);
      setOrders(oRes.items || []);
      setFinance(fRes);
      setVendorReturns(rRes.items || []);
    } catch (err: any) {
      showToast(err.message || 'Could not load vendor portal.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendorAll();
  }, [user?.vendorId]);

  const handleReviewReturn = async (
    returnId: string,
    decision: 'APPROVE' | 'REJECT',
    rejectionReason?: string,
  ) => {
    setIsReviewingReturn(true);
    try {
      await apiFetch(`/vendor/returns/${returnId}/review`, {
        method: 'POST',
        body: {
          decision,
          rejectionReason: decision === 'REJECT' ? rejectionReason : undefined,
        },
      });
      showToast(
        decision === 'APPROVE'
          ? 'Return/Exchange approved! Stock reserved & Birgunj courier notified.'
          : 'Return request rejected.',
        decision === 'APPROVE' ? 'success' : 'info',
      );
      setRejectModalReturn(null);
      setRejectionReasonInput('');
      loadVendorAll();
    } catch (err: any) {
      showToast(err.message || 'Could not review return.', 'error');
    } finally {
      setIsReviewingReturn(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const slugClean =
        newSlug.trim() ||
        newTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      await apiFetch('/vendor/products', {
        method: 'POST',
        body: {
          title: newTitle,
          subtitle: 'Fashion Hub Birgunj',
          slug: slugClean,
          categoryId: newCategory,
          description: `${newTitle} — Authentic local inventory from Fashion Hub Birgunj with 2-4 hour delivery.`,
          basePricePaisa: Number(newPriceRupees) * 100,
          imageUrls: [
            'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
          ],
          variants: [
            {
              sku: newSku.trim() || `WB-${Date.now().toString().slice(-5)}`,
              title: 'Standard / Birgunj Edition',
              sizeValue: 'Standard',
              colorName: 'Black',
              colorHex: '#111827',
              pricePaisa: Number(newPriceRupees) * 100,
              initialStock: Number(newStock),
            },
          ],
        },
      });
      showToast('Product submitted for Catalog Moderation!', 'success');
      setShowAddModal(false);
      setNewTitle('');
      setNewSlug('');
      setNewSku('');
      loadVendorAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleOrderStatusChange = async (
    vendorOrderId: string,
    status: 'PROCESSING' | 'OUT_FOR_DELIVERY' | 'DELIVERED',
  ) => {
    try {
      await apiFetch(`/vendor/orders/${vendorOrderId}/status`, {
        method: 'PATCH',
        body: {
          status,
          deliveryPartnerName: 'Rajesh Kumar',
          deliveryPartnerPhone: '+977 9812345678',
          locationText: 'Birgunj Express Dispatch',
        },
      });
      showToast(`Order updated to ${status}!`, 'success');
      loadVendorAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredProducts = products.filter((p) =>
    productFilter === 'ALL' ? true : p.moderation_status === productFilter,
  );

  const filteredOrders = orders.filter((o) =>
    orderFilter === 'ALL' ? true : o.status === orderFilter,
  );

  const filteredReturns = vendorReturns.filter((r) =>
    returnFilter === 'ALL' ? true : r.status === returnFilter,
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9]">
      <RoleSwitcherBar />

      <div className="flex-1 flex">
        {/* Left Dark Navy Sidebar (Screen #13) */}
        <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col justify-between p-5 shrink-0">
          <div className="space-y-6">
            <WearBirgunjLogo dark subtitle="Vendor Portal" />

            <nav className="space-y-1.5 text-sm">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'products', label: 'Products', icon: Package },
                { id: 'orders', label: 'Orders', icon: ShoppingCart },
                {
                  id: 'returns',
                  label: `Returns & Exchanges (${vendorReturns.filter((r) => r.status === 'REQUESTED').length})`,
                  icon: RotateCcw,
                },
                { id: 'finance', label: 'Earnings & Ledger', icon: Wallet },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-colors ${
                      activeTab === item.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[#E11D48]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Customer Storefront
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'products' && 'Products'}
                {activeTab === 'orders' && 'Vendor Orders'}
                {activeTab === 'returns' && 'Return & Exchange Queue (36-Hr SLA)'}
                {activeTab === 'finance' && 'Earnings & Commission Ledger'}
              </h1>
              <p className="text-xs text-slate-500">
                Welcome Back,{' '}
                <strong className="text-slate-800">
                  {dashboard?.vendor?.business_name || 'Fashion Hub Birgunj'}
                </strong>{' '}
                (Ward {dashboard?.vendor?.ward_number || 10}, Birgunj)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge
                status={dashboard?.vendor?.approval_status || 'APPROVED'}
              />
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900">
                  {dashboard?.vendor?.business_name || 'Fashion Hub'}
                </p>
                <p className="text-[11px] text-slate-400">Verified Vendor</p>
              </div>
            </div>
          </div>

          {/* TAB 1: SCREEN #13 VENDOR DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* 4 KPI Cards (Screen #13) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-xs font-medium text-slate-400">Total Orders</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">
                    {dashboard?.kpis?.totalOrders || 4}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600 mt-2">
                    ↑ +12% this month
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-xs font-medium text-slate-400">Total Sales</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">
                    {formatNpr(dashboard?.kpis?.totalSalesPaisa || 1249700)}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600 mt-2">
                    ↑ +18% this month
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-xs font-medium text-slate-400">Products</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">
                    {dashboard?.kpis?.totalProducts || products.length}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600 mt-2">
                    +{dashboard?.kpis?.pendingProducts || 1} pending approval
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-xs font-medium text-slate-400">Average Rating</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
                    <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                    {Number(dashboard?.kpis?.ratingAvg || 4.8).toFixed(1)}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600 mt-2">
                    ↑ +0.2 this month
                  </p>
                </div>
              </div>

              {/* Sales Overview Chart + Recent Orders (Screen #13) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-base text-slate-900">
                      Sales Overview
                    </h2>
                    <span className="text-xs px-3 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium">
                      Last 30 Days
                    </span>
                  </div>
                  <svg className="w-full h-52" viewBox="0 0 500 180" fill="none">
                    <defs>
                      <linearGradient id="vendorSalesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 10 150 Q 90 120, 150 130 T 280 85 T 390 60 T 490 25 L 490 170 L 10 170 Z"
                      fill="url(#vendorSalesGrad)"
                    />
                    <path
                      d="M 10 150 Q 90 120, 150 130 T 280 85 T 390 60 T 490 25"
                      stroke="#2563EB"
                      strokeWidth="3"
                      fill="none"
                    />
                  </svg>
                </div>

                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-base text-slate-900">
                      Recent Orders
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      View All
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {(dashboard?.recentOrders || []).map((ord: any) => (
                      <div
                        key={ord.id}
                        className="py-3 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {ord.order_number}
                          </p>
                          <p className="text-slate-400">
                            {formatShortDate(ord.created_at)}
                          </p>
                        </div>
                        <div className="font-bold text-slate-900">
                          {formatNpr(ord.total_paisa)}
                        </div>
                        <StatusBadge status={ord.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCREEN #14 VENDOR PRODUCTS */}
          {activeTab === 'products' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'ACTIVE', label: 'Active' },
                    { id: 'DRAFT', label: 'Draft' },
                    { id: 'PENDING_APPROVAL', label: 'Pending Approval' },
                    { id: 'REJECTED', label: 'Rejected' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setProductFilter(t.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border ${
                        productFilter === t.id
                          ? 'bg-[#111827] text-white border-[#111827]'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddModal((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#111827] text-white text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>

              {showAddModal && (
                <form
                  onSubmit={handleCreateProduct}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                  <input
                    required
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Product Title (e.g. Birgunj Silk Kurta)"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                  />
                  <input
                    type="text"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="SKU (e.g. WB-SLK-001)"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                  />
                  <input
                    required
                    type="number"
                    min={100}
                    value={newPriceRupees}
                    onChange={(e) => setNewPriceRupees(Number(e.target.value))}
                    placeholder="Price in NPR"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                  />
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                  >
                    <option value="cat-shoes">Shoes</option>
                    <option value="cat-women">Women Fashion</option>
                    <option value="cat-men">Men Fashion</option>
                    <option value="cat-accessories">Accessories</option>
                    <option value="cat-bags">Bags</option>
                  </select>
                  <input
                    required
                    type="number"
                    min={1}
                    value={newStock}
                    onChange={(e) => setNewStock(Number(e.target.value))}
                    placeholder="Initial Stock Qty"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#E11D48] text-white text-xs font-bold px-4 py-2"
                  >
                    Submit for Moderation
                  </button>
                </form>
              )}

              {/* Products Table (Screen #14) */}
              <div className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs"
                  >
                    <div className="flex items-center gap-3.5 min-w-[240px]">
                      <img
                        src={p.image_url}
                        alt={p.title}
                        className="w-12 h-12 rounded-xl object-cover bg-slate-100"
                      />
                      <div>
                        <p className="font-bold text-sm text-slate-900">
                          {p.title}
                        </p>
                        <p className="text-slate-500">
                          {formatNpr(p.base_price_paisa)} • {p.category_name}
                        </p>
                        {p.rejection_reason && (
                          <p className="text-rose-600 text-[11px] mt-0.5">
                            Reason: {p.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="font-bold text-slate-700">
                      Stock: {p.total_stock}
                    </div>

                    <StatusBadge status={p.moderation_status} />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedProductForMedia(p)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 font-semibold hover:bg-rose-100 flex items-center gap-1.5"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Media
                      </button>

                      <Link
                        to={`/product/${p.slug}`}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View / Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SCREEN #15 VENDOR ORDERS */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2 overflow-x-auto">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'NEW', label: 'New' },
                  { id: 'PROCESSING', label: 'Processing' },
                  { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
                  { id: 'DELIVERED', label: 'Delivered' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOrderFilter(t.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border ${
                      orderFilter === t.id
                        ? 'bg-[#111827] text-white border-[#111827]'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="divide-y divide-slate-100">
                {filteredOrders.map((vo) => (
                  <div
                    key={vo.id}
                    className="py-4 flex flex-wrap items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        Order {vo.order_number}{' '}
                        <span className="text-slate-400 font-normal">
                          ({vo.vendor_order_number})
                        </span>
                      </p>
                      <p className="text-slate-500">
                        {formatShortDate(vo.created_at)} • Recipient: {vo.shipping_name}{' '}
                        (Ward {vo.shipping_ward}, Birgunj)
                      </p>
                    </div>

                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        {formatNpr(vo.total_paisa)}
                      </p>
                      <p className="text-slate-400">
                        {(vo.items || []).length} item(s) • Net:{' '}
                        {formatNpr(vo.net_vendor_paisa)}
                      </p>
                    </div>

                    <StatusBadge status={vo.status} />

                    <div className="flex items-center gap-2">
                      {vo.status === 'NEW' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOrderStatusChange(vo.id, 'PROCESSING')
                          }
                          className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold"
                        >
                          Pack Order
                        </button>
                      )}
                      {['NEW', 'PROCESSING'].includes(vo.status) && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOrderStatusChange(vo.id, 'OUT_FOR_DELIVERY')
                          }
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                        >
                          Dispatch (Rajesh)
                        </button>
                      )}
                      {vo.status !== 'DELIVERED' && vo.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOrderStatusChange(vo.id, 'DELIVERED')
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: SCREEN #12 VENDOR RETURN & EXCHANGE QUEUE */}
          {activeTab === 'returns' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Return & 36-Hour Exchange Queue
                  </h2>
                  <p className="text-xs text-slate-500">
                    Review customer return and size exchange requests with local Birgunj courier pickup
                  </p>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto">
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'REQUESTED', label: 'Pending Review' },
                    { id: 'APPROVED', label: 'Approved' },
                    { id: 'REJECTED', label: 'Rejected' },
                    { id: 'COMPLETED', label: 'Completed' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReturnFilter(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        returnFilter === t.id
                          ? 'bg-[#111827] text-white border-[#111827]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredReturns.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <RotateCcw className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-600">No return requests found in this filter.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredReturns.map((ret: any) => (
                    <div key={ret.id} className="py-4 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider ${
                              ret.request_type === 'EXCHANGE'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ret.request_type === 'EXCHANGE' ? '36-Hr Size Exchange' : 'Return for Refund'}
                          </span>
                          <span className="font-mono text-slate-400">Request #{ret.id.slice(0, 12)}</span>
                          <span className="text-slate-400">• Order #{ret.order_number}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={ret.status} />
                          <span className="text-slate-400">
                            Requested: {formatShortDate(ret.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                        <div className="md:col-span-6 flex items-center gap-3">
                          <img
                            src={
                              ret.image_url_snapshot ||
                              'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=160&auto=format&fit=crop&q=80'
                            }
                            alt={ret.product_title_snapshot}
                            className="w-14 h-14 rounded-xl object-cover bg-white border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0 text-xs">
                            <p className="font-bold text-slate-900 truncate">
                              {ret.product_title_snapshot}
                            </p>
                            <p className="text-slate-500">
                              Original: {ret.variant_title_snapshot || 'Standard'} • Value:{' '}
                              <strong className="text-slate-800">{formatNpr(ret.refund_amount_paisa)}</strong>
                            </p>
                            {ret.replacement_variant_title && (
                              <p className="text-blue-700 font-semibold mt-0.5">
                                Replacement Variant: {ret.replacement_variant_title}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="md:col-span-6 text-xs space-y-1">
                          <p className="text-slate-700">
                            <strong>Reason:</strong> {ret.reason}
                          </p>
                          {ret.customer_explanation && (
                            <p className="text-slate-600 italic">
                              "{ret.customer_explanation}"
                            </p>
                          )}
                          <p className="text-slate-500">
                            <strong>Customer Pickup:</strong> {ret.pickup_address_text || `Customer Ward Delivery Address`}
                          </p>
                        </div>
                      </div>

                      {ret.status === 'REJECTED' && ret.rejection_reason && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                          <strong>Rejection Reason:</strong> {ret.rejection_reason}
                        </div>
                      )}

                      {ret.status === 'REQUESTED' && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectModalReturn(ret);
                              setRejectionReasonInput('');
                            }}
                            className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                          >
                            Reject Request
                          </button>
                          <button
                            type="button"
                            disabled={isReviewingReturn}
                            onClick={() => handleReviewReturn(ret.id, 'APPROVE')}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve {ret.request_type === 'EXCHANGE' ? '& Reserve Replacement Stock' : '& Authorize Pickup'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: VENDOR IMMUTABLE FINANCIAL LEDGER */}
          {activeTab === 'finance' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs text-slate-400">Available Settlement Balance</p>
                  <p className="text-3xl font-extrabold text-emerald-700">
                    {formatNpr(finance?.balancePaisa || 0)}
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  Append-only PostgreSQL Ledger (`vendor_ledger_entries`)
                </span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {(finance?.ledgerEntries || []).map((entry: any) => (
                  <div
                    key={entry.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {entry.description}
                      </p>
                      <p className="text-slate-400">
                        {entry.entry_type} • {formatShortDate(entry.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          entry.amount_paisa >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                        }`}
                      >
                        {entry.amount_paisa >= 0 ? '+' : ''}
                        {formatNpr(entry.amount_paisa)}
                      </p>
                      <p className="text-slate-400">
                        Bal: {formatNpr(entry.balance_after_paisa)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cloudinary Media Management Modal */}
      {selectedProductForMedia && (
        <ProductMediaModal
          product={selectedProductForMedia}
          onClose={() => setSelectedProductForMedia(null)}
          onUpdated={() => loadVendorAll()}
        />
      )}

      {/* Reject Return Modal */}
      {rejectModalReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Reject Return Request
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalReturn(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Please state the specific reason for rejecting the return or exchange request for item{' '}
              <strong>{rejectModalReturn.product_title_snapshot}</strong>. This explanation will be displayed directly to the customer.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rejection Reason * (min 5 chars)
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="e.g. Tags were removed, product visibly worn, or returned after 36-hr SLA window expired..."
                className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-slate-50 focus:bg-white resize-none"
              />
              <p className="text-[11px] text-slate-400 text-right mt-1">
                {rejectionReasonInput.length}/500 chars
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalReturn(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReviewingReturn || rejectionReasonInput.trim().length < 5}
                onClick={() =>
                  handleReviewReturn(
                    rejectModalReturn.id,
                    'REJECT',
                    rejectionReasonInput.trim(),
                  )
                }
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40 transition-colors"
              >
                {isReviewingReturn ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SCREEN #16: ADMIN PORTAL (DASHBOARD, VENDOR KYC, PRODUCT MODERATION, AUDIT)
// ============================================================================
export const AdminPortalPage: React.FC = () => {
  const { user, loginWithCredentials, showToast } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'vendors' | 'products' | 'returns' | 'audit'
  >('dashboard');

  const [dashboard, setDashboard] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const loadAdminAll = async () => {
    try {
      if (!user?.roles?.includes('PLATFORM_ADMIN') && !user?.roles?.includes('SUPER_ADMIN')) {
        await loginWithCredentials('admin@wearbirgunj.np', 'AdminPass123!');
      }
      const [dRes, vRes, pRes, rRes, aRes] = await Promise.all([
        apiFetch('/admin/dashboard'),
        apiFetch('/admin/vendors'),
        apiFetch('/admin/products'),
        apiFetch('/admin/returns'),
        apiFetch('/admin/audit-logs'),
      ]);
      setDashboard(dRes);
      setVendors(vRes.items || []);
      setProducts(pRes.items || []);
      setReturnsList(rRes.items || []);
      setAuditLogs(aRes.items || []);
    } catch (err: any) {
      showToast(err.message || 'Could not load admin panel.', 'error');
    }
  };

  useEffect(() => {
    loadAdminAll();
  }, [user?.userId]);

  const handleModerateVendor = async (
    vendorId: string,
    status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
  ) => {
    try {
      await apiFetch(`/admin/vendors/${vendorId}/moderate`, {
        method: 'PATCH',
        body: {
          status,
          reason: `Admin decision: ${status} via Wear Birgunj Admin Panel`,
        },
      });
      showToast(`Vendor marked ${status}`, 'success');
      loadAdminAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleModerateProduct = async (
    productId: string,
    status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED',
  ) => {
    try {
      await apiFetch(`/admin/products/${productId}/moderate`, {
        method: 'PATCH',
        body: {
          status,
          reason: `Catalog Moderator action: ${status}`,
        },
      });
      showToast(`Product moderation updated to ${status}`, 'success');
      loadAdminAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9]">
      <RoleSwitcherBar />

      <div className="flex-1 flex">
        {/* Left Dark Navy Sidebar (Screen #16) */}
        <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col justify-between p-5 shrink-0">
          <div className="space-y-6">
            <WearBirgunjLogo dark subtitle="Admin Panel" />

            <nav className="space-y-1.5 text-sm">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'vendors', label: 'Vendors & KYC', icon: Store },
                { id: 'products', label: 'Product Moderation', icon: Package },
                { id: 'returns', label: 'Returns & Refunds', icon: Wallet },
                { id: 'audit', label: 'Security Audit Logs', icon: FileText },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-colors ${
                      activeTab === item.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[#E11D48]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Storefront
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 p-6 sm:p-8 space-y-6 overflow-y-auto">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {activeTab === 'dashboard' && 'Platform Overview Dashboard'}
                {activeTab === 'vendors' && 'Vendor Onboarding & KYC Verification'}
                {activeTab === 'products' && 'Catalog Moderation Queue'}
                {activeTab === 'returns' && '36-Hour Returns, Exchanges & Refunds'}
                {activeTab === 'audit' && 'Immutable Security & Admin Audit Logs'}
              </h1>
              <p className="text-xs text-slate-500">
                Wear Birgunj Governance & Operations Control Center
              </p>
            </div>
          </div>

          {/* SCREEN #16: ADMIN DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-xs font-medium text-slate-400">Total Orders</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">
                    {dashboard?.kpis?.totalOrders || 4}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600 mt-2">
                    ↑ +15% this month
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-xs font-medium text-slate-400">Total Sales</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">
                    {formatNpr(dashboard?.kpis?.totalSalesPaisa || 1499600)}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600 mt-2">
                    ↑ +18% this month
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-xs font-medium text-slate-400">Vendors</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">
                    {dashboard?.kpis?.totalVendors || 3}
                  </p>
                  <p className="text-xs font-semibold text-amber-600 mt-2">
                    {dashboard?.kpis?.pendingVendors || 1} awaiting KYC review
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                  <p className="text-xs font-medium text-slate-400">Customers</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">
                    {dashboard?.kpis?.totalCustomers || 7}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600 mt-2">
                    ↑ +22% active in Birgunj
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-base text-slate-900">
                      Sales Analytics
                    </h2>
                    <span className="text-xs px-3 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium">
                      This Month
                    </span>
                  </div>
                  <svg className="w-full h-52" viewBox="0 0 500 180" fill="none">
                    <defs>
                      <linearGradient id="adminSalesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 10 155 Q 80 120, 140 128 T 260 95 T 370 55 T 490 20 L 490 170 L 10 170 Z"
                      fill="url(#adminSalesGrad)"
                    />
                    <path
                      d="M 10 155 Q 80 120, 140 128 T 260 95 T 370 55 T 490 20"
                      stroke="#2563EB"
                      strokeWidth="3"
                      fill="none"
                    />
                  </svg>
                </div>

                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <h2 className="font-bold text-base text-slate-900">
                    Recent Orders
                  </h2>
                  <div className="divide-y divide-slate-100">
                    {(dashboard?.recentOrders || []).map((o: any) => (
                      <div
                        key={o.id}
                        className="py-3 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {o.order_number}
                          </p>
                          <p className="text-slate-400">
                            {o.shipping_name} (Ward {o.shipping_ward})
                          </p>
                        </div>
                        <span className="font-bold text-slate-900">
                          {formatNpr(o.total_paisa)}
                        </span>
                        <StatusBadge status={o.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VENDOR KYC APPROVAL QUEUE */}
          {activeTab === 'vendors' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm divide-y divide-slate-100">
              {vendors.map((v) => (
                <div
                  key={v.id}
                  className="py-4 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-900">
                      {v.business_name} (`/{v.slug}`)
                    </p>
                    <p className="text-slate-500">
                      PAN/VAT: {v.pan_vat_number} • Ward {v.ward_number},{' '}
                      {v.address_text} • {v.contact_phone}
                    </p>
                  </div>

                  <StatusBadge status={v.approval_status} />

                  <div className="flex items-center gap-2">
                    {v.approval_status !== 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => handleModerateVendor(v.id, 'APPROVED')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                      >
                        Approve KYC
                      </button>
                    )}
                    {v.approval_status !== 'SUSPENDED' && (
                      <button
                        type="button"
                        onClick={() => handleModerateVendor(v.id, 'SUSPENDED')}
                        className="px-3.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 font-semibold hover:bg-rose-50"
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PRODUCT MODERATION QUEUE */}
          {activeTab === 'products' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm divide-y divide-slate-100">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="py-4 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="w-12 h-12 rounded-xl object-cover bg-slate-100"
                    />
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        {p.title}
                      </p>
                      <p className="text-slate-500">
                        Vendor: <strong>{p.vendor_name}</strong> •{' '}
                        {formatNpr(p.base_price_paisa)}
                      </p>
                    </div>
                  </div>

                  <StatusBadge status={p.moderation_status} />

                  <div className="flex items-center gap-2">
                    {p.moderation_status !== 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => handleModerateProduct(p.id, 'ACTIVE')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                      >
                        Approve & Publish
                      </button>
                    )}
                    {p.moderation_status !== 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => handleModerateProduct(p.id, 'REJECTED')}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-semibold"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* RETURNS & REFUNDS */}
          {activeTab === 'returns' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm divide-y divide-slate-100 text-xs">
              {returnsList.length === 0 ? (
                <p className="py-8 text-center text-slate-500">
                  No return or exchange requests yet.
                </p>
              ) : (
                returnsList.map((rr) => (
                  <div
                    key={rr.id}
                    className="py-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {rr.order_number} — {rr.product_title_snapshot} (
                        {rr.request_type})
                      </p>
                      <p className="text-slate-500">
                        Customer: {rr.customer_name} • Reason: {rr.reason}
                      </p>
                    </div>
                    <span className="font-bold">
                      {formatNpr(rr.refund_amount_paisa)}
                    </span>
                    <StatusBadge status={rr.status} />
                  </div>
                ))
              )}
            </div>
          )}

          {/* IMMUTABLE SECURITY & ADMIN AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm divide-y divide-slate-100 text-xs">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900">
                      {log.action}
                    </span>{' '}
                    <span className="text-slate-500">
                      on {log.target_type} ({log.target_id})
                    </span>
                    {log.reason && (
                      <p className="text-slate-500 mt-0.5">Reason: {log.reason}</p>
                    )}
                  </div>
                  <div className="text-right text-slate-400">
                    <p>Role: {log.actor_role}</p>
                    <p>{formatShortDate(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
