import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Trash2,
  Minus,
  Plus,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  Package,
  Heart,
  Bell,
  LogOut,
  ChevronRight,
  Truck,
  ShieldCheck,
  RefreshCw,
  ArrowLeftRight,
  RotateCcw,
  AlertCircle,
  X,
  Check,
  Info,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatNpr, formatShortDate, formatTimeOnly } from '../lib/api';
import {
  StatusBadge,
  StorefrontFooter,
  StorefrontHeader,
} from '../components/DesignSystem';

// ============================================================================
// SCREEN #4: CART PAGE
// ============================================================================
export const CartPage: React.FC = () => {
  const { cart, updateCartQty, refreshCart, showToast } = useAuth();
  const navigate = useNavigate();
  const [couponInput, setCouponInput] = useState(cart.couponCode || '');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyingCoupon(true);
    try {
      await apiFetch('/customer/cart/coupon', {
        method: 'POST',
        body: { code: couponInput },
      });
      await refreshCart();
      showToast(
        couponInput ? `Coupon "${couponInput.toUpperCase()}" applied!` : 'Coupon removed',
        'success',
      );
    } catch (err: any) {
      showToast(err.message || 'Invalid coupon code', 'error');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const totalCount = cart.items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">
          Your Cart ({totalCount} item{totalCount === 1 ? '' : 's'})
        </h1>

        {cart.items.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
            <p className="text-lg font-semibold text-slate-800">
              Your Birgunj shopping cart is empty
            </p>
            <p className="text-xs text-slate-500">
              Explore authentic sneakers, kurtis, watches, and bags from approved local vendors.
            </p>
            <Link
              to="/category/all"
              className="inline-block px-6 py-3 rounded-full bg-[#111827] text-white text-xs font-semibold"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Cart Items List (Screen #4) */}
            <div className="lg:col-span-7 space-y-4">
              {cart.items.map((item: any) => (
                <div
                  key={item.variant_id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-4 shadow-sm"
                >
                  <img
                    src={item.image_url}
                    alt={item.product_title}
                    className="w-20 h-20 rounded-xl object-cover bg-slate-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/product/${item.product_slug}`}
                          className="font-bold text-sm text-slate-900 hover:text-[#E11D48]"
                        >
                          {item.product_title}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.variant_title} • Sold by {item.vendor_name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.variant_id, 0)}
                        aria-label={`Remove ${item.product_title}`}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900">
                        {formatNpr(item.unit_price_paisa)}
                      </span>

                      <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQty(item.variant_id, item.quantity - 1)
                          }
                          aria-label="Decrease quantity"
                          className="p-1.5 text-slate-600 hover:text-slate-900"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-xs font-bold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQty(item.variant_id, item.quantity + 1)
                          }
                          aria-label="Increase quantity"
                          className="p-1.5 text-slate-600 hover:text-slate-900"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Coupon & Order Summary Card (Screen #4) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
                <form onSubmit={handleApplyCoupon} className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Have a coupon code? (Try <code className="text-[#E11D48]">BIRGUNJ10</code>)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs uppercase font-semibold"
                    />
                    <button
                      type="submit"
                      disabled={applyingCoupon}
                      className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-900 text-white text-xs font-semibold"
                    >
                      Apply
                    </button>
                  </div>
                </form>

                <div className="border-t border-slate-100 pt-4 space-y-2.5 text-sm">
                  <h2 className="font-bold text-base text-slate-900 mb-3">
                    Order Summary
                  </h2>
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-900">
                      {formatNpr(cart.summary.subtotalPaisa)}
                    </span>
                  </div>
                  {cart.summary.discountPaisa > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Coupon Discount ({cart.couponCode})</span>
                      <span className="font-semibold">
                        - {formatNpr(cart.summary.discountPaisa)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Fee (Birgunj 2–4 Hr)</span>
                    <span className="font-semibold text-emerald-700">
                      {cart.summary.shippingPaisa === 0
                        ? 'Rs. 0 (Free)'
                        : formatNpr(cart.summary.shippingPaisa)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Included 13% VAT Snapshot</span>
                    <span>{formatNpr(cart.summary.taxPaisa)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-base text-slate-900">Total</span>
                    <span className="font-extrabold text-xl text-slate-900">
                      {formatNpr(cart.summary.totalPaisa)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/checkout')}
                  className="w-full py-3.5 rounded-xl bg-[#111827] hover:bg-slate-800 text-white font-semibold text-sm shadow-sm transition-colors"
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <StorefrontFooter />
    </div>
  );
};

// ============================================================================
// SCREEN #5: 3-STEP CHECKOUT PAGE
// ============================================================================
export const CheckoutPage: React.FC = () => {
  const { user, cart, refreshCart, showToast } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState(user?.fullName || 'John Doe');
  const [phone, setPhone] = useState(user?.phone || '+977 9801234567');
  const [wardNumber, setWardNumber] = useState(10);
  const [streetAddress, setStreetAddress] = useState('Ward 10, Birgunj');
  const [landmark, setLandmark] = useState('Near Main Road');
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    'Call before delivery',
  );
  const [paymentMethod, setPaymentMethod] = useState<'ESEWA' | 'KHALTI' | 'COD'>(
    'ESEWA',
  );
  const [submitting, setSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    setSubmitting(true);
    try {
      const idempotencyKey = `web-chk-${Date.now()}`;
      const res = await apiFetch('/customer/checkout', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: {
          fullName,
          phone,
          wardNumber: Number(wardNumber),
          streetAddress,
          landmark,
          deliveryInstructions,
          paymentMethod,
        },
      });
      await refreshCart();
      showToast(`Order ${res.order.orderNumber} placed!`, 'success');
      navigate(`/order-confirmation/${res.order.id}`);
    } catch (err: any) {
      showToast(err.message || 'Checkout failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          {/* 3-Step Indicator (Screen #5: Shipping -> Payment -> Review) */}
          <div className="flex items-center justify-between max-w-md mx-auto pb-4 border-b border-slate-100">
            {[
              { num: 1, label: 'Shipping' },
              { num: 2, label: 'Payment' },
              { num: 3, label: 'Review' },
            ].map((s) => (
              <div key={s.num} className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ${
                    step >= s.num
                      ? 'bg-[#111827] text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {s.num}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    step >= s.num ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep(2);
              }}
              className="space-y-4"
            >
              <h1 className="text-lg font-bold text-slate-900">
                Delivery Information
              </h1>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Phone Number
                  </label>
                  <input
                    required
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Birgunj Ward (1–32)
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={32}
                    value={wardNumber}
                    onChange={(e) => setWardNumber(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Address
                </label>
                <input
                  required
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Landmark
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Delivery Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[#111827] hover:bg-slate-800 text-white font-semibold text-sm mt-2"
              >
                Continue to Payment
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">
                Select Payment Method
              </h2>
              <div className="space-y-3">
                {[
                  {
                    id: 'ESEWA',
                    title: 'eSewa Mobile Wallet',
                    desc: 'Instant digital payment verified via signed server webhook',
                  },
                  {
                    id: 'KHALTI',
                    title: 'Khalti Digital Wallet',
                    desc: 'Pay seamlessly via Khalti wallet or linked Nepal bank',
                  },
                  {
                    id: 'COD',
                    title: 'Cash on Delivery (Birgunj Express)',
                    desc: 'Pay in cash to your Birgunj delivery partner at doorstep',
                  },
                ].map((pm) => (
                  <label
                    key={pm.id}
                    className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                      paymentMethod === pm.id
                        ? 'border-[#111827] bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === pm.id}
                      onChange={() => setPaymentMethod(pm.id as any)}
                      className="mt-1 accent-[#111827]"
                    />
                    <div>
                      <p className="font-bold text-sm text-slate-900">{pm.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{pm.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-3.5 rounded-xl bg-[#111827] text-white font-semibold text-sm"
                >
                  Review Order
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-900">
                Confirm & Place Order
              </h2>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  Delivering to: {fullName} ({phone})
                </p>
                <p className="text-slate-600">
                  {streetAddress} (Ward {wardNumber}), {landmark}
                </p>
                <p className="text-slate-500">
                  Payment Method: <strong>{paymentMethod}</strong> • Total:{' '}
                  <strong className="text-slate-900">
                    {formatNpr(cart.summary.totalPaisa)}
                  </strong>
                </p>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl p-4">
                {cart.items.map((item: any) => (
                  <div
                    key={item.variant_id}
                    className="py-2.5 flex justify-between text-xs"
                  >
                    <span>
                      {item.quantity}x {item.product_title} ({item.variant_title})
                    </span>
                    <span className="font-bold">
                      {formatNpr(item.line_total_paisa)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-3 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handlePlaceOrder}
                  className="flex-1 py-3.5 rounded-xl bg-[#111827] hover:bg-slate-800 text-white font-semibold text-sm"
                >
                  {submitting
                    ? 'Reserving Stock & Placing Order...'
                    : `Place Order (${formatNpr(cart.summary.totalPaisa)})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
};

// ============================================================================
// SCREEN #6: ORDER CONFIRMATION PAGE
// ============================================================================
export const OrderConfirmationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/customer/orders/${id}`).then((res) => setData(res));
  }, [id]);

  const order = data?.order;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900">
              Order Placed Successfully!
            </h1>
            <p className="text-xs text-slate-500">
              Thank you for shopping with Wear Birgunj.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 text-left space-y-3">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-[11px] text-slate-400">Order ID</p>
                <p className="font-bold text-sm text-slate-900">
                  {order?.order_number || '#WB123456'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-200/70 pt-3">
              <Clock className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-[11px] text-slate-400">Estimated Delivery</p>
                <p className="font-bold text-sm text-slate-900">
                  {order?.estimated_delivery_text || 'Today, 2–4 Hours'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <Link
              to={`/orders/${order?.id || 'ord-wb123456'}/track`}
              className="block w-full py-3.5 rounded-xl bg-[#111827] hover:bg-slate-800 text-white font-semibold text-sm"
            >
              Track Order
            </Link>
            <Link
              to="/category/all"
              className="block w-full py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300"
            >
              Continue Shopping
            </Link>
          </div>

          {/* What's Next Timeline (Screen #6) */}
          <div className="text-left border-t border-slate-100 pt-5 space-y-3">
            <h2 className="font-bold text-sm text-slate-900">What's Next?</h2>
            {[
              { label: 'Order Confirmed', done: true },
              { label: 'Preparing Your Order', done: true },
              { label: 'Out for Delivery', done: false },
              { label: 'Delivered', done: false },
            ].map((stepItem) => (
              <div key={stepItem.label} className="flex items-center gap-3 text-xs">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    stepItem.done ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <span
                  className={
                    stepItem.done
                      ? 'font-semibold text-slate-900'
                      : 'text-slate-400'
                  }
                >
                  {stepItem.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
};

// ============================================================================
// SCREEN #7: USER ACCOUNT / PROFILE PAGE
// ============================================================================
export const AccountProfilePage: React.FC = () => {
  const { user, addresses, notifications, refreshSession, logout, showToast } =
    useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<
    'profile' | 'addresses' | 'returns' | 'notifications'
  >('profile');
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [newWard, setNewWard] = useState(10);
  const [newStreet, setNewStreet] = useState('');
  const [newLandmark, setNewLandmark] = useState('');

  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);

  const loadCustomerReturns = async () => {
    setLoadingReturns(true);
    try {
      const res = await apiFetch('/customer/returns');
      setReturnsList(res.items || []);
    } catch {
      // ignore
    } finally {
      setLoadingReturns(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'returns') {
      loadCustomerReturns();
    }
  }, [activeSection]);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: { fullName, phone },
      });
      await refreshSession();
      showToast('Profile updated!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not update profile.', 'error');
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/auth/addresses', {
        method: 'POST',
        body: {
          label: 'Home',
          fullName: user?.fullName || 'Customer',
          phone: user?.phone || '+977 9801234567',
          wardNumber: Number(newWard),
          streetAddress: newStreet,
          landmark: newLandmark,
          isDefault: true,
        },
      });
      setNewStreet('');
      setNewLandmark('');
      await refreshSession();
      showToast('Birgunj delivery address saved!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left Account Sidebar (Screen #7) */}
          <aside className="md:col-span-4 lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-4 h-fit space-y-1">
            <h2 className="font-bold text-xs uppercase tracking-wider text-slate-400 px-3 py-2">
              My Account
            </h2>
            <button
              type="button"
              onClick={() => setActiveSection('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                activeSection === 'profile'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <User className="w-4 h-4" /> Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('addresses')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                activeSection === 'addresses'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <MapPin className="w-4 h-4" /> Addresses ({addresses.length})
            </button>
            <Link
              to="/orders"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Package className="w-4 h-4" /> My Orders
            </Link>
            <button
              type="button"
              onClick={() => {
                setActiveSection('returns');
                loadCustomerReturns();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                activeSection === 'returns'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4 text-rose-500" /> Returns & Exchanges ({returnsList.length})
            </button>
            <Link
              to="/wishlist"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Heart className="w-4 h-4" /> Wishlist
            </Link>
            <button
              type="button"
              onClick={() => setActiveSection('notifications')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                activeSection === 'notifications'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Bell className="w-4 h-4" /> Notifications ({notifications.length})
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </aside>

          {/* Right Panel (Screen #7) */}
          <div className="md:col-span-8 lg:col-span-9 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
            {activeSection === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-6 max-w-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <img
                      src={
                        user?.avatarUrl ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80'
                      }
                      alt={user?.fullName}
                      className="w-16 h-16 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <h1 className="text-xl font-bold text-slate-900">
                        {user?.fullName}
                      </h1>
                      <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold hover:bg-slate-50"
                  >
                    Save Profile
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </form>
            )}

            {activeSection === 'addresses' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-slate-900">
                  Saved Birgunj Addresses
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addresses.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 rounded-2xl border border-slate-200 space-y-1 text-xs"
                    >
                      <p className="font-bold text-sm text-slate-900">
                        {a.full_name} (Ward {a.ward_number})
                      </p>
                      <p className="text-slate-600">{a.street_address}</p>
                      <p className="text-slate-500">{a.landmark}</p>
                      <p className="text-slate-500">{a.phone}</p>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleAddAddress}
                  className="border-t border-slate-100 pt-5 space-y-3 max-w-md"
                >
                  <h3 className="font-bold text-sm">Add New Birgunj Address</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      min={1}
                      max={32}
                      value={newWard}
                      onChange={(e) => setNewWard(Number(e.target.value))}
                      placeholder="Ward (1-32)"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                    <input
                      required
                      type="text"
                      value={newStreet}
                      onChange={(e) => setNewStreet(e.target.value)}
                      placeholder="Street / Area in Birgunj"
                      className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={newLandmark}
                    onChange={(e) => setNewLandmark(e.target.value)}
                    placeholder="Landmark (e.g. Near Ghantaghar)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#111827] text-white text-xs font-semibold"
                  >
                    Save Address
                  </button>
                </form>
              </div>
            )}

            {activeSection === 'returns' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Returns & 36-Hour Easy Exchanges
                    </h2>
                    <p className="text-xs text-slate-500">
                      Track your return and exchange status with local Birgunj courier pickup
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadCustomerReturns}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingReturns ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {loadingReturns ? (
                  <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
                ) : returnsList.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                    <ArrowLeftRight className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm font-semibold text-slate-700">No active return or exchange requests</p>
                    <p className="text-xs text-slate-400">
                      You can request a size exchange or return within 36 hours of delivery from your Orders page.
                    </p>
                    <Link
                      to="/orders"
                      className="inline-block px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl"
                    >
                      View Delivered Orders
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {returnsList.map((ret) => (
                      <div
                        key={ret.id}
                        className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                ret.request_type === 'EXCHANGE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ret.request_type === 'EXCHANGE' ? '36-Hr Size Exchange' : 'Return for Refund'}
                            </span>
                            <span className="text-xs font-mono text-slate-400">#{ret.id}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusBadge status={ret.status} />
                            <span className="text-xs text-slate-400">
                              {formatShortDate(ret.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <img
                            src={
                              ret.image_url_snapshot ||
                              'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=160&auto=format&fit=crop&q=80'
                            }
                            alt={ret.product_title_snapshot}
                            className="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-100 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-slate-900 truncate">
                              {ret.product_title_snapshot}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Original: {ret.variant_title_snapshot || 'Standard'} • Vendor: {ret.vendor_name || 'Fashion Hub'}
                            </p>
                            {ret.replacement_variant_title && (
                              <p className="text-xs font-semibold text-blue-600 mt-0.5">
                                Replacement Variant: {ret.replacement_variant_title}
                              </p>
                            )}
                            <p className="text-xs font-extrabold text-slate-800 mt-1">
                              {formatNpr(ret.refund_amount_paisa)}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 border border-slate-100">
                          <div className="flex items-start gap-2">
                            <span className="font-semibold text-slate-500 shrink-0">Reason:</span>
                            <span className="text-slate-800">{ret.reason}</span>
                          </div>
                          {ret.customer_explanation && (
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-slate-500 shrink-0">Explanation:</span>
                              <span className="text-slate-700 italic">"{ret.customer_explanation}"</span>
                            </div>
                          )}
                          {ret.pickup_address_text && (
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-slate-500 shrink-0">Pickup:</span>
                              <span className="text-slate-700">📍 {ret.pickup_address_text}</span>
                            </div>
                          )}
                        </div>

                        {ret.status === 'REJECTED' && ret.rejection_reason && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">Vendor Rejection Reason:</p>
                              <p className="mt-0.5">{ret.rejection_reason}</p>
                            </div>
                          </div>
                        )}

                        {ret.status === 'APPROVED' && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">Request Approved by Vendor</p>
                              <p className="mt-0.5">
                                Rajesh Kumar (Birgunj Express) has been assigned to collect your package from your Birgunj doorstep.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1"
                  >
                    <p className="font-bold text-sm text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-600">{n.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <StorefrontFooter />
    </div>
  );
};

// ============================================================================
// SCREEN #10: RETURN & EXCHANGE MODAL (36-HR SLA + RESOLUTION + LIVE VARIANTS)
// ============================================================================
export const ReturnExchangeModal: React.FC<{
  order: any;
  item: any;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ order, item, onClose, onSuccess }) => {
  const { showToast } = useAuth();
  const [requestType, setRequestType] = useState<'EXCHANGE' | 'RETURN'>('EXCHANGE');
  const [reason, setReason] = useState('Incorrect size / doesn\'t fit properly');
  const [explanation, setExplanation] = useState('');
  const [pickupAddress, setPickupAddress] = useState(
    order?.shipping_address
      ? `${order.shipping_address}, Ward ${order.shipping_ward || 10}, Birgunj`
      : 'Ward 10, Adarshnagar, Birgunj',
  );
  const [replacementVariantId, setReplacementVariantId] = useState<string>('');
  const [availableVariants, setAvailableVariants] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item?.product_id) {
      setLoadingVariants(true);
      apiFetch(`/products/${item.product_id}`)
        .then((res) => {
          if (res?.product?.variants && res.product.variants.length > 0) {
            setAvailableVariants(res.product.variants);
            const otherVar = res.product.variants.find((v: any) => v.id !== item.variant_id);
            if (otherVar) {
              setReplacementVariantId(otherVar.id);
            } else if (res.product.variants[0]) {
              setReplacementVariantId(res.product.variants[0].id);
            }
          }
        })
        .catch(() => {
          // fallback if product lookup by id is not direct
        })
        .finally(() => setLoadingVariants(false));
    }
  }, [item?.product_id, item?.variant_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (explanation.trim().length < 10) {
      showToast('Explanation must be at least 10 characters long.', 'error');
      return;
    }

    if (requestType === 'EXCHANGE' && !replacementVariantId) {
      showToast('Please select a replacement size/variant for your exchange.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/customer/returns', {
        method: 'POST',
        body: {
          orderItemId: item.id,
          requestType,
          reason,
          explanation: explanation.trim(),
          replacementVariantId: requestType === 'EXCHANGE' ? replacementVariantId : undefined,
          pickupAddressText: pickupAddress.trim(),
        },
      });

      showToast(
        requestType === 'EXCHANGE'
          ? '36-Hour Size Exchange requested! Our vendor will review and dispatch replacement.'
          : 'Return for refund requested! Birgunj local courier assigned upon approval.',
        'success',
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Could not submit return/exchange request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                36-Hour Easy Return & Exchange
              </h3>
              <p className="text-xs text-slate-500">
                Order {order?.order_number} • Birgunj Hyperlocal SLA
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

        {/* 36-Hr SLA Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-100 flex items-start gap-3">
          <Clock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700">
            <p className="font-bold text-rose-950">Birgunj 36-Hour SLA Guarantee Active</p>
            <p className="mt-0.5 text-slate-600 leading-relaxed">
              Items delivered within the last 36 hours qualify for free doorstep exchange or returns. Rajesh Kumar and local couriers will pick up from your Birgunj address.
            </p>
          </div>
        </div>

        {/* Selected Item Preview */}
        <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <img
            src={
              item?.image_url_snapshot ||
              'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=160&auto=format&fit=crop&q=80'
            }
            alt={item?.product_title_snapshot}
            className="w-14 h-14 rounded-xl object-cover bg-white border border-slate-200 shrink-0"
          />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-bold text-slate-900 truncate">
              {item?.product_title_snapshot || 'Product Item'}
            </p>
            <p className="text-slate-500">
              Purchased: {item?.variant_title_snapshot || 'Standard'} • Qty: {item?.quantity || 1}
            </p>
            <p className="font-extrabold text-slate-900 mt-0.5">
              {formatNpr(item?.line_total_paisa || item?.unit_price_paisa)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action Type Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Select Resolution Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRequestType('EXCHANGE')}
                className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                  requestType === 'EXCHANGE'
                    ? 'border-[#111827] bg-[#111827] text-white shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                <ArrowLeftRight className={`w-4 h-4 mt-0.5 ${requestType === 'EXCHANGE' ? 'text-rose-400' : 'text-slate-500'}`} />
                <div>
                  <p className="font-bold text-xs">Size Exchange</p>
                  <p className={`text-[11px] mt-0.5 ${requestType === 'EXCHANGE' ? 'text-slate-300' : 'text-slate-500'}`}>
                    Swap for different size / color
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRequestType('RETURN')}
                className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                  requestType === 'RETURN'
                    ? 'border-[#111827] bg-[#111827] text-white shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                }`}
              >
                <RotateCcw className={`w-4 h-4 mt-0.5 ${requestType === 'RETURN' ? 'text-amber-400' : 'text-slate-500'}`} />
                <div>
                  <p className="font-bold text-xs">Return & Refund</p>
                  <p className={`text-[11px] mt-0.5 ${requestType === 'RETURN' ? 'text-slate-300' : 'text-slate-500'}`}>
                    Full refund to payment method
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Replacement Variant Selector (for EXCHANGE) */}
          {requestType === 'EXCHANGE' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Choose Replacement Size / Variant *
              </label>
              {loadingVariants ? (
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              ) : availableVariants.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableVariants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setReplacementVariantId(v.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        replacementVariantId === v.id
                          ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className="font-bold text-xs text-slate-900 truncate">
                        {v.title || v.size_value || 'Variant'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {v.color_name ? `${v.color_name} • ` : ''}Stock: {v.available_qty ?? 'Available'}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  value={replacementVariantId}
                  onChange={(e) => setReplacementVariantId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5 bg-slate-50 focus:bg-white"
                >
                  <option value="">Select Replacement Size (e.g. Size 40 / Size 42)</option>
                  <option value={item?.variant_id || 'var-default'}>Standard Replacement Variant</option>
                </select>
              )}
            </div>
          )}

          {/* Reason Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reason for Request *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5 bg-slate-50 focus:bg-white"
            >
              <option value="Incorrect size / doesn't fit properly">
                Incorrect size / doesn't fit properly
              </option>
              <option value="Defective / damaged piece">
                Defective / damaged piece
              </option>
              <option value="Color or fabric mismatch from photo">
                Color or fabric mismatch from photo
              </option>
              <option value="Received wrong item">
                Received wrong item
              </option>
              <option value="Quality not as expected">
                Quality not as expected
              </option>
            </select>
          </div>

          {/* Explanation Textarea (10-1000 chars) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Detailed Explanation * (10–1000 characters)
              </label>
              <span
                className={`text-[11px] ${
                  explanation.length < 10
                    ? 'text-rose-500 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {explanation.length}/1000 chars {explanation.length < 10 ? '(min 10)' : ''}
              </span>
            </div>
            <textarea
              required
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Please provide details (e.g. Waist too tight, need size 42 instead of 40, pickup from Adarshnagar near Ghantaghar)..."
              className="w-full text-xs rounded-xl border border-slate-300 p-3 bg-slate-50 focus:bg-white focus:border-slate-500 resize-none"
            />
            {explanation.length > 0 && explanation.length < 10 && (
              <p className="text-[11px] text-rose-500 mt-1">
                Please enter at least 10 characters so our vendor can prepare the right replacement.
              </p>
            )}
          </div>

          {/* Pickup Address in Birgunj */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Birgunj Doorstep Pickup Address *
            </label>
            <input
              required
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="e.g. Ward 10, Main Road, Adarshnagar, Birgunj"
              className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || explanation.trim().length < 10}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-bold disabled:opacity-40 transition-colors shadow-sm flex items-center gap-2"
            >
              {isSubmitting ? 'Submitting...' : requestType === 'EXCHANGE' ? 'Submit 36-Hr Exchange' : 'Submit Return Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// SCREEN #8: ORDER HISTORY PAGE
// ============================================================================
export const OrderHistoryPage: React.FC = () => {
  const { showToast } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedReturnItem, setSelectedReturnItem] = useState<{
    order: any;
    item: any;
  } | null>(null);

  const loadOrders = () => {
    setLoading(true);
    apiFetch('/customer/orders')
      .then((res) => setOrders(res.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filtered = orders.filter((o) =>
    filter === 'ALL' ? true : o.status === filter,
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Order History</h1>

        {/* Status Filter Tabs (Screen #8) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PROCESSING', label: 'Processing' },
            { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
            { id: 'DELIVERED', label: 'Delivered' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-[#111827] text-white border-[#111827]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Order Cards List (Screen #8) */}
        <div className="space-y-4">
          {loading ? (
            <div className="h-48 rounded-2xl bg-slate-200 animate-pulse" />
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
              No orders found in this status.
            </div>
          ) : (
            filtered.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      {(order.items || []).slice(0, 2).map((it: any) => (
                        <img
                          key={it.id}
                          src={
                            it.image_url_snapshot ||
                            'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=200&auto=format&fit=crop&q=80'
                          }
                          alt={it.product_title_snapshot}
                          className="w-14 h-14 rounded-xl object-cover border-2 border-white bg-slate-100"
                        />
                      ))}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        Order {order.order_number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatShortDate(order.created_at)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="font-extrabold text-sm text-slate-900">
                      {formatNpr(order.total_paisa)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(order.items || []).length || 1} Item
                      {(order.items || []).length === 1 ? '' : 's'} • {order.payment_method}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge status={order.status} />

                    <Link
                      to={`/orders/${order.id}/track`}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                      title="Track Order"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Individual order items with 36-Hr Exchange button */}
                {order.items && order.items.length > 0 && (
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    {order.items.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl bg-slate-50/70"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={
                              item.image_url_snapshot ||
                              'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=100&auto=format&fit=crop&q=80'
                            }
                            alt={item.product_title_snapshot}
                            className="w-8 h-8 rounded-lg object-cover bg-white shrink-0"
                          />
                          <div className="truncate">
                            <span className="font-semibold text-slate-800">
                              {item.product_title_snapshot}
                            </span>{' '}
                            <span className="text-slate-400">
                              ({item.variant_title_snapshot || 'Standard'}) × {item.quantity}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-slate-800">
                            {formatNpr(item.line_total_paisa)}
                          </span>

                          {order.status === 'DELIVERED' && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedReturnItem({ order, item })
                              }
                              className="px-2.5 py-1 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-[11px] font-bold text-rose-700 flex items-center gap-1 shadow-2xs"
                            >
                              <RotateCcw className="w-3 h-3" />
                              36-Hr Exchange / Return
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {selectedReturnItem && (
        <ReturnExchangeModal
          order={selectedReturnItem.order}
          item={selectedReturnItem.item}
          onClose={() => setSelectedReturnItem(null)}
          onSuccess={() => loadOrders()}
        />
      )}

      <StorefrontFooter />
    </div>
  );
};

// ============================================================================
// SCREEN #9: ORDER TRACKING PAGE (MAP + DELIVERY PARTNER RAJESH KUMAR + TIMELINE)
// ============================================================================
export const OrderTrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/customer/orders/${id}`)
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, [id]);

  const order = data?.order;
  const shipment = data?.shipments?.[0] || {
    delivery_partner_name: 'Rajesh Kumar',
    delivery_partner_phone: '+977 9812345678',
    delivery_partner_avatar:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&auto=format&fit=crop&q=80',
  };
  const events: any[] = data?.trackingEvents || [];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="h-80 rounded-3xl bg-slate-200 animate-pulse" />
        ) : !order ? (
          <div className="bg-white p-12 rounded-3xl text-center">
            <h1 className="text-xl font-bold">Order Not Found</h1>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Order {order.order_number}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Delivering to {order.shipping_name} • {order.shipping_address} (Ward{' '}
                  {order.shipping_ward})
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Estimated Delivery</p>
                <p className="text-base font-bold text-slate-900">
                  {order.estimated_delivery_text || 'Today, 2–4 Hours'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left: Birgunj Delivery Route Map + Delivery Partner Card (Screen #9) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="relative h-64 rounded-2xl bg-[#EEF2F6] border border-slate-200 overflow-hidden p-5 flex flex-col justify-between">
                  {/* Stylized Birgunj Map Grid & Route Path */}
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 400 220"
                    fill="none"
                  >
                    <path
                      d="M0 50 H400 M0 110 H400 M0 170 H400 M80 0 V220 M200 0 V220 M320 0 V220"
                      stroke="#CBD5E1"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <path
                      d="M 85 65 Q 160 65, 195 115 T 310 155"
                      stroke="#111827"
                      strokeWidth="4"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <circle cx="85" cy="65" r="9" fill="#E11D48" />
                    <circle cx="310" cy="155" r="9" fill="#15803D" />
                  </svg>

                  <div className="relative z-10 flex justify-between text-xs font-bold">
                    <span className="px-2.5 py-1 rounded-lg bg-white shadow text-slate-800">
                      📍 Fashion Hub (Adarshnagar)
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white shadow text-emerald-700">
                      🏠 Ward {order.shipping_ward}, Birgunj
                    </span>
                  </div>
                </div>

                {/* Delivery Partner Card (Screen #9: Rajesh Kumar) */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={
                        shipment.delivery_partner_avatar ||
                        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&auto=format&fit=crop&q=80'
                      }
                      alt={shipment.delivery_partner_name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow"
                    />
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        {shipment.delivery_partner_name}
                      </p>
                      <p className="text-xs text-slate-500">Delivery Partner</p>
                      <p className="text-xs font-semibold text-blue-600 mt-0.5">
                        {shipment.delivery_partner_phone}
                      </p>
                    </div>
                  </div>

                  <a
                    href={`tel:${shipment.delivery_partner_phone}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-100 shadow-sm"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call
                  </a>
                </div>
              </div>

              {/* Right: Status Timeline (Screen #9) */}
              <div className="lg:col-span-5 space-y-5">
                {[
                  {
                    key: 'ORDER_CONFIRMED',
                    title: 'Order Confirmed',
                    fallbackTime: '10:15 AM',
                    done: true,
                  },
                  {
                    key: 'PREPARING_ORDER',
                    title: 'Preparing Your Order',
                    fallbackTime: '10:30 AM',
                    done: ['PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(
                      order.status,
                    ),
                  },
                  {
                    key: 'OUT_FOR_DELIVERY',
                    title: 'Out for Delivery',
                    fallbackTime: '11:45 AM',
                    subtitle: 'Your order is on the way!',
                    done: ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status),
                  },
                  {
                    key: 'DELIVERED',
                    title: 'Delivered',
                    fallbackTime: order.status === 'DELIVERED' ? 'Delivered' : 'Pending',
                    done: order.status === 'DELIVERED',
                  },
                ].map((stepItem, idx) => {
                  const matchedEvent = events.find((e) => e.status === stepItem.key);
                  return (
                    <div key={stepItem.key} className="flex items-start gap-3.5">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            stepItem.done
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        {idx < 3 && (
                          <div
                            className={`w-0.5 h-10 mt-1 ${
                              stepItem.done ? 'bg-emerald-500' : 'bg-slate-200'
                            }`}
                          />
                        )}
                      </div>
                      <div>
                        <p
                          className={`text-sm font-bold ${
                            stepItem.done ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {stepItem.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {matchedEvent
                            ? formatTimeOnly(matchedEvent.event_time)
                            : stepItem.fallbackTime}
                        </p>
                        {(matchedEvent?.description || stepItem.subtitle) && (
                          <p className="text-xs text-slate-600 mt-0.5">
                            {matchedEvent?.description || stepItem.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* If Delivered, 36-Hr Return / Exchange Callout */}
            {order.status === 'DELIVERED' && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-[#E11D48] flex items-center justify-center font-bold">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">
                      36-Hour Easy Doorstep Exchange Active
                    </p>
                    <p className="text-xs text-slate-600">
                      Not the right size or fit? Request a free doorstep exchange with Rajesh Kumar within 36 hours.
                    </p>
                  </div>
                </div>

                <Link
                  to="/orders"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-bold transition-colors shadow-sm"
                >
                  Manage Returns / Exchanges
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      <StorefrontFooter />
    </div>
  );
};

// ============================================================================
// SCREEN #11: WISHLIST PAGE
// ============================================================================
export const WishlistPage: React.FC = () => {
  const { wishlist, toggleWishlist, addToCart } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">
          My Wishlist ({wishlist.length})
        </h1>

        {wishlist.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <p className="font-semibold text-slate-700">Your wishlist is empty.</p>
            <Link
              to="/category/all"
              className="inline-block px-5 py-2.5 rounded-full bg-[#111827] text-white text-xs font-semibold"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {wishlist.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center gap-4 shadow-sm"
              >
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-20 h-20 rounded-xl object-cover bg-slate-100 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        to={`/product/${item.slug}`}
                        className="font-bold text-sm text-slate-900 hover:text-[#E11D48]"
                      >
                        {item.title}
                      </Link>
                      <p className="text-xs text-slate-400">{item.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(item.id)}
                      aria-label="Remove from wishlist"
                      className="text-[#E11D48] p-1"
                    >
                      <Heart className="w-4 h-4 fill-[#E11D48]" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900">
                      {formatNpr(item.base_price_paisa)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        item.default_variant_id &&
                        addToCart(item.default_variant_id, 1)
                      }
                      className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-900 hover:text-white text-xs font-semibold transition-colors"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <StorefrontFooter />
    </div>
  );
};

// ============================================================================
// LOGIN & REGISTRATION PAGE
// ============================================================================
export const LoginPage: React.FC = () => {
  const { loginWithCredentials, showToast } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('john@example.com');
  const [password, setPassword] = useState('CustomerPass123!');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginWithCredentials(email, password);
      navigate('/');
    } catch (err: any) {
      showToast(err.message || 'Sign in failed', 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-slate-900">
              Sign in to Wear Birgunj
            </h1>
            <p className="text-xs text-slate-500">
              Access your Birgunj orders, wishlist, or vendor/admin portal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Email Address
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Password
              </label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#111827] text-white font-semibold text-sm"
            >
              Sign In
            </button>
          </form>
        </div>
      </main>
      <StorefrontFooter />
    </div>
  );
};
