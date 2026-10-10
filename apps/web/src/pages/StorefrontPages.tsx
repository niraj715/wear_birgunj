import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Truck,
  RefreshCw,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Heart,
  Minus,
  Plus,
  Store,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { apiFetch, formatNpr, formatShortDate } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ProductCard,
  StarRating,
  StorefrontFooter,
  StorefrontHeader,
} from '../components/DesignSystem';

// ============================================================================
// SCREEN #1: HOMEPAGE (CUSTOMER STOREFRONT)
// ============================================================================
export const HomePage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/catalog/home')
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-10">
        {/* Hero Banner (Screen #1) */}
        <section className="rounded-3xl bg-[#F5EFEA] overflow-hidden border border-stone-200/80 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 p-8 sm:p-12 lg:p-14 space-y-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 text-[#E11D48] text-xs font-semibold shadow-sm">
                Birgunj's #1 Local Fashion & Lifestyle Marketplace
              </span>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#111827] leading-[1.15]">
                Discover Birgunj's Best Fashion & Lifestyle
              </h1>
              <p className="text-slate-600 text-sm sm:text-base max-w-xl leading-relaxed">
                Support local businesses. Shop unique products from verified Birgunj
                stores with fast 2–4 hour delivery across Wards 1 to 32.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  to="/category/all"
                  className="inline-flex items-center gap-2 bg-[#111827] hover:bg-slate-800 text-white font-semibold text-sm px-6 py-3.5 rounded-full shadow-sm transition-all"
                >
                  <span>Shop Now</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/category/women-fashion"
                  className="inline-flex items-center gap-2 bg-white hover:bg-stone-50 text-[#111827] font-semibold text-sm px-5 py-3.5 rounded-full border border-stone-300 transition-all"
                >
                  Explore Women Fashion
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 h-72 sm:h-96 lg:h-[420px] relative">
              <img
                src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&auto=format&fit=crop&q=80"
                alt="Birgunj Fashion & Lifestyle"
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>
        </section>

        {/* 4-Pillar Trust Bar (Screen #1) */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900">Fast Delivery</p>
              <p className="text-xs text-slate-500">2–4 Hours in Birgunj</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900">Easy Exchange</p>
              <p className="text-xs text-slate-500">Within 36 Hours</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900">100% Genuine</p>
              <p className="text-xs text-slate-500">Verified Local Vendors</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900">Secure Payments</p>
              <p className="text-xs text-slate-500">eSewa, Khalti, COD</p>
            </div>
          </div>
        </section>

        {/* Shop by Category Row (Screen #1) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Shop by Category</h2>
            <Link
              to="/category/all"
              className="text-xs font-semibold text-slate-600 hover:text-[#E11D48] inline-flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
            {(data?.categories || []).map((cat: any) => (
              <Link
                key={cat.id}
                to={`/category/${cat.slug}`}
                className="group bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col items-center text-center hover:border-slate-400 hover:shadow-sm transition-all"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 mb-2.5">
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                  />
                </div>
                <span className="text-xs font-semibold text-slate-800 group-hover:text-[#E11D48]">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Products Grid (Screen #1) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Featured Products</h2>
              <p className="text-xs text-slate-500">
                Top-rated picks from approved Birgunj storefronts
              </p>
            </div>
            <Link
              to="/category/all"
              className="text-xs font-semibold text-slate-700 hover:text-[#E11D48] inline-flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-72 rounded-2xl bg-slate-200/70 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {(data?.featuredProducts || []).map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* New Arrivals in Birgunj */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Trending in Birgunj Today
              </h2>
              <p className="text-xs text-slate-500">
                Ready for 2–4 hour local dispatch
              </p>
            </div>
            <Link
              to="/category/women-fashion"
              className="text-xs font-semibold text-slate-700 hover:text-[#E11D48] inline-flex items-center gap-1"
            >
              Browse Women Fashion <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {(data?.newArrivals || []).slice(4, 8).map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        {/* Shop by Local Brands & Approved Vendors Strip (Screen #1) */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            Shop by Brands & Approved Birgunj Vendors
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {['NIKE', 'ADIDAS', 'PUMA', 'ZARA', "LEVI'S", 'H&M'].map((brand) => (
              <Link
                key={brand}
                to={`/category/all?q=${encodeURIComponent(brand)}`}
                className="bg-white rounded-xl border border-slate-200 py-4 px-5 flex items-center justify-center font-black tracking-widest text-sm text-slate-800 hover:border-slate-900 transition-colors"
              >
                {brand}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {(data?.vendors || []).map((v: any) => (
              <Link
                key={v.id}
                to={`/store/${v.slug}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-all"
              >
                <img
                  src={
                    v.logo_url ||
                    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&auto=format&fit=crop&q=80'
                  }
                  alt={v.business_name}
                  className="w-16 h-16 rounded-2xl object-cover bg-slate-100 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 truncate">
                      {v.business_name}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Verified Ward {v.ward_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                    {v.description}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-600">
                    <StarRating rating={Number(v.rating_avg)} count={v.rating_count} />
                    <span>• {v.address_text}</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      </main>

      <StorefrontFooter />
    </div>
  );
};

// ============================================================================
// SCREEN #2 & #12: CATEGORY LISTING & SEARCH RESULTS PAGE
// ============================================================================
export const CategoryListingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const selectedCategory = slug || searchParams.get('category') || 'all';
  const q = searchParams.get('q') || '';
  const selectedBrand = searchParams.get('brand') || '';
  const maxPriceRupees = Number(searchParams.get('maxPrice') || 10000);
  const minRating = Number(searchParams.get('minRating') || 0);
  const inStockOnly = searchParams.get('inStock') === 'true';
  const sort = searchParams.get('sort') || 'popularity';

  useEffect(() => {
    apiFetch('/catalog/categories').then((res) => setCategories(res.items || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory && selectedCategory !== 'all') {
      params.set('category', selectedCategory);
    }
    if (q) params.set('q', q);
    if (selectedBrand) params.set('brand', selectedBrand);
    if (maxPriceRupees < 10000) params.set('maxPricePaisa', String(maxPriceRupees * 100));
    if (minRating > 0) params.set('minRating', String(minRating));
    if (inStockOnly) params.set('inStockOnly', 'true');
    if (sort) params.set('sort', sort);
    params.set('pageSize', '24');

    apiFetch(`/catalog/products?${params.toString()}`)
      .then((res) => {
        setProducts(res.items || []);
        setTotal(res.pagination?.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [selectedCategory, q, selectedBrand, maxPriceRupees, minRating, inStockOnly, sort]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  const activeCategoryObj = categories.find((c) => c.slug === selectedCategory);
  const pageTitle = q
    ? `Search results for "${q}"`
    : activeCategoryObj
      ? activeCategoryObj.name
      : 'All Fashion & Lifestyle';

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Filter Sidebar (Screen #2) */}
          <aside className="lg:col-span-3 space-y-6 bg-white p-5 rounded-2xl border border-slate-200/80 h-fit">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#E11D48]" />
                Filters
              </h2>
              <Link
                to="/category/all"
                className="text-xs text-[#E11D48] hover:underline font-medium"
              >
                Reset
              </Link>
            </div>

            {/* Categories Filter */}
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 mb-2.5">
                Categories
              </h3>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <Link
                    to="/category/all"
                    className={`block px-2.5 py-1.5 rounded-lg ${
                      selectedCategory === 'all'
                        ? 'bg-rose-50 text-[#E11D48] font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All Categories
                  </Link>
                </li>
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/category/${c.slug}`}
                      className={`block px-2.5 py-1.5 rounded-lg ${
                        selectedCategory === c.slug
                          ? 'bg-rose-50 text-[#E11D48] font-semibold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Price Range Slider (Rs. 0 - Rs. 10,000) */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 mb-2">
                Price Range
              </h3>
              <input
                type="range"
                min={500}
                max={10000}
                step={500}
                value={maxPriceRupees}
                onChange={(e) => updateFilter('maxPrice', e.target.value)}
                aria-label="Maximum price in NPR"
                className="w-full accent-[#111827]"
              />
              <div className="flex justify-between text-xs font-medium text-slate-600 mt-1">
                <span>Rs. 0</span>
                <span>Rs. {maxPriceRupees.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Brands Filter */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 mb-2.5">
                Brands
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  { slug: '', label: 'All Brands' },
                  { slug: 'nike', label: 'Nike' },
                  { slug: 'zara', label: 'Zara' },
                  { slug: 'levis', label: "Levi's" },
                  { slug: 'hm', label: 'H&M' },
                  { slug: 'casio', label: 'Casio' },
                  { slug: 'ray-ban', label: 'Ray-Ban' },
                  { slug: 'birgunj-looms', label: 'Birgunj Artisans (Local)' },
                ].map((b) => (
                  <label key={b.label} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="brandFilter"
                      checked={selectedBrand === b.slug}
                      onChange={() => updateFilter('brand', b.slug)}
                      className="accent-[#111827]"
                    />
                    <span className="text-xs text-slate-700">{b.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Ratings Filter */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 mb-2.5">
                Minimum Rating
              </h3>
              <div className="space-y-2">
                {[4, 3, 0].map((r) => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="ratingFilter"
                      checked={minRating === r}
                      onChange={() => updateFilter('minRating', r ? String(r) : '')}
                      className="accent-[#111827]"
                    />
                    <span>{r > 0 ? `${r}★ & above` : 'Any rating'}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Availability Filter */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500 mb-2.5">
                Availability
              </h3>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) =>
                    updateFilter('inStock', e.target.checked ? 'true' : '')
                  }
                  className="accent-[#111827] rounded"
                />
                <span>In Stock in Birgunj</span>
              </label>
            </div>
          </aside>

          {/* Main Product Listing Grid (Screen #2) */}
          <div className="lg:col-span-9 space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {total} authentic product{total === 1 ? '' : 's'} found
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <label htmlFor="sortSelect" className="text-slate-500 font-medium">
                  Sort by:
                </label>
                <select
                  id="sortSelect"
                  value={sort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 font-semibold text-slate-800 bg-slate-50"
                >
                  <option value="popularity">Popularity</option>
                  <option value="newest">Newest Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-72 rounded-2xl bg-slate-200/70 animate-pulse"
                  />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                <p className="text-base font-semibold text-slate-800">
                  No products match your selected filters.
                </p>
                <p className="text-xs text-slate-500">
                  Try widening your price range or clearing active brand filters.
                </p>
                <Link
                  to="/category/all"
                  className="inline-block mt-2 px-5 py-2.5 rounded-full bg-[#111827] text-white text-xs font-semibold"
                >
                  Reset All Filters
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
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
// SCREEN #3 & SCREEN #10: PRODUCT DETAILS PAGE & VERIFIED REVIEWS
// ============================================================================
export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addToCart, wishlist, toggleWishlist, showToast } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews' | 'shipping'>(
    'description',
  );

  // Write a Review Modal / Form State (Screen #10)
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadProduct = () => {
    if (!slug) return;
    setLoading(true);
    apiFetch(`/catalog/products/${slug}`)
      .then((res) => {
        setData(res);
        setSelectedImageIdx(0);
        if (res.product?.variants?.length > 0) {
          setSelectedVariantId(res.product.variants[0].id);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProduct();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <StorefrontHeader />
        <div className="max-w-7xl mx-auto px-4 py-12 w-full">
          <div className="h-96 rounded-3xl bg-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data?.product) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        <StorefrontHeader />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Product Not Available
          </h1>
          <p className="text-sm text-slate-500">
            This product does not exist or is awaiting catalog moderation.
          </p>
          <Link
            to="/category/all"
            className="inline-block px-6 py-3 rounded-full bg-[#111827] text-white text-xs font-semibold"
          >
            Back to Catalog
          </Link>
        </div>
        <StorefrontFooter />
      </div>
    );
  }

  const { product, reviews, ratingDistribution, relatedProducts } = data;
  const variants: any[] = product.variants || [];
  const activeVariant =
    variants.find((v) => v.id === selectedVariantId) || variants[0] || {};
  const mediaList =
    product.media?.length > 0
      ? product.media
      : [{ url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&auto=format&fit=crop&q=80', alt_text: product.title }];

  const isSaved = wishlist.some((w) => w.id === product.id);
  const pricePaisa = activeVariant.price_paisa ?? product.base_price_paisa;
  const comparePaisa =
    activeVariant.compare_at_price_paisa ?? product.compare_at_price_paisa;
  const discountPct =
    comparePaisa && comparePaisa > pricePaisa
      ? Math.round(((comparePaisa - pricePaisa) / comparePaisa) * 100)
      : 0;

  const handleBuyNow = async () => {
    if (!activeVariant?.id) return;
    await addToCart(activeVariant.id, quantity);
    navigate('/checkout');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await apiFetch('/customer/reviews', {
        method: 'POST',
        body: {
          productId: product.id,
          rating: reviewRating,
          comment: reviewComment,
        },
      });
      showToast('Verified review published! Thank you.', 'success');
      setShowReviewForm(false);
      setReviewComment('');
      loadProduct();
    } catch (err: any) {
      showToast(err.message || 'Could not submit review.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-12">
        {/* Product Gallery + Purchase Box (Screen #3) */}
        <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Vertical Thumbnails + Main Image */}
          <div className="lg:col-span-7 flex flex-col-reverse sm:flex-row gap-4">
            <div className="flex sm:flex-col gap-3 overflow-x-auto">
              {mediaList.map((m: any, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 shrink-0 ${
                    selectedImageIdx === idx
                      ? 'border-[#111827]'
                      : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={m.url}
                    alt={m.alt_text}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            <div className="relative flex-1 aspect-square rounded-2xl bg-[#F5F5F4] overflow-hidden">
              <img
                src={mediaList[selectedImageIdx]?.url}
                alt={product.title}
                className="w-full h-full object-cover"
              />
              {product.is_new && (
                <span className="absolute top-4 left-4 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  New
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label="Save to wishlist"
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white shadow flex items-center justify-center"
              >
                <Heart
                  className={`w-5 h-5 ${
                    isSaved ? 'fill-[#E11D48] text-[#E11D48]' : 'text-slate-700'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Right: Variant Selectors, Pricing & Birgunj Trust Highlights */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {product.brand_name || product.category_name}
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] mt-1">
                  {product.title}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <StarRating
                  rating={product.rating_avg}
                  count={product.review_count}
                  size="md"
                />
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  {activeVariant.available_qty > 0
                    ? `${activeVariant.available_qty} in stock in Birgunj`
                    : 'Out of Stock'}
                </span>
              </div>

              {/* Price Row */}
              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-3xl font-extrabold text-[#111827]">
                  {formatNpr(pricePaisa)}
                </span>
                {comparePaisa && comparePaisa > pricePaisa && (
                  <>
                    <span className="text-base text-slate-400 line-through">
                      {formatNpr(comparePaisa)}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-rose-50 text-[#E11D48] text-xs font-bold">
                      {discountPct}% OFF
                    </span>
                  </>
                )}
              </div>

              {/* Variant Selector Buttons (Size & Color) */}
              {variants.length > 0 && (
                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Select Size / Variant
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                          selectedVariantId === v.id
                            ? 'border-[#111827] bg-[#111827] text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-slate-300"
                          style={{ backgroundColor: v.color_hex || '#111827' }}
                        />
                        <span>{v.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Stepper */}
              <div className="flex items-center gap-4 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Quantity
                </span>
                <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="p-2.5 text-slate-600 hover:text-slate-900"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-4 text-sm font-bold text-slate-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) =>
                        Math.min(activeVariant.available_qty || 10, q + 1),
                      )
                    }
                    aria-label="Increase quantity"
                    className="p-2.5 text-slate-600 hover:text-slate-900"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Action CTA Buttons (Screen #3) */}
              <div className="space-y-2.5 pt-3">
                <button
                  type="button"
                  disabled={!activeVariant?.available_qty}
                  onClick={() => addToCart(activeVariant.id, quantity)}
                  className="w-full py-3.5 rounded-xl bg-[#111827] hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold text-sm shadow-sm transition-colors"
                >
                  {activeVariant?.available_qty > 0 ? 'Add to Cart' : 'Out of Stock'}
                </button>
                <button
                  type="button"
                  disabled={!activeVariant?.available_qty}
                  onClick={handleBuyNow}
                  className="w-full py-3.5 rounded-xl bg-white hover:bg-slate-50 text-[#111827] font-semibold text-sm border border-slate-300 transition-colors"
                >
                  Buy Now
                </button>
              </div>
            </div>

            {/* 4 Birgunj Trust Highlights & Vendor Link (Screen #3) */}
            <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-slate-800 shrink-0" />
                <span>
                  <strong className="text-slate-900">Fast Delivery</strong> within
                  2–4 hours (Birgunj)
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-slate-800 shrink-0" />
                <span>
                  <strong className="text-slate-900">Easy Exchange</strong> within
                  36 hours
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong className="text-slate-900">100% Original Products</strong>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Store className="w-4 h-4 text-[#E11D48] shrink-0" />
                <span>
                  Sold by{' '}
                  <Link
                    to={`/store/${product.vendor_slug}`}
                    className="font-bold text-slate-900 underline hover:text-[#E11D48]"
                  >
                    {product.vendor_name}
                  </Link>{' '}
                  (Ward {product.vendor_ward}, Birgunj)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Product Details Tabs & Screen #10 Customer Reviews */}
        <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-6 border-b border-slate-200 text-sm font-semibold overflow-x-auto">
            {[
              { id: 'description', label: 'Description' },
              { id: 'specs', label: 'Specifications' },
              { id: 'reviews', label: `Reviews (${reviews?.length || 0})` },
              { id: 'shipping', label: 'Shipping & 36-Hr Exchange' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`pb-3 border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? 'border-[#111827] text-[#111827]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'description' && (
            <div className="prose max-w-3xl text-sm text-slate-600 leading-relaxed space-y-3">
              <p>{product.description}</p>
              <p className="text-xs text-slate-500">
                SKU: <span className="font-mono">{activeVariant.sku}</span> • Verified
                by {product.vendor_name}
              </p>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
              {Object.entries(product.specifications || {}).map(([k, v]) => (
                <div
                  key={k}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex justify-between text-xs"
                >
                  <span className="font-semibold text-slate-500">{k}</span>
                  <span className="font-bold text-slate-900">{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="max-w-3xl space-y-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">
                {product.vendor_shipping_policy}
              </p>
              <p>{product.vendor_return_policy}</p>
            </div>
          )}

          {/* Always render Customer Reviews Summary below or when Reviews tab is active (Screen #10) */}
          <div className="pt-4 border-t border-slate-100 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">
                Customer Reviews
              </h2>
              <button
                type="button"
                onClick={() => setShowReviewForm((prev) => !prev)}
                className="px-5 py-2.5 rounded-xl bg-[#111827] hover:bg-slate-800 text-white text-xs font-semibold"
              >
                Write a Review
              </button>
            </div>

            {/* Rating Distribution Summary (Screen #10) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-slate-50 p-6 rounded-2xl border border-slate-200/70">
              <div className="md:col-span-4 text-center md:text-left space-y-1">
                <div className="text-4xl font-extrabold text-slate-900">
                  {Number(product.rating_avg || 4.8).toFixed(1)}
                </div>
                <StarRating rating={product.rating_avg} size="md" />
                <p className="text-xs text-slate-500">
                  Based on {product.review_count || reviews?.length || 0} verified reviews
                </p>
              </div>

              <div className="md:col-span-8 space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = Number(ratingDistribution?.[star] ?? 0);
                  const totalRev = Math.max(1, reviews?.length || 1);
                  const pct = star === 5 && count > 0 ? Math.max(75, Math.round((count / totalRev) * 100)) : Math.round((count / totalRev) * 100);
                  return (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <span className="w-8 font-semibold text-slate-700">
                        {star} ★
                      </span>
                      <div className="flex-1 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-slate-500">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Verified Review Submission Form */}
            {showReviewForm && (
              <form
                onSubmit={handleSubmitReview}
                className="p-5 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-4"
              >
                <h3 className="font-bold text-sm text-slate-900">
                  Submit a Verified Purchase Review
                </h3>
                <p className="text-xs text-slate-500">
                  Note: Server enforces that only customers with a DELIVERED order item for this product can publish a review.
                </p>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-slate-700">Rating:</label>
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white"
                  >
                    <option value={5}>5 Stars — Excellent</option>
                    <option value={4}>4 Stars — Good</option>
                    <option value={3}>3 Stars — Average</option>
                    <option value={2}>2 Stars — Poor</option>
                    <option value={1}>1 Star — Terrible</option>
                  </select>
                </div>
                <textarea
                  required
                  minLength={5}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience with product quality, fit, and Birgunj delivery..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm bg-white"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-5 py-2 rounded-xl bg-[#111827] text-white text-xs font-semibold"
                  >
                    {submittingReview ? 'Submitting...' : 'Publish Verified Review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Review Cards List (Screen #10) */}
            <div className="divide-y divide-slate-100">
              {(reviews || []).map((rev: any) => (
                <div key={rev.id} className="py-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          rev.customer_avatar ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
                        }
                        alt={rev.customer_name}
                        className="w-10 h-10 rounded-full object-cover bg-slate-200"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {rev.customer_name}
                          </span>
                          {rev.is_verified_purchase && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Verified Purchase
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {formatShortDate(rev.created_at)}
                        </p>
                      </div>
                    </div>
                    <StarRating rating={rev.rating} />
                  </div>
                  <p className="text-sm text-slate-700">{rev.comment}</p>
                  {rev.mediaUrls?.length > 0 && (
                    <div className="flex gap-2 pt-1">
                      {rev.mediaUrls.map((url: string, i: number) => (
                        <img
                          key={i}
                          src={url}
                          alt="Customer review attachment"
                          className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* You May Also Like (Screen #3) */}
        {relatedProducts?.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">You May Also Like</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {relatedProducts.map((p: any) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <StorefrontFooter />
    </div>
  );
};

// ============================================================================
// PUBLIC VENDOR STOREFRONT PAGE
// ============================================================================
export const VendorStorefrontPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    apiFetch(`/catalog/vendors/${slug}`)
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <StorefrontHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {loading ? (
          <div className="h-64 rounded-3xl bg-slate-200 animate-pulse" />
        ) : !data?.vendor ? (
          <div className="bg-white p-12 rounded-2xl text-center">
            <h1 className="text-xl font-bold">Vendor Storefront Not Found</h1>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="h-44 bg-slate-900 relative">
                {data.vendor.banner_url && (
                  <img
                    src={data.vendor.banner_url}
                    alt={data.vendor.business_name}
                    className="w-full h-full object-cover opacity-70"
                  />
                )}
              </div>
              <div className="p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={
                      data.vendor.logo_url ||
                      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&auto=format&fit=crop&q=80'
                    }
                    alt={data.vendor.business_name}
                    className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow -mt-12 bg-white"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-slate-900">
                        {data.vendor.business_name}
                      </h1>
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Approved Birgunj Merchant
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {data.vendor.address_text} (Ward {data.vendor.ward_number})
                    </p>
                  </div>
                </div>
                <StarRating
                  rating={data.vendor.rating_avg}
                  count={data.vendor.rating_count}
                  size="md"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {(data.products || []).map((p: any) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </main>
      <StorefrontFooter />
    </div>
  );
};
