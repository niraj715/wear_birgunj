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
  const [activeSection, setActiveSection] = useState<'profile' | 'addresses' | 'notifications'>(
    'profile',
  );
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [newWard, setNewWard] = useState(10);
  const [newStreet, setNewStreet] = useState('');
  const [newLandmark, setNewLandmark] = useState('');

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
// SCREEN #8: ORDER HISTORY PAGE
// ============================================================================
export const OrderHistoryPage: React.FC = () => {
  const { showToast } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

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

  const handleRequestExchange = async (orderItemId: string) => {
    try {
      await apiFetch('/customer/returns', {
        method: 'POST',
        body: {
          orderItemId,
          requestType: 'EXCHANGE',
          reason: '36-Hour Easy Size Exchange requested from Order History',
        },
      });
      showToast('36-Hour Easy Exchange request submitted!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

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
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4"
              >
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

                  {order.status === 'DELIVERED' && order.items?.[0] && (
                    <button
                      type="button"
                      onClick={() => handleRequestExchange(order.items[0].id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      36-Hr Exchange
                    </button>
                  )}

                  <Link
                    to={`/orders/${order.id}/track`}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                    title="Track Order"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

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
