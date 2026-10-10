import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Heart,
  Search,
  ShoppingBag,
  User,
  Star,
  X,
  ShieldCheck,
  Store,
  LayoutDashboard,
  ChevronRight,
  Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatNpr } from '../lib/api';

export const WearBirgunjLogo: React.FC<{
  dark?: boolean;
  subtitle?: string;
}> = ({ dark = false, subtitle }) => (
  <Link to="/" className="inline-flex items-center gap-2.5 group">
    <div className="w-8 h-8 rounded-full bg-[#E11D48]/10 flex items-center justify-center">
      <Heart className="w-5 h-5 text-[#E11D48] fill-[#E11D48] transition-transform group-hover:scale-110" />
    </div>
    <div className="flex flex-col leading-none">
      <span
        className={`font-bold text-lg tracking-tight ${
          dark ? 'text-white' : 'text-[#111827]'
        }`}
      >
        Wear Birgunj
      </span>
      {subtitle && (
        <span className="text-[11px] font-medium text-slate-400 mt-0.5">
          {subtitle}
        </span>
      )}
    </div>
  </Link>
);

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const normalized = (status || '').toUpperCase();
  let classes = 'bg-slate-100 text-slate-700';
  let label = status;

  if (['ACTIVE', 'DELIVERED', 'APPROVED', 'PAID', 'CAPTURED', 'VERIFIED'].includes(normalized)) {
    classes = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    label = normalized === 'ACTIVE' ? 'Active' : normalized === 'DELIVERED' ? 'Delivered' : status;
  } else if (['OUT_FOR_DELIVERY', 'SHIPPED'].includes(normalized)) {
    classes = 'bg-blue-100 text-blue-800 border border-blue-200';
    label = 'Out for Delivery';
  } else if (['NEW', 'INITIATED'].includes(normalized)) {
    classes = 'bg-sky-100 text-sky-800 border border-sky-200';
    label = 'New';
  } else if (
    ['PROCESSING', 'PENDING', 'PENDING_APPROVAL', 'PENDING_VERIFICATION', 'PENDING_COD', 'PREPARING', 'REQUESTED'].includes(
      normalized,
    )
  ) {
    classes = 'bg-amber-100 text-amber-800 border border-amber-200';
    label =
      normalized === 'PENDING_APPROVAL'
        ? 'Pending'
        : normalized === 'PROCESSING'
          ? 'Processing'
          : status;
  } else if (['CANCELLED', 'REJECTED', 'FAILED', 'SUSPENDED'].includes(normalized)) {
    classes = 'bg-rose-100 text-rose-800 border border-rose-200';
    label =
      normalized === 'CANCELLED'
        ? 'Cancelled'
        : normalized === 'REJECTED'
          ? 'Rejected'
          : status;
  } else if (normalized === 'DRAFT') {
    classes = 'bg-slate-100 text-slate-600 border border-slate-200';
    label = 'Draft';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
};

export const StarRating: React.FC<{
  rating: number;
  count?: number;
  size?: 'sm' | 'md';
}> = ({ rating, count, size = 'sm' }) => {
  const num = Number(rating || 4.8);
  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex items-center text-amber-400">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${
              i <= Math.round(num) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-slate-700">{num.toFixed(1)}</span>
      {typeof count === 'number' && (
        <span className="text-xs text-slate-400">({count})</span>
      )}
    </div>
  );
};

export const ProductCard: React.FC<{ product: any }> = ({ product }) => {
  const { wishlist, toggleWishlist } = useAuth();
  const isSaved = wishlist.some((w) => w.id === product.id);

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
      <div className="relative aspect-[4/3] bg-[#F5F5F4] overflow-hidden">
        <Link to={`/product/${product.slug}`} className="block w-full h-full">
          <img
            src={
              product.image_url ||
              'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80'
            }
            alt={product.title}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </Link>
        {product.is_new && (
          <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
            New
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-label={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-white transition-colors"
        >
          <Heart
            className={`w-4 h-4 ${
              isSaved ? 'fill-[#E11D48] text-[#E11D48]' : 'text-slate-600'
            }`}
          />
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium mb-0.5">
            {product.brand_name || product.subtitle || product.category_name || 'Wear Birgunj'}
          </p>
          <Link
            to={`/product/${product.slug}`}
            className="font-semibold text-sm text-[#111827] hover:text-[#E11D48] line-clamp-1 transition-colors"
          >
            {product.title}
          </Link>
          <div className="mt-1.5">
            <StarRating rating={product.rating_avg} count={product.review_count} />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base text-[#111827]">
              {formatNpr(product.base_price_paisa)}
            </span>
            {product.compare_at_price_paisa &&
              product.compare_at_price_paisa > product.base_price_paisa && (
                <span className="text-xs text-slate-400 line-through">
                  {formatNpr(product.compare_at_price_paisa)}
                </span>
              )}
          </div>
          {product.vendor_name && (
            <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
              {product.vendor_name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const RoleSwitcherBar: React.FC = () => {
  const { user, loginWithCredentials, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleQuickSwitch = async (
    email: string,
    pass: string,
    targetPath: string,
  ) => {
    await loginWithCredentials(email, pass);
    navigate(targetPath);
  };

  return (
    <div className="bg-[#0F172A] text-slate-300 text-xs border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Birgunj Live Marketplace
          </span>
          <span className="text-slate-600">|</span>
          <span className="hidden sm:inline text-slate-400">
            Fast 2–4 Hr Delivery across Wards 1–32 • 36-Hr Easy Exchange
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 mr-1">Switch View / Persona:</span>
          <button
            type="button"
            onClick={() =>
              handleQuickSwitch('john@example.com', 'CustomerPass123!', '/')
            }
            className={`px-2.5 py-0.5 rounded-md font-medium transition-colors ${
              user?.email === 'john@example.com' && !location.pathname.startsWith('/vendor') && !location.pathname.startsWith('/admin')
                ? 'bg-[#E11D48] text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            Customer (John Doe)
          </button>

          <button
            type="button"
            onClick={() =>
              handleQuickSwitch('vendor@fashionhub.np', 'VendorPass123!', '/vendor')
            }
            className={`px-2.5 py-0.5 rounded-md font-medium inline-flex items-center gap-1 transition-colors ${
              location.pathname.startsWith('/vendor')
                ? 'bg-[#E11D48] text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Store className="w-3 h-3" />
            Vendor Portal (Fashion Hub)
          </button>

          <button
            type="button"
            onClick={() =>
              handleQuickSwitch('admin@wearbirgunj.np', 'AdminPass123!', '/admin')
            }
            className={`px-2.5 py-0.5 rounded-md font-medium inline-flex items-center gap-1 transition-colors ${
              location.pathname.startsWith('/admin')
                ? 'bg-[#E11D48] text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3 h-3" />
            Admin Panel
          </button>

          {user && (
            <button
              type="button"
              onClick={() => logout()}
              className="px-2 py-0.5 rounded-md bg-slate-800/60 hover:bg-rose-950/60 text-slate-400 hover:text-rose-200"
            >
              Guest Mode
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const StorefrontHeader: React.FC = () => {
  const { user, cart, wishlist, toast } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/catalog/products?q=${encodeURIComponent(searchQuery.trim())}&pageSize=5`,
        );
        setSearchResults(res.items || []);
      } catch {
        setSearchResults([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const cartCount = cart.items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);

  const navCategories = [
    { label: 'All Categories', to: '/category/all' },
    { label: 'Women', to: '/category/women-fashion' },
    { label: 'Men', to: '/category/men-fashion' },
    { label: 'Shoes', to: '/category/shoes' },
    { label: 'Kids', to: '/category/kids' },
    { label: 'Accessories', to: '/category/accessories' },
    { label: 'Bags', to: '/category/bags' },
    { label: 'Home & Living', to: '/category/home-living' },
    { label: 'Electronics', to: '/category/electronics' },
    { label: 'Local Brands', to: '/category/all?brand=birgunj-looms' },
    { label: 'Deals', to: '/category/all?sort=price_asc', highlight: true },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-sm">
      <RoleSwitcherBar />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#111827] text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-sm font-medium">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-400'
            }`}
          />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <WearBirgunjLogo />

        {/* Instant Search Bar (Screen #1 & Screen #12) */}
        <div className="relative flex-1 max-w-xl">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search in Wear Birgunj (e.g. Nike, Kurti, Watch)..."
              aria-label="Search in Wear Birgunj"
              className="w-full pl-10 pr-9 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white rounded-full text-sm border border-transparent focus:border-slate-300 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Instant Search Dropdown (Screen #12) */}
          {searchOpen && searchQuery.trim().length > 0 && (
            <div
              onMouseLeave={() => setSearchOpen(false)}
              className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50"
            >
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  No matching products found for "{searchQuery}"
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {searchResults.map((item) => (
                    <Link
                      key={item.id}
                      to={`/product/${item.slug}`}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors"
                    >
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500">{item.category_name}</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">
                          {formatNpr(item.base_price_paisa)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </Link>
                  ))}
                  <Link
                    to={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                    onClick={() => setSearchOpen(false)}
                    className="block p-3 text-center text-xs font-semibold text-blue-600 hover:bg-blue-50/50"
                  >
                    View all results for "{searchQuery}" →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            to="/wishlist"
            className="relative p-2 text-slate-700 hover:text-[#E11D48] transition-colors"
            title="My Wishlist"
          >
            <Heart className="w-5 h-5" />
            {wishlist.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#E11D48] text-white text-[10px] font-bold flex items-center justify-center">
                {wishlist.length}
              </span>
            )}
          </Link>

          <Link
            to={user ? '/account' : '/login'}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-[#111827]"
          >
            <User className="w-5 h-5" />
            <span className="hidden md:inline">
              {user ? user.fullName.split(' ')[0] : 'Sign In'}
            </span>
          </Link>

          <Link
            to="/cart"
            className="relative p-2 text-slate-700 hover:text-[#111827] transition-colors"
            title="Your Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#E11D48] text-white text-[10px] font-bold flex items-center justify-center">
              {cartCount}
            </span>
          </Link>
        </div>
      </div>

      {/* Category Sub-Navigation Bar */}
      <nav
        aria-label="Product categories"
        className="border-t border-slate-100 bg-white overflow-x-auto"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-10 flex items-center gap-6 text-xs font-medium whitespace-nowrap">
          {navCategories.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className={
                c.highlight
                  ? 'text-[#E11D48] font-bold hover:underline'
                  : 'text-slate-600 hover:text-[#111827] transition-colors'
              }
            >
              {c.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
};

export const StorefrontFooter: React.FC = () => (
  <footer className="bg-white border-t border-slate-200 mt-16">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
      <div>
        <WearBirgunjLogo />
        <p className="mt-3 text-xs text-slate-500 leading-relaxed">
          Birgunj's trusted multivendor fashion & lifestyle marketplace. Connecting
          verified local merchants across Wards 1–32 with 2–4 hour express delivery.
        </p>
      </div>
      <div>
        <h3 className="font-semibold text-slate-900 mb-3">Shop Categories</h3>
        <ul className="space-y-2 text-xs text-slate-600">
          <li><Link to="/category/women-fashion" className="hover:text-slate-900">Women Fashion</Link></li>
          <li><Link to="/category/men-fashion" className="hover:text-slate-900">Men Fashion</Link></li>
          <li><Link to="/category/shoes" className="hover:text-slate-900">Shoes & Sneakers</Link></li>
          <li><Link to="/category/accessories" className="hover:text-slate-900">Watches & Sunglasses</Link></li>
        </ul>
      </div>
      <div>
        <h3 className="font-semibold text-slate-900 mb-3">Customer Care & Policies</h3>
        <ul className="space-y-2 text-xs text-slate-600">
          <li><Link to="/orders" className="hover:text-slate-900">Track Order (#WB123456)</Link></li>
          <li><Link to="/account" className="hover:text-slate-900">36-Hour Easy Exchange Policy</Link></li>
          <li><Link to="/vendor" className="hover:text-slate-900">Sell on Wear Birgunj (Vendor Portal)</Link></li>
          <li><Link to="/admin" className="hover:text-slate-900">Platform Governance & Admin</Link></li>
        </ul>
      </div>
      <div>
        <h3 className="font-semibold text-slate-900 mb-3">Verified Payments & Trust</h3>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            eSewa Verified
          </span>
          <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
            Khalti Wallet
          </span>
          <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
            Cash on Delivery (Birgunj)
          </span>
        </div>
        <p className="mt-3 text-[11px] text-slate-400 flex items-center gap-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          100% Genuine Local Vendors • PAN/VAT Verified
        </p>
      </div>
    </div>
  </footer>
);
