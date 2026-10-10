import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import {
  HomePage,
  CategoryListingPage,
  ProductDetailPage,
  VendorStorefrontPage,
} from './pages/StorefrontPages';
import {
  CartPage,
  CheckoutPage,
  OrderConfirmationPage,
  AccountProfilePage,
  OrderHistoryPage,
  OrderTrackingPage,
  WishlistPage,
  LoginPage,
} from './pages/CustomerFlowPages';
import { VendorPortalPage, AdminPortalPage } from './pages/PortalPages';
import { StorefrontHeader, StorefrontFooter } from './components/DesignSystem';

const NotFoundPage: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
    <StorefrontHeader />
    <main className="flex-1 max-w-xl mx-auto px-4 py-20 text-center space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#E11D48]">
        Error 404
      </p>
      <h1 className="text-3xl font-bold text-slate-900">Page Not Found</h1>
      <p className="text-sm text-slate-500">
        The page you are looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="inline-block px-6 py-3 rounded-full bg-[#111827] text-white text-xs font-semibold"
      >
        Return to Wear Birgunj Home
      </Link>
    </main>
    <StorefrontFooter />
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/category/:slug" element={<CategoryListingPage />} />
          <Route path="/search" element={<CategoryListingPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/store/:slug" element={<VendorStorefrontPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route
            path="/order-confirmation/:id"
            element={<OrderConfirmationPage />}
          />
          <Route path="/account" element={<AccountProfilePage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/orders/:id/track" element={<OrderTrackingPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/vendor" element={<VendorPortalPage />} />
          <Route path="/admin" element={<AdminPortalPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};
