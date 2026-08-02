import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { BarChart3, Calendar, Users, Settings, Bell, Plus, LogOut } from 'lucide-react';


// Import de toutes tes pages !
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Contacts from './pages/Contacts';
import Parametres from './pages/Parametres';
import NouveauRdv from './pages/NouveauRdv';
import Login from './pages/Login';
import Register from './pages/Register';

import { fetchWithAuth } from './services/api';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('jwtToken');
    
    if (!token) {
        // Pas de token ? Direction la page de login !
        return <Navigate to="/login" replace />;
    }
    
    // Si tout est ok, on le laisse passer vers la page demandée
    return children;
};
// Le Layout (L'ossature de ton app)
const AppLayout = ({ children }) => {

  const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };
  const location = useLocation(); // Permet de savoir sur quelle page on est pour colorer le menu !

  const companyName = localStorage.getItem('companyName') || 'Mon Entreprise';
  // On récupère les initiales pour le logo (ex: "Clinique Biova" -> "CB", "Dr. Koffi" -> "DK")
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  // On charge les notifications à chaque fois qu'on change de page
  useEffect(() => {
    const loadNotifs = async () => {
      try {
        const res = await fetchWithAuth('/api/Dashboard/notifications');
        if (res.ok) {
          setNotifications(await res.json());
        }
      } catch (error) {
        console.error("Erreur notifs:", error);
      }
    };
    loadNotifs();
  }, [location.pathname]);
  const initials = companyName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // Fonction pour savoir si un menu est actif
  const isActive = (path) => location.pathname === path;

  // On détermine le titre de la page dynamiquement
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Tableau de bord';
      case '/agenda': return 'Agenda';
      case '/contacts': return 'Contacts';
      case '/parametres': return 'Paramètres généraux';
      case '/nouveau-rdv': return 'Agenda > Nouveau RDV';
      default: return 'DigiAlert';
    }
  };

  // Fonction de déconnexion
    const handleLogout = () => {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('companyName');
        window.location.href = '/login';
    };

  return (
    <div className="flex h-screen bg-brand-bg font-sans">
      
      {/* ================= SIDEBAR (Menu Gauche Fixe) ================= */}
      <div className="w-[260px] bg-brand-dark text-white flex flex-col justify-between shrink-0">
        <div>
          <div className="h-20 flex items-center px-8">
            <h1 className="text-3xl font-bold">Digi<span className="text-brand-red">Alert</span></h1>
          </div>
          
          <nav className="mt-6 px-4 space-y-2">
            <Link to="/" className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/') ? 'bg-brand-red text-white shadow-md shadow-brand-red/20 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'}`}>
              <BarChart3 className="w-5 h-5 mr-3" /> Accueil
            </Link>
            
            <Link to="/agenda" className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/agenda') || isActive('/nouveau-rdv') ? 'bg-brand-red text-white shadow-md shadow-brand-red/20 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'}`}>
              <Calendar className="w-5 h-5 mr-3" /> Agenda
            </Link>
            
            <Link to="/contacts" className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/contacts') ? 'bg-brand-red text-white shadow-md shadow-brand-red/20 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'}`}>
              <Users className="w-5 h-5 mr-3" /> Contacts
            </Link>
            
            <Link to="/parametres" className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/parametres') ? 'bg-brand-red text-white shadow-md shadow-brand-red/20 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'}`}>
              <Settings className="w-5 h-5 mr-3" /> Paramètres
            </Link>
          </nav>
        </div>

        <div className="p-4 mb-4">
          <div className="flex items-center hover:bg-slate-800 p-2 rounded-lg cursor-pointer transition-colors">
          <div className="w-10 h-10 rounded-full bg-white text-brand-dark flex items-center justify-center font-bold text-lg shrink-0">
              {initials}
          </div>
          <div className="ml-3 flex-1 overflow-hidden">
              <p className="font-medium text-white text-sm truncate" title={companyName}>
              {companyName}
              </p>
          </div>
          </div>
          {/* Bouton Déconnexion */}
          <button onClick={handleLogout} className="mt-2 w-full flex items-center justify-center p-2 text-slate-400 hover:text-brand-red hover:bg-slate-800 rounded-lg transition-colors" title="Se déconnecter">
          <LogOut className="w-5 h-5 mr-2" />
          <span className="text-sm font-medium">Déconnexion</span>
          </button>
      </div>
      </div>

      {/* ================= CONTENU PRINCIPAL ================= */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Topbar Fixe */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0 z-10">
          {/* Titre dynamique de la page */}
          {location.pathname !== '/nouveau-rdv' ? (
            <h2 className="text-3xl font-bold text-brand-dark">{getPageTitle()}</h2>
          ) : (
            <h2 className="text-3xl font-extrabold text-brand-dark flex items-center">
              {/* Le lien cliquable vers l'agenda ! */}
              <Link to="/agenda" className="hover:text-brand-red transition-colors cursor-pointer mr-2">Agenda</Link> 
              <span className="text-slate-400 font-medium text-2xl mt-1">&gt; Nouveau Rendez-vous</span>
            </h2>
          )}
          
          <div className="flex items-center space-x-6">
            {/* Zone de la Cloche de Notification */}
            <div className="relative">
              {/* L'icône */}
              <div 
                className="relative cursor-pointer hover:scale-105 transition-transform" 
                onClick={() => setShowNotifs(!showNotifs)}
              >
                <Bell className="w-7 h-7 text-slate-400 hover:text-brand-red transition-colors" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-red text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                    {notifications.length}
                  </span>
                )}
              </div>

              {/* Le Menu Déroulant (Dropdown) */}
              {showNotifs && (
                <div className="absolute right-0 mt-4 w-80 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 font-extrabold text-brand-dark flex justify-between items-center">
                    <span>Notifications</span>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{notifications.length}</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500 font-medium">
                        Aucune nouvelle alerte. Tout va bien !
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-default">
                          <p className={`text-xs font-bold mb-1 ${n.type === 'error' ? 'text-brand-red' : 'text-amber-500'}`}>
                            {n.title}
                          </p>
                          <p className="text-sm text-slate-700 leading-snug">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Affiche le bouton "Nouveau RDV" SAUF si on est déjà sur la page Nouveau RDV */}
            {location.pathname !== '/nouveau-rdv' && (
                <Link to="/nouveau-rdv" className="hidden md:flex items-center bg-brand-red hover:bg-rose-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md transition-all active:scale-95">
                <Plus className="w-5 h-5 mr-2" /> Nouveau RDV
                </Link>
            )}

            {/* Avatar en haut à droite */}
            <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
                <div className="w-10 h-10 rounded-full bg-brand-dark text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                {initials}
                </div>
                <span className="font-bold text-slate-800 hidden md:block">{companyName}</span>
            </div>
        </div>
        </header>

        {/* C'est ici que les pages s'affichent maintenant ! */}
        {children}

      </div>
    </div>
  );
};

// ==========================================
// 3. LE ROUTEUR PRINCIPAL
// ==========================================
function App() {
    return (
        <Router>
            <Routes>
                {/* Route Publique : Pas de Sidebar, pas de Topbar */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Routes Privées : Le Garde du Corps (ProtectedRoute) valide le Token, 
                    puis on affiche la structure globale (AppLayout) avec la page au centre */}
                <Route path="/*" element={
                    <ProtectedRoute>
                        <AppLayout>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/agenda" element={<Agenda />} />
                                <Route path="/contacts" element={<Contacts />} />
                                <Route path="/parametres" element={<Parametres />} />
                                <Route path="/nouveau-rdv" element={<NouveauRdv />} />
                            </Routes>
                        </AppLayout>
                    </ProtectedRoute>
                } />
            </Routes>
        </Router>
    );
}

export default App;