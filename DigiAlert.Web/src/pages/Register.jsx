import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BASE_URL } from '../services/api';

const Register = () => {
  const [formData, setFormData] = useState({ companyName: '', email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Appelle le backend pour créer le compte.
      const res = await fetch(`${BASE_URL}/api/Users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        alert("Compte créé avec succès ! Vous pouvez maintenant vous connecter.");
        navigate('/login');
      } else {
        alert("Erreur lors de la création. Cet email est peut-être déjà utilisé.");
      }
    } catch (err) { 
      alert("Erreur réseau. Impossible de contacter le serveur."); 
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // overflow-y-auto permet le défilement sur les petits écrans.
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 font-sans overflow-y-auto">
      <div className="bg-white p-10 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-100 my-8 animate-in zoom-in duration-300">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-brand-dark mb-2">Digi<span className="text-brand-red">Alert</span></h1>
          <p className="text-slate-500 font-medium">Créez votre espace</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-brand-dark mb-2">Nom de l'Entreprise</label>
            <input 
              required type="text" placeholder="Ex: Clinique Santé Plus"
              onChange={e => setFormData({...formData, companyName: e.target.value})} 
              className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 transition-all" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-brand-dark mb-2">Adresse E-mail</label>
            <input 
              required type="email" placeholder="contact@clinique.com"
              onChange={e => setFormData({...formData, email: e.target.value})} 
              className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 transition-all" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-brand-dark mb-2">Mot de passe</label>
            <input 
              required type="password" placeholder="••••••••"
              onChange={e => setFormData({...formData, password: e.target.value})} 
              className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-brand-red focus:ring-2 focus:ring-brand-red/20 transition-all" 
            />
          </div>
          <button type="submit" disabled={isLoading} className="w-full flex justify-center bg-brand-dark hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-95 transition-all mt-4">
            {isLoading ? 'Création en cours...' : 'Créer mon espace'}
          </button>
        </form>
        
        <p className="text-center mt-6 text-sm text-slate-500">
          Déjà un compte ? <Link to="/login" className="text-brand-red font-bold hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;