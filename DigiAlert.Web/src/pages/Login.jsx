// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BASE_URL } from '../services/api';
import { Link } from 'react-router-dom';


const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/api/Auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
      });

      if (!response.ok) throw new Error("Email ou mot de passe incorrect.");
      const data = await response.json();

      // 1. Stocker le token
      localStorage.setItem('jwtToken', data.token);
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('userRole', data.role);

      // 2. Aller chercher le profil pour avoir le nom de l'entreprise !
      const profileRes = await fetch(`${BASE_URL}/api/Users/profile`, {
      headers: { 'Authorization': `Bearer ${data.token}` }
      });
      
      if (profileRes.ok) {
      const profile = await profileRes.json();
      // On gère la majuscule/minuscule au cas où
      localStorage.setItem('companyName', profile.companyName || profile.CompanyName || 'Mon Entreprise');
      }

      // Téléportation vers le Dashboard
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-10 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-100 animate-in zoom-in duration-300">
        
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-brand-dark mb-2">Digi<span className="text-brand-red">Alert</span></h1>
          <p className="text-slate-500 font-medium">Connectez-vous à votre espace pro</p>
        </div>

        {error && (
          <div className="bg-rose-50 text-brand-red p-4 rounded-xl text-sm font-bold mb-6 text-center border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-brand-dark mb-2">Adresse E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
              placeholder="drkoffi@clinique.com"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-brand-dark mb-2">Mot de passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-dark hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-95 flex justify-center mt-4"
          >
            {isLoading ? 'Connexion en cours...' : 'Se connecter'}
          </button>

          <p className="text-center mt-6 text-sm text-slate-500">Pas encore de compte ? <Link to="/register" className="text-brand-red font-bold hover:underline">Créer un compte</Link></p>
        </form>
        
      </div>
    </div>
  );
};

export default Login;