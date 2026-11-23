import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import { User, InstitutionSettings, PageContent } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  settings: InstitutionSettings | null;
  pageContent: PageContent | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  registerApplicant: (data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    photoUrl?: string;
  }) => Promise<void>;
  switchPersona: (email: string) => Promise<void>;
  updateSessionUser: (token: string | null, user: User) => void;
  logout: () => void;
  refreshUserData: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshPageContent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<InstitutionSettings | null>(null);
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Prevent an older getMe() response from replacing a newer login/session.
  const authRequestVersion = useRef(0);

  const refreshSettings = async () => {
    try {
      const res = await api.getSettings();
      if (res.success) {
        setSettings(res.settings);
      }
    } catch (error) {
      console.error('Failed to load institution settings', error);
    }
  };

  const refreshPageContent = async () => {
    try {
      const res = await api.getPageContent();
      if (res.success) {
        setPageContent(res.pageContent);
      }
    } catch (error) {
      console.error('Failed to load page content', error);
    }
  };

  const refreshUserData = async () => {
    const token = api.getToken();
    const requestVersion = ++authRequestVersion.current;

    if (!token) {
      setUser(null);
      return;
    }

    try {
      const res = await api.getMe();

      // Ignore responses belonging to a session that has since changed.
      if (
        requestVersion !== authRequestVersion.current ||
        api.getToken() !== token
      ) {
        return;
      }

      if (res.success) {
        setUser(res.user);
      } else {
        api.setToken(null);
        setUser(null);
      }
    } catch {
      if (
        requestVersion === authRequestVersion.current &&
        api.getToken() === token
      ) {
        api.setToken(null);
        setUser(null);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          refreshSettings(),
          refreshPageContent(),
          refreshUserData(),
        ]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void init();

    return () => {
      mounted = false;
      // Invalidate any authentication request still in flight on unmount.
      authRequestVersion.current += 1;
    };
  }, []);

  const login = async (email: string, pass: string) => {
    // Invalidate pending session refreshes before changing accounts.
    authRequestVersion.current += 1;

    const res = await api.login(email, pass);

    if (res.success && res.token) {
      api.setToken(res.token);
      setUser(res.user);
      return;
    }

    throw new Error('Login was not successful. Please check the account details and try again.');
  };

  const registerApplicant = async (data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    photoUrl?: string;
  }) => {
    const res = await api.registerApplicant(data);

    if (res.success && res.token) {
      authRequestVersion.current += 1;
      api.setToken(res.token);
      setUser(res.user);
      return;
    }

    throw new Error('Applicant registration was not successful. Please try again.');
  };

  const switchPersona = async (email: string) => {
    setIsLoading(true);

    // Clear the old identity immediately so another persona's data is not
    // displayed while the new account is being authenticated.
    authRequestVersion.current += 1;
    api.setToken(null);
    setUser(null);

    try {
      // Default development password for seeded personas.
      await login(email, 'Password123!');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSessionUser = (token: string | null, nextUser: User) => {
    authRequestVersion.current += 1;
    api.setToken(token);
    setUser(nextUser);
  };

  const logout = () => {
    authRequestVersion.current += 1;
    api.setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        pageContent,
        isLoading,
        login,
        registerApplicant,
        switchPersona,
        updateSessionUser,
        logout,
        refreshUserData,
        refreshSettings,
        refreshPageContent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
