import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from '../store/authStore';

/**
 * Wraps protected routes. If the user is not authenticated
 * redirected to /login and remembers where they were trying to do.
 * 
 * Usage in router:
 *  { element: <ProtectedRoute />, children: [ ...app routes]}
*/

export default function ProtectedRoute() {
    const user  = useAuthStore((s) => s.user);
    const userId = user?.id
    const token = localStorage.getItem(`sv_token_${userId}`);

    if (!user || !token) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}