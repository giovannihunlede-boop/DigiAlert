import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { BarChart3, Calendar, Users, Settings, Bell, Plus, LogOut, Menu, X, CheckCircle2 } from 'lucide-react';
import KioskCheckin from './pages/KioskCheckin';
import { QRCodeCanvas } from 'qrcode.react';

// Import des pages !
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
    return <Navigate to="/login" replace />;
  }

  return children;
};

// ==========================================
// LE LAYOUT PRINCIPAL DE L'APPLICATION
// ==========================================
const AppLayout = ({ children }) => {
  const location = useLocation(); 

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifsRef = useRef(null);

  const companyName = localStorage.getItem('companyName') || 'Mon Entreprise';
  // On récupère les initiales de l'entreprise pour l'avatar 
  const initials = companyName
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const isActive = (path) => location.pathname === path;

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Tableau de bord';
      case '/agenda': return 'Agenda';
      case '/contacts': return 'Contacts';
      case '/parametres': return 'Paramètres généraux';
      case '/nouveau-rdv': return 'Nouveau RDV';
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

  // charge des notifications à change de page
  useEffect(() => {
    const loadNotifs = async () => {
      try {
        const res = await fetchWithAuth('/api/Dashboard/notifications');
        if (res.ok) {
          setNotifications(await res.json());
        }
      } catch (error) {
        console.error('Erreur notifs:', error);
      }
    };
    loadNotifs();

  }, [location.pathname]);

  useEffect(() => {
    if (!showNotifs) return;
    const handleClickOutside = (event) => {
      if (notifsRef.current && !notifsRef.current.contains(event.target)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifs]);

  
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  
  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation(); 
    
    
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      await fetchWithAuth(`/api/Dashboard/notifications/${id}/read`, { method: 'PUT' });
    } catch (error) {
      console.error('Erreur lors du marquage de la notification:', error);
    }
  };

  //marquer notifications comme lues
  const handleMarkAllAsRead = async () => {
    
    setNotifications([]);

    try {
      await fetchWithAuth(`/api/Dashboard/notifications/read-all`, { method: 'PUT' });
    } catch (error) {
      console.error('Erreur lors du marquage global:', error);
    }
  };

  return (
    <div className="flex h-screen bg-brand-bg font-sans overflow-hidden">

      {/* 📱 Fond assombri sur mobile (ferme le menu si on clique à côté) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-brand-dark/50 z-40 md:hidden"
          onClick={closeMobileMenu}
        ></div>
      )}

      {/* ================= SIDEBAR (rétractable sur mobile) ================= */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-brand-dark text-white flex flex-col justify-between shrink-0 transform transition-transform duration-300 md:relative md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-20 flex items-center justify-between px-8">
            <h1 
              onClick={() => window.location.reload()} 
              className="text-3xl font-bold cursor-pointer select-none hover:opacity-90 transition-opacity"
              title="Rafraîchir la page"
            >
              Digi<span className="text-brand-red">Alert</span>
            </h1>
            {/* Bouton fermer sur mobile */}
            <button className="md:hidden text-slate-400 hover:text-white" onClick={closeMobileMenu}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="mt-6 px-4 space-y-2">
            <Link to="/" onClick={closeMobileMenu} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/') ? 'bg-brand-red text-white shadow-md shadow-brand-red/20 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'}`}>
              <BarChart3 className="w-5 h-5 mr-3" /> Accueil
            </Link>

            <Link to="/agenda" onClick={closeMobileMenu} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/agenda') || isActive('/nouveau-rdv') ? 'bg-brand-red text-white shadow-md shadow-brand-red/20 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'}`}>
              <Calendar className="w-5 h-5 mr-3" /> Agenda
            </Link>

            <Link to="/contacts" onClick={closeMobileMenu} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/contacts') ? 'bg-brand-red text-white shadow-md shadow-brand-red/20 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'}`}>
              <Users className="w-5 h-5 mr-3" /> Contacts
            </Link>

            <Link to="/parametres" onClick={closeMobileMenu} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/parametres') ? 'bg-brand-red text-white shadow-md shadow-brand-red/20 font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white font-medium'}`}>
              <Settings className="w-5 h-5 mr-3" /> Paramètres
            </Link>
          </nav>
        </div>

        <div className="p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">

            <div className="w-10 h-10 rounded-full bg-white text-brand-dark flex items-center justify-center font-bold text-lg shrink-0">
              <span className="sr-only">Paramètres</span>
              <Settings className="w-5 h-5" />
            </div>

            <div className="ml-3 flex-1 overflow-hidden">
              <p className="font-bold text-white text-sm truncate">DigiAlert</p>
              <p className="font-medium text-slate-400 text-xs truncate">Powered by DIGICOM</p>
            </div>
          </div>

          
        </div>
      </div>

      {/* ================= CONTENU PRINCIPAL ================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar Fixe */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-10 shrink-0 z-11">

          <div className="flex items-center gap-4 min-w-0">
            {/* Bouton du menu mobile. */}
            <button className="md:hidden text-brand-dark p-2 -ml-2 shrink-0" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-7 h-7" />
            </button>

            {/* Titre page courante. */}
            {location.pathname !== '/nouveau-rdv' ? (
              <h2 className="text-xl md:text-3xl font-bold text-brand-dark truncate">{getPageTitle()}</h2>
            ) : (
              <h2 className="text-xl md:text-3xl font-extrabold text-brand-dark flex items-center min-w-0 truncate">
                {/* Lien vers agenda. */}
                <Link to="/agenda" className="hover:text-brand-red transition-colors cursor-pointer shrink-0">Agenda</Link>
                <span className="text-slate-400 font-medium hidden sm:inline ml-2 truncate">&gt; Nouveau RDV</span>
              </h2>
            )}
          </div>

          <div className="flex items-center space-x-3 md:space-x-6 shrink-0">
              {/* Zone des notifications. */}
            <div className="relative" ref={notifsRef}>
              <div
                className="relative cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setShowNotifs((prev) => !prev)}
              >
                <Bell className="w-6 h-6 md:w-7 md:h-7 text-slate-400 hover:text-brand-red transition-colors" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-red text-white text-[10px] md:text-xs font-bold w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center border-2 border-white">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </div>
              
                {/* Menu déroulant des notifications. */}
                {showNotifs && (
                <div className="fixed top-20 left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:mt-4 sm:w-[350px] w-auto bg-white rounded-2xl shadow-[0_20px_60px_rgba(15,23,42,0.15)] border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 font-extrabold text-brand-dark flex justify-between items-center">
                    <span>Notifications</span>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{notifications.length}</span>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500 font-medium">
                        Aucune nouvelle alerte !
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex justify-between items-start group">
                          
                          {/* Bloc Texte */}
                          <div className="flex-1 pr-3 cursor-default">
                            <p className={`text-xs font-bold mb-1 ${n.type === 'error' ? 'text-brand-red' : 'text-amber-500'}`}>
                              {n.title}
                            </p>
                            <p className="text-sm text-slate-700 leading-snug">{n.message}</p>
                          </div>

                          {/* Bouton Check */}
                          <button
                            onClick={handleMarkAsRead.bind(null, n.id)}
                            className="text-slate-300 hover:text-brand-red opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-1"
                            title="Marquer comme lu"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>

                        </div>
                      ))
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="p-3 text-center bg-slate-50 border-t border-slate-100">
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-sm text-slate-500 hover:text-brand-red font-bold transition-colors w-full py-1 rounded-md hover:bg-slate-100"
                      >
                        Tout marquer comme lu
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 🆕 Bouton "Nouveau RDV" */}
            {location.pathname !== '/nouveau-rdv' && (
              <Link
                to="/nouveau-rdv"
                className="flex items-center bg-brand-red hover:bg-rose-700 text-white px-3 sm:px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-medium shadow-md transition-all active:scale-95 text-sm md:text-base"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5 sm:mr-1 md:mr-2" />
                <span className="hidden sm:inline md:hidden">RDV</span>
                <span className="hidden md:inline">Nouveau RDV</span>
              </Link>
            )}

            {/* Avatar en haut à droite */}
            <Link to="/parametres" className="flex items-center gap-3 border-l border-slate-200 pl-3 md:pl-6 hover:opacity-75 transition-opacity cursor-pointer">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-brand-dark text-white flex items-center justify-center font-bold text-sm md:text-lg shrink-0 shadow-sm">
                {initials}
              </div>
              <span className="font-bold text-slate-800 hidden lg:block truncate max-w-[150px]">{companyName}</span>
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
};

// ==========================================
// LE ROUTEUR PRINCIPAL
// ==========================================
function App() {
  return (
    <Router>
      <Routes>
        {/* Route Publique */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Page de récupération de mot de passe (à implémenter)</div>} />
        <Route path="/reset-password" element={<div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Page de réinitialisation de mot de passe (à implémenter)</div>} />
        <Route path="/kiosk-checkin/:cabinetId" element={<KioskCheckin />} />
        {/* Routes Privées */}
        <Route
          path="/*"
          element={
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
          }
        />
      </Routes>
    </Router>
  );
}

export default App;