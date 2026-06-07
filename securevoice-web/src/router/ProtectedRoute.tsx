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
    const isAuthenticated = useAuthStore((s: any) => s.isAuthenticated);
    if(isAuthenticated){
        return <Navigate to = "/login" replace />;
    }

    return <Outlet />;
}