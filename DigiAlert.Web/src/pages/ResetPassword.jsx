import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { BASE_URL } from '../services/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Si l'utilisateur arrive sur la page sans token dans l'URL
  if (!token || !email) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md w-full">
          <p className="text-brand-red font-bold text-lg mb-4">Lien de réinitialisation invalide ou corrompu.</p>
          <Link to="/forgot-password" className="text-brand-dark font-bold hover:underline">Refaire une demande</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      return setError("Les mots de passe ne correspondent pas.");
    }
    if (password.length < 6) {
      return setError("Le mot de passe doit faire au moins 6 caractères.");
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/api/Users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword: password })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || data.Message);
        // Redirection vers le login (3 sec)
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(data.message || data.Message || "Une erreur est survenue.");
      }
    } catch (err) {
      setError("Erreur de connexion au serveur.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-10 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-100 animate-in zoom-in duration-300">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-brand-dark mb-2">Nouveau mot de passe</h1>
          <p className="text-slate-500 font-medium text-sm">Créez un nouveau mot de passe sécurisé pour le compte <strong>{email}</strong>.</p>
        </div>

        {message ? (
          <div className="bg-emerald-50 text-emerald-700 p-6 rounded-xl text-sm font-bold text-center">
            ✅ {message}
            <p className="mt-2 text-slate-500 font-normal">Redirection vers la connexion...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-rose-50 text-brand-red p-3 rounded-xl text-sm font-bold border border-rose-200 text-center">
                ❌ {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-brand-dark mb-2">Nouveau mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-brand-dark mb-2">Confirmer le mot de passe</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-dark hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-95 flex justify-center mt-6 disabled:bg-slate-400"
            >
              {isLoading ? 'Modification...' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;