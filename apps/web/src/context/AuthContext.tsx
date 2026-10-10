import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch, getStoredToken, setStoredToken } from '../lib/api';

export interface UserProfile {
  userId: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
  vendorId: string | null;
  vendorSlug: string | null;
  vendorName: string | null;
  vendorApprovalStatus: string | null;
  stepUpVerified?: boolean;
}

interface AuthContextValue {
  user: UserProfile | null;
  addresses: any[];
  notifications: any[];
  cart: {
    items: any[];
    vendorGroups: any[];
    couponCode: string | null;
    summary: {
      subtotalPaisa: number;
      discountPaisa: number;
      shippingPaisa: number;
      taxPaisa: number;
      totalPaisa: number;
      currency: string;
    };
  };
  wishlist: any[];
  loading: boolean;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  loginWithCredentials: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshCart: () => Promise<void>;
  refreshWishlist: () => Promise<void>;
  addToCart: (variantId: string, quantity?: number) => Promise<void>;
  updateCartQty: (variantId: string, quantity: number) => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
}

const emptyCart = {
  items: [],
  vendorGroups: [],
  couponCode: null,
  summary: {
    subtotalPaisa: 0,
    discountPaisa: 0,
    shippingPaisa: 0,
    taxPaisa: 0,
    totalPaisa: 0,
    currency: 'NPR',
  },
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [cart, setCart] = useState(emptyCart);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(
    null,
  );

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 3600);
    },
    [],
  );

  const refreshCart = useCallback(async () => {
    if (!getStoredToken()) {
      setCart(emptyCart);
      return;
    }
    try {
      const data = await apiFetch('/customer/cart');
      setCart(data);
    } catch {
      setCart(emptyCart);
    }
  }, []);

  const refreshWishlist = useCallback(async () => {
    if (!getStoredToken()) {
      setWishlist([]);
      return;
    }
    try {
      const data = await apiFetch('/customer/wishlist');
      setWishlist(data.items || []);
    } catch {
      setWishlist([]);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setAddresses([]);
      setNotifications([]);
      setCart(emptyCart);
      setWishlist([]);
      setLoading(false);
      return;
    }

    try {
      const me = await apiFetch('/auth/me');
      setUser(me.user);
      setAddresses(me.addresses || []);
      setNotifications(me.notifications || []);
      await Promise.all([refreshCart(), refreshWishlist()]);
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshCart, refreshWishlist]);

  useEffect(() => {
    // Auto-login as John Doe on first visit if no token is set so the user can immediately experience all customer features, or switch personas in 1 click
    const init = async () => {
      if (!getStoredToken()) {
        try {
          const res = await apiFetch('/auth/login', {
            method: 'POST',
            body: { email: 'john@example.com', password: 'CustomerPass123!' },
          });
          setStoredToken(res.token);
        } catch {
          // ignore
        }
      }
      await refreshSession();
    };
    init();
  }, [refreshSession]);

  const loginWithCredentials = async (email: string, password: string): Promise<UserProfile> => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setStoredToken(res.token);
    await refreshSession();
    showToast(`Signed in as ${res.user.fullName}`, 'success');
    return {
      userId: res.user.id,
      email: res.user.email,
      fullName: res.user.fullName,
      phone: res.user.phone,
      avatarUrl: res.user.avatarUrl,
      roles: res.user.roles,
      vendorId: res.user.vendorId,
      vendorSlug: res.user.vendorSlug,
      vendorName: res.user.vendorName,
      vendorApprovalStatus: res.user.vendorApprovalStatus,
    };
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setAddresses([]);
    setNotifications([]);
    setCart(emptyCart);
    setWishlist([]);
    showToast('Signed out successfully', 'info');
  };

  const addToCart = async (variantId: string, quantity = 1) => {
    if (!user) {
      showToast('Please sign in to add items to your cart.', 'error');
      return;
    }
    try {
      const updated = await apiFetch('/customer/cart/items', {
        method: 'POST',
        body: { variantId, quantity },
      });
      setCart(updated);
      showToast('Added to your Birgunj cart!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not add item to cart.', 'error');
    }
  };

  const updateCartQty = async (variantId: string, quantity: number) => {
    try {
      const updated = await apiFetch(`/customer/cart/items/${variantId}`, {
        method: 'PATCH',
        body: { quantity },
      });
      setCart(updated);
    } catch (err: any) {
      showToast(err.message || 'Could not update quantity.', 'error');
    }
  };

  const toggleWishlist = async (productId: string) => {
    if (!user) {
      showToast('Please sign in to save items to your wishlist.', 'error');
      return;
    }
    const exists = wishlist.some((w) => w.id === productId);
    try {
      if (exists) {
        const res = await apiFetch(`/customer/wishlist/${productId}`, { method: 'DELETE' });
        setWishlist(res.items || []);
        showToast('Removed from wishlist', 'info');
      } else {
        const res = await apiFetch('/customer/wishlist', {
          method: 'POST',
          body: { productId },
        });
        setWishlist(res.items || []);
        showToast('Saved to your wishlist!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Could not update wishlist.', 'error');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        addresses,
        notifications,
        cart,
        wishlist,
        loading,
        toast,
        showToast,
        loginWithCredentials,
        logout,
        refreshSession,
        refreshCart,
        refreshWishlist,
        addToCart,
        updateCartQty,
        toggleWishlist,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
