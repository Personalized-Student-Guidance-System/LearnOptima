import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { getOnboardingRedirect } from '../utils/onboardingRedirect';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('sf_token'));
  const [loading, setLoading] = useState(true);

  axios.defaults.baseURL = '/api';

  const applyToken = (t) => {
    if (t) {
      localStorage.setItem('sf_token', t);
      axios.defaults.headers.common.Authorization = `Bearer ${t}`;
    } else {
      localStorage.removeItem('sf_token');
      delete axios.defaults.headers.common.Authorization;
    }
  };

  useEffect(() => {
    if (token) {
      applyToken(token);
      axios
        .get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          applyToken(null);
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await axios.post('/auth/login', { email, password });
    const { token: t, user: u } = res.data;
    setToken(t);
    applyToken(t);
    setUser(u);
    return u;
  };

  const register = async (data) => {
    const res = await axios.post('/auth/register', data);
    const { token: t, user: u } = res.data;
    setToken(t);
    applyToken(t);
    setUser(u);
    return u;
  };

  const logout = () => {
    applyToken(null);
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!localStorage.getItem('sf_token')) return;
    try {
      const res = await axios.get('/auth/me');
      setUser(res.data);
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser, getOnboardingRedirect }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
