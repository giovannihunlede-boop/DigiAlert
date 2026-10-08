import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Calendar as CalendarIcon, Check, X, Plus, Clock, User, Search, Mail, Edit2, Trash2, Upload, Download } from 'lucide-react';
import { fetchWithAuth } from '../services/api';
import 'react-phone-number-input/style.css'; 
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';

const Contacts = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [editingContactId, setEditingContactId] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: ''
    });

    // --- GESTION DE L'IMPORT ---
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.csv')) {
        alert("Veuillez sélectionner un fichier CSV.");
        return;
        }

        setIsImporting(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
        // On récupère le token manuellement
        const token = localStorage.getItem('jwtToken');
        
        // On utilise fetch() nativement pour éviter que fetchWithAuth n'ajoute "application/json"
        const response = await fetch('/api/Contacts/import', {
            method: 'POST',
            headers: {
            'Authorization': `Bearer ${token}`
            // IMPORTANT: Surtout pas de Content-Type ici, le navigateur le gère tout seul avec FormData !
            },
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            alert(result.message);
            loadContacts(); // Rafraîchit la liste
        } else {
            const errorData = await response.json().catch(() => ({}));
            alert(`Erreur lors de l'import: ${errorData.message || "Fichier invalide ou problème serveur."}`);
        }
        } catch (error) {
        console.error("Erreur d'import:", error);
        alert("Erreur réseau pendant l'importation.");
        } finally {
        setIsImporting(false);
        e.target.value = ''; // Réinitialise l'input
        }
    };

    useEffect(() => {
        setPage(1);
    }, [searchQuery]);
    useEffect(() => {
        const timer = setTimeout(() => {
            loadContacts();
        }, 300); 
        return () => clearTimeout(timer);
    }, [page, searchQuery]);

    const loadContacts = async () => {
        try {
            const response = await fetchWithAuth(`/api/Contacts?page=${page}&pageSize=50&search=${encodeURIComponent(searchQuery)}`);
            if (response.ok) {
                const data = await response.json();
                setTotalPages(Math.ceil(data.totalCount / 50));
                const mappedContacts = data.contacts.map(c => ({
                    id: c.idContact,
                    firstName: c.firstName,
                    lastName: c.lastName || '',
                    phone: c.phoneNumber,
                    email: c.email || '',
                    lastRdvDate: 'N/A',
                    lastRdvTitle: '-'
                }));
                setContacts(mappedContacts);
            }
        } catch (error) {
            console.error("Erreur lors du chargement des contacts :", error);
        }
    };

    const handleSaveContact = async (e) => {
        e.preventDefault();
        const userId = localStorage.getItem('userId');
        if (!userId) return;

        if (!formData.phoneNumber || !isValidPhoneNumber(formData.phoneNumber)) {
            return alert("Erreur : Le numéro de téléphone est invalide pour le pays sélectionné.");
        }

        const isDuplicate = contacts.some(c => c.phone === formData.phoneNumber && c.id !== editingContactId);
        if (isDuplicate) {
            return alert("Erreur : Ce numéro de téléphone existe déjà dans vos contacts !");
        }

        const payload = {
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: formData.phoneNumber,
            email: formData.email,
            userId: userId
        };

        try {
            let response;
            if (editingContactId) {
                response = await fetchWithAuth(`/api/Contacts/${editingContactId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await fetchWithAuth(`/api/Contacts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (response.ok) {
                setIsModalOpen(false);
                setFormData({ firstName: '', lastName: '', phoneNumber: '', email: '' });
                setEditingContactId(null);
                loadContacts(); 
            } else {
                const errorData = await response.json().catch(() => ({}));
                let userGuidance = "Impossible d'enregistrer le contact.";

                switch (response.status) {
                    case 400: userGuidance = "Veuillez vérifier les informations saisies."; break;
                    case 401: userGuidance = "Votre session a expiré."; break;
                    case 409: userGuidance = "Un contact avec cet email ou ce numéro existe déjà."; break;
                    case 500: userGuidance = "Problème interne du serveur."; break;
                    default: break;
                }

                alert(`Erreur : ${errorData.message || userGuidance}`);
            }
        } catch (error) {
            console.error("Erreur réseau :", error);
            alert("Problème de connexion au serveur.");
        }
    };

    const handleDeleteContact = async () => {
        if (!confirmDeleteId) return;

        try {
            const response = await fetchWithAuth(`/api/Contacts/${confirmDeleteId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setConfirmDeleteId(null);
                loadContacts(); 
            }
        } catch (error) {
            console.error("Erreur réseau de suppression :", error);
        }
    };

    const handleEditClick = (contact) => {
        setEditingContactId(contact.id);
        setFormData({
            firstName: contact.firstName,
            lastName: contact.lastName,
            phoneNumber: contact.phone,
            email: contact.email || ''
        });
        setIsModalOpen(true);
    };

    

    return (
        <div className="p-4 md:p-6 bg-slate-50 h-screen flex flex-col overflow-hidden">
            {/* En-tête adaptable aux petits écrans. */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <User className="text-blue-600" /> Vos Contacts
          </h1>
          
          {/* Conteneur des boutons */}
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
            
            {/* Input fichier caché */}
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />

            {/* Bouton Importer CSV */}
            <button
              onClick={() => fileInputRef.current.click()}
              disabled={isImporting}
              className="w-full sm:w-auto flex items-center justify-center bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
              title="Le CSV doit contenir 4 colonnes: Prénom, Nom, Téléphone, Email"
            >
              <Upload size={20} className="mr-2" /> 
              {isImporting ? 'Importation...' : 'Importer CSV'}
            </button>

            {/* Bouton Ajouter Classique */}
            <button
              onClick={() => {
                setEditingContactId(null);
                setFormData({ firstName: '', lastName: '', phoneNumber: '', email: '' });
                setIsModalOpen(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center bg-brand-red hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-brand-red/20 transition-all active:scale-95"
            >
              <Plus size={20} className="mr-1" /> Ajouter
            </button>
          </div>
        </div>

            {/* Barre de recherche */}
            <div className="relative mb-6 shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Rechercher un contact..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red shadow-sm"
                />
            </div>

            {/* Liste des contacts */}
            <div className="bg-transparent sm:bg-white sm:rounded-2xl sm:shadow-sm sm:border border-slate-100 flex-1 overflow-hidden flex flex-col">
                
                {contacts.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 font-medium italic bg-white rounded-2xl">
                        Aucun contact trouvé.
                    </div>
                ) : (
                    <div className="overflow-y-auto sm:overflow-x-auto flex-1 pb-4 sm:pb-0 h-full">
                        
                        {/* Vue ordinateur */}
                        <table className="hidden sm:table w-full text-left border-collapse min-w-[600px]">
                            <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
                                <tr className="border-b border-slate-200 text-brand-dark font-bold text-sm">
                                    <th className="p-4 pl-6">Nom complet</th>
                                    <th className="p-4">Téléphone</th>
                                    <th className="p-4">Email</th>
                                    <th className="p-4 text-right pr-6">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contacts.map((contact) => (
                                    <tr key={contact.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 pl-6 font-bold text-slate-800">
                                            {contact.firstName} {contact.lastName}
                                        </td>
                                        <td className="p-4 text-slate-600 font-medium">{contact.phone}</td>
                                        <td className="p-4 text-slate-500">{contact.email || '-'}</td>
                                        <td className="p-4 pr-6 text-right flex justify-end gap-2">
                                            <button onClick={() => handleEditClick(contact)} className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Modifier">
                                                <Edit2 size={18} />
                                            </button>
                                            <button onClick={() => setConfirmDeleteId(contact.id)} className="p-2 hover:bg-red-50 text-brand-red rounded-lg transition-colors border border-transparent hover:border-red-100" title="Supprimer">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Vue mobile. */}
                        <div className="sm:hidden flex flex-col gap-3">
                            {contacts.map((contact) => (
                                <div key={contact.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative">
                                    {/* Actions du contact. */}
                                    <div className="absolute top-4 right-4 flex gap-1">
                                        <button onClick={() => handleEditClick(contact)} className="p-2 bg-slate-50 hover:bg-blue-50 text-blue-500 rounded-lg transition-colors">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => setConfirmDeleteId(contact.id)} className="p-2 bg-rose-50 hover:bg-red-100 text-brand-red rounded-lg transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    
                                    {/* Informations du contact. */}
                                    <div className="pr-20"> 
                                        <h3 className="font-extrabold text-brand-dark text-lg mb-1 leading-tight">
                                            {contact.firstName} {contact.lastName}
                                        </h3>
                                        <div className="flex flex-col gap-1 mt-2">
                                            <span className="text-slate-600 font-medium text-sm bg-slate-50 w-max px-2 py-1 rounded-md">
                                                📞 {contact.phone}
                                            </span>
                                            {contact.email && (
                                                <span className="text-slate-500 text-sm px-2 py-1 truncate">
                                                    ✉️ {contact.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                )}
            </div>

            {/* Fenêtre d'ajout ou de modification. */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                        
                        {/* Header du Modale*/}
                        <div className="flex justify-between items-center p-6 bg-slate-50 border-b border-slate-100 shrink-0">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark">
                                {editingContactId ? 'Modifier le Client' : 'Ajouter un Client'}
                            </h2>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-500 bg-slate-200 hover:bg-slate-300 hover:text-brand-red transition-colors p-2 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Corps du formulaire */}
                        <div className="overflow-y-auto p-6 flex-1">
                            <form id="contact-form" onSubmit={handleSaveContact} className="space-y-5">
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-brand-dark mb-1 pl-2">Nom</label>
                                        <input type="text" required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} placeholder="Nom de famille" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none shadow-sm transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-brand-dark mb-1 pl-2">Prénom</label>
                                        <input type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} placeholder="Prénom" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none shadow-sm transition-all" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-brand-dark mb-1 pl-2">Téléphone</label>
                                    
                                    <div className="[&>.PhoneInput]:flex [&>.PhoneInput]:items-center [&>.PhoneInput]:gap-2 [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:px-4 [&_.PhoneInputInput]:py-2.5 [&_.PhoneInputInput]:border [&_.PhoneInputInput]:border-slate-300 [&_.PhoneInputInput]:rounded-xl [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:focus:ring-2 [&_.PhoneInputInput]:focus:ring-brand-red/20 [&_.PhoneInputInput]:focus:border-brand-red [&_.PhoneInputInput]:shadow-sm [&_.PhoneInputCountry]:bg-slate-50 [&_.PhoneInputCountry]:border [&_.PhoneInputCountry]:border-slate-300 [&_.PhoneInputCountry]:rounded-xl [&_.PhoneInputCountry]:px-3 [&_.PhoneInputCountry]:py-2.5">
                                        <PhoneInput
                                            international
                                            defaultCountry="TG"
                                            value={formData.phoneNumber}
                                            onChange={value => setFormData({ ...formData, phoneNumber: value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-brand-dark mb-1 pl-2">
                                        Email <span className="text-slate-400 font-normal">(Optionnel)</span>
                                    </label>
                                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="ex: nom@gmail.com" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none shadow-sm transition-all" />
                                </div>
                                {totalPages > 1 && (
                                    <div className="flex justify-between items-center p-4 border-t border-slate-100 bg-slate-50 mt-auto">
                                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50 font-bold text-sm shadow-sm transition-all">
                                            Précédent
                                        </button>
                                        <span className="text-sm font-bold text-slate-600">
                                            Page {page} sur {totalPages}
                                        </span>
                                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50 font-bold text-sm shadow-sm transition-all">
                                            Suivant
                                        </button>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center shrink-0">
                            <button type="submit" form="contact-form" className="w-full sm:w-auto px-8 py-3 bg-brand-dark hover:bg-slate-800 text-white font-bold text-base rounded-xl shadow-md transition-all active:scale-95">
                                {editingContactId ? 'Mettre à jour' : 'Enregistrer'}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* Fenêtre de confirmation */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in duration-200 border-2 border-rose-100">
                        <h3 className="text-xl font-extrabold text-brand-dark mb-2 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-brand-red animate-pulse shrink-0"></span>
                            Supprimer ce contact ?
                        </h3>
                        <p className="text-slate-600 mb-6 text-sm">Voulez-vous vraiment supprimer ce contact ? Cette action est définitive.</p>
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleDeleteContact}
                                className="w-full sm:w-auto px-5 py-2.5 bg-brand-red hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
                            >
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;