import React, { useState, useEffect } from 'react';
import { User, MessageSquare, Plus, Users, Building2, Plug, FileText, Eye, EyeOff, Edit2, Trash2, X, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { fetchWithAuth } from '../services/api';

const Parametres = () => {
    const [activeTab, setActiveTab] = useState('profil');
    const [showApiKey, setShowApiKey] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const userRole = localStorage.getItem('userRole');
    const [team, setTeam] = useState([]);
    const [newStaff, setNewStaff] = useState({ FirstName: '', Email: '', Password: '', Role: 'User' });

    // Gère la fenêtre de changement du mot de passe.
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
    const [showOldPwd, setShowOldPwd] = useState(false);
    const [showNewPwd, setShowNewPwd] = useState(false);
    const [showConfPwd, setShowConfPwd] = useState(false);

    // États synchronisés avec les données de la base.
    const [profile, setProfile] = useState({ companyName: '', email: '' });
    const [apiCreds, setApiCreds] = useState({ senderId: '', apiKey: '', emailSender: '', emailApiKey: '' });
    const [templates, setTemplates] = useState([]);

    const [editingTemplate, setEditingTemplate] = useState(null);
    const [modelName, setModelName] = useState('');
    const [messageContent, setMessageContent] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [dragOverField, setDragOverField] = useState(false);

    const fields = ['Nom', 'Prenom', 'Date', 'Heure'];

    const [connectionStatus, setConnectionStatus] = useState('idle');
    const [connectionMessage, setConnectionMessage] = useState('Cliquez pour tester votre connexion.');
    const [loadingConnection, setLoadingConnection] = useState(false);

    // 1. CHARGEMENT DES DONNÉES AU DÉMARRAGE
    useEffect(() => {
        const loadData = async () => {
            if (userRole === 'Admin') {
                const teamRes = await fetchWithAuth('/api/Users/team');
                if (teamRes.ok) setTeam(await teamRes.json());
            }

            try {
                const userRes = await fetchWithAuth('/api/Users/profile');
                if (userRes.ok) {
                    const userData = await userRes.json();
                    setProfile({ companyName: userData.companyName || '', email: userData.email || '', role: userData.role || 'User' });
                    setApiCreds({ senderId: userData.senderId || '', apiKey: userData.apiKey || '', emailSender: userData.emailSender || '', emailApiKey: userData.emailApiKey || '' });

                    if (userData.role === 'Admin' || userData.role === 'Owner') {
                        const teamRes = await fetchWithAuth('/api/users/team');
                        if (teamRes.ok) setTeam(await teamRes.json());
                    }
                }

                const tplRes = await fetchWithAuth('/api/SmsTemplates');
                if (tplRes.ok) {
                    setTemplates(await tplRes.json());
                }
            } catch (error) {
                console.error("Erreur de chargement des paramètres:", error);
            }
        };
        loadData();
    }, [userRole]);

    // 2. SAUVEGARDE DES CLÉS API
    const handleSaveApiCreds = async () => {
        try {
            const res = await fetchWithAuth('/api/Users/ApiCredentials', {
                method: 'PUT',
                body: JSON.stringify(apiCreds)
            });
            if (res.ok) alert("Identifiants API sauvegardés avec succès !");
        } catch (error) {
            alert("Erreur lors de la sauvegarde.");
        }
    };

    // 2.5 SAUVEGARDE DU PROFIL
    const handleSaveProfile = async () => {
        try {
            const res = await fetchWithAuth('/api/Users/profile', {
                method: 'PUT',
                body: JSON.stringify({ companyName: profile.companyName, email: profile.email })
            });
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('companyName', data.companyName);
                alert("Profil mis à jour avec succès !");
                window.location.reload(); 
            } else {
                alert("Erreur lors de la mise à jour du profil.");
            }
        } catch (error) {
            alert("Erreur réseau.");
        }
    };

    // 3. SAUVEGARDE D'UN MODÈLE
    const handleSaveTemplate = async () => {
        if (!modelName || !messageContent) return alert("Veuillez remplir le nom et le contenu.");
        const payload = { templateName: modelName, messageContent: messageContent };
        const isUpdate = editingTemplate != null;
        const url = isUpdate ? `/api/SmsTemplates/${editingTemplate.idTemplate}` : '/api/SmsTemplates';

        try {
            const res = await fetchWithAuth(url, {
                method: isUpdate ? 'PUT' : 'POST',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const tplRes = await fetchWithAuth('/api/SmsTemplates');
                if (tplRes.ok) setTemplates(await tplRes.json());

                setIsModalOpen(false);
                setEditingTemplate(null);
            }
        } catch (error) {
            alert("Erreur lors de la sauvegarde du modèle.");
        }
    };

    // 5. CHANGEMENT DE MOT DE PASSE
    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) return alert("Les nouveaux mots de passe ne correspondent pas !");
        if (passwords.new.length < 6) return alert("Le nouveau mot de passe doit faire au moins 6 caractères.");

        try {
            const res = await fetchWithAuth('/api/Users/password', {
                method: 'PUT',
                body: JSON.stringify({ oldPassword: passwords.old, newPassword: passwords.new })
            });
            if (res.ok) {
                alert("Mot de passe modifié avec succès !");
                setIsPasswordModalOpen(false);
                setPasswords({ old: '', new: '', confirm: '' });
            } else {
                const errorText = await res.text();
                alert(errorText || "Erreur lors de la modification.");
            }
        } catch (error) {
            alert("Erreur réseau de communication.");
        }
    };

    // 6. GESTION DE L'ÉQUIPE
    const handleAddStaff = async (e) => {
        e.preventDefault();
        try {
            const res = await fetchWithAuth('/api/users/team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newStaff)
            });
            if (res.ok) {
                alert("Membre ajouté avec succès !");
                setNewStaff({ FirstName: '', Email: '', Password: '', Role: 'User' });
                const teamRes = await fetchWithAuth('/api/users/team');
                if (teamRes.ok) setTeam(await teamRes.json());
            } else {
                const err = await res.json();
                alert(err.Message || "Erreur lors de l'ajout.");
            }
        } catch (error) { console.error(error); }
    };

    const handleDeleteStaff = async (id) => {
        if (!window.confirm("Voulez-vous vraiment retirer ce membre de l'équipe ?")) return;
        try {
            const res = await fetchWithAuth(`/api/users/team/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setTeam(prev => prev.filter(member => member.idUser !== id));
            } else {
                alert("Impossible de supprimer ce compte.");
            }
        } catch (error) { console.error(error); }
    };

    // 7. TEST DE CONNEXION API
    const testConnection = async () => {
        if (loadingConnection) return;
        if (!apiCreds.apiKey || !apiCreds.senderId) {
            setConnectionStatus('error');
            setConnectionMessage("Veuillez remplir les deux champs.");
            return;
        }

        setLoadingConnection(true);
        setConnectionStatus('pending');
        setConnectionMessage('Test de connexion au serveur...');

        try {
            const res = await fetchWithAuth('/api/Users/test-api', {
                method: 'POST',
                body: JSON.stringify(apiCreds)
            });
            if (res.ok) {
                setConnectionStatus('success');
                setConnectionMessage('Connexion réussie avec DigiSMS !');
            } else {
                let errorMsg = "Échec de la connexion.";
                try {
                    const errData = await res.json();
                    errorMsg = errData.Message || errData.message || errorMsg;
                } catch (e) {
                    const errText = await res.text();
                    errorMsg = errText || errorMsg;
                }
                setConnectionStatus('error');
                setConnectionMessage(errorMsg); 
            }
        } catch (error) {
            setConnectionStatus('error');
            setConnectionMessage("Erreur réseau de communication.");
        } finally {
            setLoadingConnection(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-10 bg-brand-bg relative">
            <div className="flex flex-col md:flex-row gap-6 md:gap-10 flex-1 h-auto">

                {/* ================= MENU GAUCHE (ONGLETS RESPONSIVE) ================= */}
                <div className="w-full md:w-1/3 flex md:flex-col gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0 shrink-0 hide-scrollbar">
                    
                    <button onClick={() => setActiveTab('profil')} className={`flex items-center whitespace-nowrap px-5 py-3 md:py-4 rounded-xl font-bold text-sm md:text-lg transition-all shadow-sm md:shadow-none ${activeTab === 'profil' ? 'bg-brand-dark text-white md:bg-slate-400 md:shadow-md' : 'bg-white text-slate-700 md:bg-slate-300/60 md:text-slate-800'}`}>
                        <Building2 className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" /> Profil
                    </button>

                    {(userRole === 'Admin' || userRole === 'Owner') && (
                        <button onClick={() => setActiveTab('team')} className={`flex items-center whitespace-nowrap px-5 py-3 md:py-4 rounded-xl font-bold text-sm md:text-lg transition-all shadow-sm md:shadow-none ${activeTab === 'team' ? 'bg-brand-dark text-white md:bg-slate-400 md:shadow-md' : 'bg-white text-slate-700 md:bg-slate-300/60 md:text-slate-800'}`}>
                            <Users className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" /> Mon Équipe
                        </button>
                    )}

                    <button onClick={() => setActiveTab('api')} className={`flex items-center whitespace-nowrap px-5 py-3 md:py-4 rounded-xl font-bold text-sm md:text-lg transition-all shadow-sm md:shadow-none ${activeTab === 'api' ? 'bg-brand-dark text-white md:bg-slate-400 md:shadow-md' : 'bg-white text-slate-700 md:bg-slate-300/60 md:text-slate-800'}`}>
                        <Plug className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" /> Intégration API
                    </button>

                    <button onClick={() => setActiveTab('templates')} className={`flex items-center whitespace-nowrap px-5 py-3 md:py-4 rounded-xl font-bold text-sm md:text-lg transition-all shadow-sm md:shadow-none ${activeTab === 'templates' ? 'bg-brand-dark text-white md:bg-slate-400 md:shadow-md' : 'bg-white text-slate-700 md:bg-slate-300/60 md:text-slate-800'}`}>
                        <FileText className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" /> Modèles SMS
                    </button>

                    <button onClick={() => setActiveTab('switch')} className={`flex items-center whitespace-nowrap px-5 py-3 md:py-4 rounded-xl font-bold text-sm md:text-lg transition-all shadow-sm md:shadow-none ${activeTab === 'switch' ? 'bg-brand-dark text-white md:bg-slate-400 md:shadow-md' : 'bg-white text-slate-700 md:bg-slate-300/60 md:text-slate-800'}`}>
                        <User className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3" /> Déconnexion
                    </button>
                </div>

                {/* ================= CONTENU DROITE (CARTE BLANCHE) ================= */}
                <div className="w-full md:w-2/3 bg-white rounded-3xl shadow-lg border border-slate-100 p-5 sm:p-10 min-h-[500px]">

                    {/* ---- ONGLET : PROFIL ---- */}
                    {activeTab === 'profil' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="flex flex-col items-center mb-8">
                                <Building2 className="w-8 h-8 mr-3 text-brand-dark" />
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-dark mt-2 text-center">Profil de l'Entreprise</h2>
                                <div className="w-24 sm:w-48 h-1 bg-brand-red rounded-full mt-3"></div>
                            </div>

                            <div className="space-y-6 max-w-md mx-auto">
                                <div>
                                    <label className="block text-sm sm:text-lg font-bold text-brand-dark mb-2">Nom de la Structure</label>
                                    <input type="text" value={profile.companyName} onChange={e => setProfile({...profile, companyName: e.target.value})} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-brand-dark focus:ring-2 focus:ring-brand-red/20 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="block text-sm sm:text-lg font-bold text-brand-dark mb-2">Adresse E-mail de connexion</label>
                                    <input type="email" value={profile.email} readOnly className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-500 bg-slate-50 outline-none cursor-not-allowed" />
                                </div>

                                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
                                    <button onClick={handleSaveProfile} className="w-full sm:w-auto px-8 py-3 bg-brand-red text-white font-extrabold text-lg rounded-xl shadow-sm hover:bg-rose-700 active:scale-95 transition-all">
                                        Mettre à jour
                                    </button>
                                    <button onClick={() => setIsPasswordModalOpen(true)} className="w-full sm:w-auto px-8 py-3 bg-white text-brand-dark font-extrabold text-lg rounded-xl border-2 border-slate-200 shadow-sm hover:bg-slate-50 active:scale-95 transition-all">
                                        Mot de passe
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ---- ONGLET : API ---- */}
                    {activeTab === 'api' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="flex flex-col items-center mb-8 text-center">
                                <Plug className="w-8 h-8 mr-3 text-brand-dark" />
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-dark mt-2">Intégration des API</h2>
                                <div className="w-24 sm:w-48 h-1 bg-brand-red rounded-full mt-3"></div>
                            </div>

                            <div className="space-y-8 max-w-2xl mx-auto">
                                {/* BLOC SMS */}
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
                                    {/* En-tête */}
                                    <h3 className="text-lg sm:text-xl font-bold text-brand-dark mb-4 sm:mb-6 flex items-center border-b border-slate-200 pb-3">
                                        <span className="bg-brand-dark text-white p-1.5 rounded-lg mr-3 shadow-sm">
                                            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </span>
                                        API DigiSMS
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Champ Sender ID */}
                                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                            <label className="flex items-center text-sm font-bold text-brand-dark mb-1">
                                                Sender ID (Nom d'expéditeur)
                                            </label>
                                            <p className="text-[10px] sm:text-xs text-slate-500 italic mb-3 leading-tight">
                                                Saisissez le nom exact validé sur votre espace DigiSMS.
                                            </p>
                                            <input 
                                                type="text" 
                                                value={apiCreds.senderId} 
                                                onChange={e => setApiCreds({...apiCreds, senderId: e.target.value})} 
                                                placeholder="Ex: DIGIALERT" 
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-brand-dark font-bold tracking-wide focus:ring-2 focus:ring-brand-red/20 outline-none uppercase bg-slate-50 focus:bg-white transition-colors" 
                                            />
                                        </div>

                                        {/* Champ Clé API */}
                                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                            <label className="block text-sm font-bold text-brand-dark mb-1">
                                                Clé API Live (SMS)
                                            </label>
                                            <p className="text-[10px] sm:text-xs text-slate-500 italic mb-3 leading-tight">
                                                Entrez votre clé secrète générée depuis DigiSMS (commence par sk_live_...)
                                            </p>
                                            <div className="relative">
                                                <input 
                                                    type={showApiKey ? "text" : "password"} 
                                                    value={apiCreds.apiKey} 
                                                    onChange={e => setApiCreds({...apiCreds, apiKey: e.target.value})} 
                                                    placeholder="sk_live_..." 
                                                    className="w-full pl-4 pr-12 py-2.5 border border-slate-300 rounded-xl text-brand-dark focus:ring-2 focus:ring-brand-red/20 outline-none tracking-wider bg-slate-50 focus:bg-white transition-colors" 
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowApiKey(!showApiKey)} 
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-brand-dark p-1"
                                                >
                                                    {showApiKey ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section de Test et Notifications */}
                                    <div className="mt-6 border-t border-slate-200 pt-5">
                                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                            
                                            {/* Bouton d'action */}
                                            <button
                                                type="button"
                                                onClick={testConnection}
                                                disabled={loadingConnection}
                                                className="flex justify-center items-center gap-2 w-full sm:w-auto shrink-0 px-6 py-2.5
                                                        bg-white text-brand-dark text-sm font-bold rounded-xl
                                                        border-2 border-slate-200 hover:border-brand-dark hover:shadow-md
                                                        transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loadingConnection ? (
                                                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                                ) : (
                                                    <Plug className="w-4 h-4 shrink-0" />
                                                )}

                                                <span>Tester la Connexion API</span>
                                            </button>

                                            {/* Bulle d'Alerte */}
                                            {connectionStatus !== 'idle' && (
                                                <div
                                                    className={`flex-1 min-w-0 w-full flex items-start gap-3 p-3 rounded-xl border
                                                                overflow-hidden animate-in fade-in slide-in-from-bottom-2
                                                                ${
                                                                    connectionStatus === 'success'
                                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                                                        : 'bg-rose-50 border-rose-200 text-rose-800'
                                                                }`}
                                                >
                                                    {connectionStatus === 'success' ? (
                                                        <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                                                    ) : (
                                                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                                                    )}

                                                    <div className="min-w-0 flex-1 text-sm font-medium leading-relaxed break-words overflow-wrap-anywhere">
                                                        {connectionMessage}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* BLOC EMAIL */}
                                <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-lg sm:text-xl font-bold text-brand-dark mb-4 sm:mb-6 flex items-center border-b border-slate-200 pb-3">
                                        <span className="bg-brand-red text-white p-1.5 px-2.5 font-bold rounded-lg mr-3">@</span>
                                        API Email
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                        <div>
                                            <label className="block text-xs sm:text-sm font-bold text-brand-dark mb-2">Email d'Expéditeur</label>
                                            <input type="email" value={apiCreds.emailSender} onChange={e => setApiCreds({...apiCreds, emailSender: e.target.value})} placeholder="contact@clinique.com" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-brand-dark focus:ring-2 focus:ring-brand-red/20 outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs sm:text-sm font-bold text-brand-dark mb-2">Clé API (SMTP)</label>
                                            <input type="password" value={apiCreds.emailApiKey} onChange={e => setApiCreds({...apiCreds, emailApiKey: e.target.value})} placeholder="Clé API Email..." className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-brand-dark focus:ring-2 focus:ring-brand-red/20 outline-none tracking-wider" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-center pt-2">
                                    <button onClick={handleSaveApiCreds} className="w-full sm:w-auto px-10 py-3 sm:py-4 bg-brand-dark text-white font-extrabold text-lg sm:text-xl rounded-xl shadow-lg active:scale-95 transition-all">
                                        Sauvegarder les clés
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ---- ONGLET : ÉQUIPE ---- */}
                    {activeTab === 'team' && (userRole === 'Admin' || userRole === 'Owner') && (
                        <div className="animate-in fade-in duration-300">
                            <div className="flex flex-col items-center mb-8 text-center">
                                <Users className="w-8 h-8 mr-3 text-brand-dark" />
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-dark mt-2">Gérer l'Équipe</h2>
                                <div className="w-24 sm:w-48 h-1 bg-brand-red rounded-full mt-3"></div>
                            </div>

                            {/* Formulaire d'ajout */}
                            <form onSubmit={handleAddStaff} className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                                <h3 className="text-lg font-bold text-brand-dark mb-2">Ajouter un collaborateur</h3>
                                <p className="text-xs sm:text-sm text-slate-500 italic mb-6">Le mot de passe sera temporaire.</p>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Prénom</label>
                                        <input type="text" required placeholder="Ex: Jeanne" value={newStaff.FirstName} onChange={e => setNewStaff({...newStaff, FirstName: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-brand-red focus:ring-2 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Email</label>
                                        <input type="email" required placeholder="jeanne@clinique.com" value={newStaff.Email} onChange={e => setNewStaff({...newStaff, Email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-brand-red focus:ring-2 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Mot de passe</label>
                                        <input type="password" required placeholder="Provisoire" value={newStaff.Password} onChange={e => setNewStaff({...newStaff, Password: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none focus:border-brand-red focus:ring-2 text-sm" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 pt-4">
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Rôle</label>
                                        <select value={newStaff.Role || 'User'} onChange={e => setNewStaff({...newStaff, Role: e.target.value})} className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 outline-none focus:border-brand-red text-sm font-medium text-brand-dark shadow-sm">
                                            <option value="User">Collaborateur</option>
                                            <option value="Admin">Administrateur</option>
                                        </select>
                                    </div>
                                    
                                    <div className="md:col-span-2 flex items-end">
                                        <button type="submit" className="w-full py-2.5 bg-brand-red text-white font-extrabold rounded-xl hover:bg-rose-700 active:scale-95 transition-all shadow-md flex items-center justify-center">
                                            <Plus className="w-5 h-5 mr-2" /> Ajouter
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {/* Liste de l'équipe */}
                            <div className="bg-transparent sm:bg-white sm:border border-slate-200 rounded-3xl overflow-hidden sm:shadow-sm">
                                {/* Desktop */}
                                <table className="hidden sm:table w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="p-4 font-bold text-slate-500 text-xs uppercase">Nom</th>
                                            <th className="p-4 font-bold text-slate-500 text-xs uppercase">Email</th>
                                            <th className="p-4 font-bold text-slate-500 text-xs uppercase text-center">Rôle</th>
                                            <th className="p-4 font-bold text-slate-500 text-xs uppercase text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {team.map(member => (
                                            <tr key={member.idUser} className="hover:bg-slate-50">
                                                <td className="p-4 font-bold text-brand-dark">{member.companyName || member.firstName || "Collaborateur"}</td>
                                                <td className="p-4 text-slate-600 text-sm">{member.email}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${member.role === 'Admin' ? 'bg-brand-dark text-white' : 'bg-slate-200 text-slate-600'}`}>{member.role}</span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {profile?.email !== member.email && member.role !== 'Owner' && (profile?.role === 'Owner' || (profile?.role === 'Admin' && member.role === 'User')) && (
                                                        <button onClick={() => handleDeleteStaff(member.idUser)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Supprimer">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Mobile */}
                                <div className="sm:hidden flex flex-col gap-3">
                                    {team.map(member => (
                                        <div key={member.idUser} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative">
                                            {profile?.email !== member.email && member.role !== 'Owner' && (profile?.role === 'Owner' || (profile?.role === 'Admin' && member.role === 'User')) && (
                                                <button onClick={() => handleDeleteStaff(member.idUser)} className="absolute top-4 right-4 p-2 bg-rose-50 text-brand-red rounded-lg">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            <h3 className="font-extrabold text-brand-dark text-lg">{member.companyName || member.firstName || "Collaborateur"}</h3>
                                            <p className="text-slate-500 text-sm mt-1">{member.email}</p>
                                            <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold ${member.role === 'Admin' ? 'bg-brand-dark text-white' : 'bg-slate-200 text-slate-600'}`}>{member.role}</span>
                                        </div>
                                    ))}
                                </div>

                                {team.length === 0 && <div className="p-8 text-center text-slate-400 italic bg-white rounded-2xl">Aucun collaborateur.</div>}
                            </div>
                        </div>
                    )}

                    {/* ---- ONGLET : CHANGER DE COMPTE ---- */}
                    {activeTab === 'switch' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="flex flex-col items-center mb-8 text-center">
                                <User className="w-8 h-8 mr-3 text-brand-dark" />
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-dark mt-2">Changer de Compte</h2>
                                <div className="w-24 sm:w-48 h-1 bg-brand-red rounded-full mt-3"></div>
                            </div>
                            <p className="text-center text-slate-600 text-sm sm:text-lg mb-8">Veuillez vous déconnecter pour accéder à un autre compte.</p>
                            <div className="flex justify-center">
                                <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="w-full sm:w-auto px-10 py-3 sm:py-4 bg-brand-dark text-white font-extrabold text-lg sm:text-xl rounded-xl shadow-lg hover:bg-slate-800 active:scale-95 transition-all">
                                    Se Déconnecter
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ---- ONGLET : TEMPLATES ---- */}
                    {activeTab === 'templates' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="flex flex-col items-center mb-8 text-center">
                                <FileText className="w-8 h-8 mr-3 text-brand-dark" />
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-dark mt-2">Modèles de SMS</h2>
                                <div className="w-24 sm:w-48 h-1 bg-brand-red rounded-full mt-3"></div>
                            </div>

                            <div className="max-w-lg mx-auto relative border-2 border-slate-200 rounded-3xl p-4 sm:p-6 mt-6 bg-slate-50">
                                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-brand-dark text-white px-6 py-1 rounded-full font-bold text-sm sm:text-lg whitespace-nowrap shadow-sm">
                                    Vos Messages
                                </div>
                                
                                <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto pr-2">
                                    {templates.map((tpl) => (
                                        <div key={tpl.idTemplate} className="flex justify-between items-center border border-slate-300 rounded-xl px-4 sm:px-6 py-3 bg-white shadow-sm gap-2">
                                            <span className="font-bold text-sm sm:text-lg text-brand-dark truncate">{tpl.templateName}</span>
                                            <div className="flex space-x-2 shrink-0">
                                                <button onClick={() => { setEditingTemplate(tpl); setModelName(tpl.templateName); setMessageContent(tpl.messageContent); setIsModalOpen(true); setConfirmDeleteId(null); }} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center active:scale-95">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setConfirmDeleteId(tpl.idTemplate)} className="w-8 h-8 rounded-lg bg-red-50 text-brand-red flex items-center justify-center active:scale-95">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {templates.length === 0 && <p className="text-center text-slate-500 py-4 italic">Aucun modèle créé.</p>}
                                </div>

                                {confirmDeleteId && (
                                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                                        <p className="text-sm font-bold text-red-700 mb-3">Supprimer ce modèle ?</p>
                                        <div className="flex items-center gap-2">
                                            <button onClick={handleDeleteTemplate} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-sm">Oui</button>
                                            <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 bg-white text-brand-dark border border-slate-300 rounded-lg font-bold text-sm">Non</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-center pt-8">
                                <button onClick={() => { setEditingTemplate(null); setModelName(''); setMessageContent(''); setIsModalOpen(true); }} className="w-full sm:w-auto px-8 py-3 sm:py-4 bg-brand-dark text-white font-extrabold text-lg rounded-xl shadow-sm hover:bg-slate-800 active:scale-95 transition-all">
                                    Nouveau Modèle
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ================= MODAL : NOUVEAU MODÈLE ================= */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl p-5 sm:p-8 relative animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        
                        <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 pb-4">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark">
                                {editingTemplate ? 'Modifier le Modèle' : 'Nouveau Modèle'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 bg-slate-100 hover:bg-slate-200 p-2 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 pr-1">
                            <div className="mb-6">
                                <label className="block text-sm sm:text-lg font-bold text-brand-dark mb-2">Nom du Modèle</label>
                                <input type="text" value={modelName} onChange={e => setModelName(e.target.value)} placeholder="Ex: Rappel 24h avant" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-brand-dark focus:ring-2 focus:ring-brand-red/20 outline-none" />
                            </div>

                            <div className="flex flex-col md:flex-row gap-6 mb-4">
                                {/* Zone de texte */}
                                <div className={`flex-1 relative border-[2px] rounded-xl p-4 sm:p-6 mt-4 ${dragOverField ? 'bg-slate-50 border-dashed border-brand-red' : 'border-slate-300'}`} onDragOver={e => { e.preventDefault(); setDragOverField(true); }} onDragLeave={() => setDragOverField(false)} onDrop={e => { e.preventDefault(); const field = e.dataTransfer.getData('text/plain'); if (field) setMessageContent(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}{${field}} `); setDragOverField(false); }}>
                                    <div className="absolute -top-3 left-4 bg-white px-2 font-bold text-sm text-brand-dark">Message</div>
                                    <div className="text-slate-400 text-xs sm:text-sm italic mb-3">Glissez ou cliquez sur un champ à droite pour l'insérer.</div>
                                    <textarea value={messageContent} onChange={e => setMessageContent(e.target.value)} className="w-full h-32 sm:h-40 resize-none outline-none text-base sm:text-lg text-slate-700 bg-transparent leading-relaxed" placeholder="Bonjour {Prenom}, votre rendez-vous est prévu le {Date} à {Heure}"></textarea>
                                </div>

                                {/* Variables dynamiques */}
                                <div className="w-full md:w-1/3 relative border-[2px] border-slate-200 rounded-xl p-4 mt-4 bg-slate-50">
                                    <div className="absolute -top-3 left-4 bg-slate-50 px-2 font-bold text-sm text-brand-dark">Champs</div>
                                    <p className="text-[10px] text-slate-400 mb-3 italic">Cliquez pour insérer</p>
                                    <div className="flex flex-wrap gap-2">
                                        {fields.map((field) => (
                                            <div key={field} onClick={() => setMessageContent(prev => prev + '{' + field + '} ')} className="bg-rose-100 border border-rose-200 text-brand-red px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer hover:bg-brand-red hover:text-white transition-colors shadow-sm select-none" draggable onDragStart={e => e.dataTransfer.setData('text/plain', field)}>
                                                {field}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100 mt-4 shrink-0">
                            <button onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 text-slate-600 font-bold text-sm sm:text-base rounded-xl hover:bg-slate-200 transition-all">
                                Annuler
                            </button>
                            <button onClick={handleSaveTemplate} className="w-full sm:w-auto px-6 py-2.5 bg-brand-red text-white font-bold text-sm sm:text-base rounded-xl shadow-md hover:bg-rose-700 active:scale-95 transition-all">
                                {editingTemplate ? 'Mettre à jour' : 'Créer le Modèle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= MODAL : CHANGER LE MOT DE PASSE ================= */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-8 relative animate-in zoom-in duration-200 border-2 border-rose-100">
                        <div className="flex flex-col items-center mb-6 relative">
                            <button onClick={() => setIsPasswordModalOpen(false)} className="absolute right-0 top-0 text-slate-400 hover:text-brand-red">
                                <X className="w-6 h-6" />
                            </button>
                            <h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark mb-2 text-center">Sécurité</h2>
                            <div className="w-16 h-1 bg-brand-red rounded-full"></div>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-brand-dark mb-1">Ancien mot de passe</label>
                                <div className="relative">
                                    <input type={showOldPwd ? "text" : "password"} required value={passwords.old} onChange={e => setPasswords({...passwords, old: e.target.value})} className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-red/20 outline-none" />
                                    <button type="button" onClick={() => setShowOldPwd(!showOldPwd)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                                        {showOldPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-dark mb-1">Nouveau mot de passe</label>
                                <div className="relative">
                                    <input type={showNewPwd ? "text" : "password"} required value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-red/20 outline-none" />
                                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                                        {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-dark mb-1">Confirmer</label>
                                <div className="relative">
                                    <input type={showConfPwd ? "text" : "password"} required value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-red/20 outline-none" />
                                    <button type="button" onClick={() => setShowConfPwd(!showConfPwd)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                                        {showConfPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button type="submit" className="w-full py-3 bg-brand-red text-white font-bold rounded-xl shadow-md hover:bg-rose-700 active:scale-95 transition-all">
                                    Mettre à jour
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Parametres;