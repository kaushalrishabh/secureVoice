import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "../types";

interface AuthStore {
    user: User | null;
    setUser: (user: User) => void;
    clearUser: () => void;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            user: null,
            setUser: (user: User) => set({ user }),
            clearUser: () => set({ user: null }),
        }),
        {
            name: 'sv_user',
            storage: createJSONStorage(() => sessionStorage), // ← this is the fix
            partialize: (state) => ({ user: state.user }),
            onRehydrateStorage: () => (state) => {
                if (state?.user) {
                    const hasToken = !!localStorage.getItem(`sv_token_${state.user.id}`);
                    if (!hasToken) state.user = null;
                }
            },
        },
    ),
)