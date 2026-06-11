import { createBrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import Notes from "../pages/app/Notes";
// import Home from "../pages/Home";

const router = createBrowserRouter([
    // -------------- Public Routes ------------------------------
    // {
    //     path: "/",
    //     element: <Home />  
    // },
    {
        path: "/login",
        element: <Login />
    },
    {
        path: "/register",
        element: <Register />
    },

    // -------------- Protected Routes ------------------------------
    {
        element: <ProtectedRoute />,
        children: [
            {
                path: "/",
                element: <Navigate to="/notes" replace />,
            },
            {
                path: "/notes",
                element: <Notes />,
            }
            // Phase 3 - add these when the pages are built
        ]
    },
    // -------------- Fallback ------------------------------
    {
        path: "*",
        element: <Navigate to= "/" replace />
    }
])

export default router;