import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(localStorage.getItem('sf_token'));
  const [loading, setLoading] = useState(true);

  axios.defaults.baseURL = '/api';

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await axios.post('/auth/login', { email, password });
    const { token: t, user: u } = res.data;
    localStorage.setItem('sf_token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t); setUser(u);
    return u;
  };

  const register = async (data) => {
    const res = await axios.post('/auth/register', data);
    const { token: t, user: u } = res.data;
    localStorage.setItem('sf_token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t); setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('sf_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null); setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);