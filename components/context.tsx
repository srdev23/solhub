// context.tsx
import React, { createContext, useState, useContext, ReactNode } from 'react';

interface AppState {
    user: { name: string } | null;
    sidebarOpen: boolean;
    collapsed: boolean;
}

interface AppContextProps {
    state: AppState;
    toggleSidebar: () => void;
    toggleCollapsed: () => void;
    loginUser: (user: { name: string }) => void;
    logoutUser: () => void;
    sidebarClose: () => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>({
        user: null,
        sidebarOpen: false,
        collapsed: true
    });

    const toggleSidebar = () => {
        setState(prevState => ({
            ...prevState,
            sidebarOpen: !prevState.sidebarOpen
        }));
    };
    const sidebarClose = () => {
        setState(prevState => ({
            ...prevState,
            sidebarOpen: false
        }));
    };
    const toggleCollapsed = () => {
        setState(prevState => ({
            ...prevState,
            collapsed: !prevState.collapsed
        }));
    };

    const loginUser = (user: { name: string }) => {
        setState(prevState => ({
            ...prevState,
            user
        }));
    };

    const logoutUser = () => {
        setState(prevState => ({
            ...prevState,
            user: null
        }));
    };

    React.useEffect(() => {
        const data = localStorage.getItem('sidebar-pro-toggle');
        setState(prevState => ({
            ...prevState,
            sidebarOpen: data === 'true'
        }));
    }, []);

    return (
        <AppContext.Provider value={{ state, toggleSidebar, loginUser, logoutUser, toggleCollapsed, sidebarClose }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = (): AppContextProps => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
