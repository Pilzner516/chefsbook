import { create } from 'zustand';
import { getUserMenus, getMenu, createMenu, updateMenu, deleteMenu, addMenuItem, removeMenuItem } from '@chefsbook/db';
import type { Menu, MenuWithItems, MenuCourse } from '@chefsbook/db';

interface MenuState {
  menus: Menu[];
  currentMenu: MenuWithItems | null;
  loading: boolean;
  fetchMenus: (userId: string) => Promise<void>;
  fetchMenu: (menuId: string) => Promise<void>;
  addMenu: (userId: string, data: { title: string; description?: string | null; occasion?: string | null; notes?: string | null }) => Promise<Menu>;
  editMenu: (menuId: string, data: { title?: string; description?: string | null; occasion?: string | null; notes?: string | null; is_public?: boolean; cover_image_url?: string | null }) => Promise<void>;
  removeMenu: (menuId: string) => Promise<void>;
  addRecipeToMenu: (menuId: string, recipeId: string, course: MenuCourse, sortOrder: number) => Promise<void>;
  removeRecipeFromMenu: (itemId: string) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  menus: [],
  currentMenu: null,
  loading: false,

  fetchMenus: async (userId) => {
    set({ loading: true });
    try {
      const menus = await getUserMenus(userId);
      set({ menus, loading: false });
    } catch (err) {
      console.error('Failed to fetch menus:', err);
      set({ loading: false });
    }
  },

  fetchMenu: async (menuId) => {
    set({ loading: true });
    try {
      const menu = await getMenu(menuId);
      set({ currentMenu: menu, loading: false });
    } catch (err) {
      console.error('Failed to fetch menu:', err);
      set({ loading: false });
    }
  },

  addMenu: async (userId, data) => {
    const menu = await createMenu({
      user_id: userId,
      title: data.title,
      description: data.description ?? null,
      occasion: data.occasion ?? null,
      notes: data.notes ?? null,
    });
    set((s) => ({ menus: [menu, ...s.menus] }));
    return menu;
  },

  editMenu: async (menuId, data) => {
    const updated = await updateMenu(menuId, data);
    set((s) => ({
      menus: s.menus.map((m) => (m.id === menuId ? updated : m)),
      currentMenu: s.currentMenu?.id === menuId ? { ...s.currentMenu, ...updated } : s.currentMenu,
    }));
  },

  removeMenu: async (menuId) => {
    await deleteMenu(menuId);
    set((s) => ({
      menus: s.menus.filter((m) => m.id !== menuId),
      currentMenu: s.currentMenu?.id === menuId ? null : s.currentMenu,
    }));
  },

  addRecipeToMenu: async (menuId, recipeId, course, sortOrder) => {
    await addMenuItem(menuId, recipeId, course, sortOrder);
    const menu = await getMenu(menuId);
    set({ currentMenu: menu });
  },

  removeRecipeFromMenu: async (itemId) => {
    const currentMenu = get().currentMenu;
    await removeMenuItem(itemId);
    if (currentMenu) {
      const menu = await getMenu(currentMenu.id);
      set({ currentMenu: menu });
    }
  },
}));
