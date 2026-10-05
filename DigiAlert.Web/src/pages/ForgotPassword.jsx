import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BASE_URL } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/api/Users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, clientUrl: window.location.origin }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || data.Message);
        setEmail('');
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
          <h1 className="text-3xl font-extrabold text-brand-dark mb-2">Mot de passe oublié</h1>
          <p className="text-slate-500 font-medium text-sm">Entrez votre email, nous vous enverrons un lien de réinitialisation.</p>
        </div>

        {message && (
          <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm font-bold mb-6 border border-emerald-200 text-center">
            ✅ {message}
          </div>
        )}

        {error && (
          <div className="bg-rose-50 text-brand-red p-4 rounded-xl text-sm font-bold mb-6 border border-rose-200 text-center">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-brand-dark mb-2">Adresse E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
              placeholder="docteur@clinique.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-dark hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-95 flex justify-center mt-4 disabled:bg-slate-400"
          >
            {isLoading ? 'Envoi en cours...' : 'Envoyer le lien'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-slate-500">
          Je me souviens de mon mot de passe ! <Link to="/login" className="text-brand-red font-bold hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;