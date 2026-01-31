import { create } from 'zustand';
import type { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  isOpen: boolean;

  // Computed
  totalItems: number;
  totalPrice: number;

  // Actions
  setItems: (items: CartItem[]) => void;
  addItem: (item: CartItem) => void;
  removeItem: (worksheetId: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  isInCart: (worksheetId: string) => boolean;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,

  get totalItems() {
    return get().items.length;
  },

  get totalPrice() {
    return get().items.reduce((sum, item) => sum + (item.worksheet?.price ?? 0), 0);
  },

  setItems: (items) => set({ items }),

  addItem: (item) =>
    set((state) => {
      // Prevent duplicates
      if (state.items.some((i) => i.worksheetId === item.worksheetId)) {
        return state;
      }
      return { items: [...state.items, item] };
    }),

  removeItem: (worksheetId) =>
    set((state) => ({
      items: state.items.filter((i) => i.worksheetId !== worksheetId),
    })),

  clearCart: () => set({ items: [] }),

  openCart: () => set({ isOpen: true }),

  closeCart: () => set({ isOpen: false }),

  toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

  isInCart: (worksheetId) => get().items.some((i) => i.worksheetId === worksheetId),
}));
