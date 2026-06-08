import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

interface AuthStore {
    user: User | null,
    setUser: (user: User) => void,
    clearUser: () => void,

    // if both the JWT token and user object are present.
    // isAuthenticated: boolean
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            user: null,
            // isAuthenticated: false,
            // to set user auth
            setUser: (user: User) => set({ user, 
                // isAuthenticated: true 
            }),
            // to remove user auth
            clearUser: () => set({ user: null,
                //  isAuthenticated: false 
            }),
        }),
        {
            name: 'sv_user', // key in localStorage
            // Only persist user -- never crypto keys
            partialize: (state) => ({ user: state.user }),
            // Re-derive isAuthenticated from persisted user on rehydration
            onRehydrateStorage: () => (state) => {
                if(state) {
                    const hasToken = !!localStorage.getItem('sv_token');
                    // state.isAuthenticated = !!state.user && hasToken
                }
            },
        },
    ),
)