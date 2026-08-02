import React, { useState, useEffect } from 'react';
import { Search, Plus, User, Phone, Edit2, Trash2, X } from 'lucide-react';
import { fetchWithAuth } from '../services/api';
import 'react-phone-number-input/style.css'; 
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';

const Contacts = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [editingContactId, setEditingContactId] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    // État pour les champs du formulaire
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: ''
    });

    // Charger les contacts à l'affichage de la page
    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        try {
            const response = await fetchWithAuth(`/api/Contacts`);
            if (response.ok) {
                const data = await response.json();
                const mappedContacts = data.map(c => ({
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

        // 🛡️ BARRAGE FRONTEND : Vérification du numéro de téléphone !
        if (!formData.phoneNumber || !isValidPhoneNumber(formData.phoneNumber)) {
        return alert("Erreur : Le numéro de téléphone est invalide pour le pays sélectionné.");
        }

        // 🛡️ Vérification des doublons (côté Front pour éviter un appel API inutile)
        const isDuplicate = contacts.some(c => c.phone === formData.phoneNumber && c.id !== editingContactId);
        if (isDuplicate) {
        return alert("Erreur : Ce numéro de téléphone existe déjà dans vos contacts !");
        }

        const payload = {
            idUser: parseInt(userId),
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: formData.phoneNumber, 
            email: formData.email
            };

        try {
            let response;
            if (editingContactId) {
                // Modification d'un contact existant
                payload.idContact = editingContactId;
                response = await fetchWithAuth(`/api/Contacts/${editingContactId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            } else {
                // Ajout d'un nouveau contact
                response = await fetchWithAuth('/api/Contacts', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            if (response.ok) {
                setIsModalOpen(false);
                setEditingContactId(null);
                setFormData({ firstName: '', lastName: '', phoneNumber: '', email: '' });
                loadContacts(); // Recharger la liste
            } else {
                console.error("Erreur lors de la sauvegarde du contact");
            }
        } catch (error) {
            console.error("Erreur réseau :", error);
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
                loadContacts(); // Recharger la liste
            } else {
                console.error("Erreur de suppression");
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
        phoneNumber: contact.phone, // 👈 C'est direct !
        email: contact.email || ''
        });
        setIsModalOpen(true);
    };

    // Filtrer les contacts en fonction de la recherche
    const filteredContacts = contacts.filter(c =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 bg-slate-50 h-screen flex flex-col overflow-hidden">
            {/* En-tête */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <User className="text-blue-600" /> Vos Contacts
                </h1>
                <button
                    onClick={() => {
                        setEditingContactId(null);
                        setFormData({ firstName: '', lastName: '', phoneNumber: '', email: '' });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center bg-brand-red hover:bg-rose-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md shadow-brand-red/20 transition-all active:scale-95"
                >
                    <Plus size={20} /> Ajouter un contact
                </button>
            </div>

            {/* Barre de recherche */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Rechercher un contact..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Liste des contacts */}
            <div className="bg-white rounded-xl shadow border border-slate-100 flex-1 overflow-y-auto relative">
                {filteredContacts.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        Aucun contact trouvé.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-semibold text-sm">
                                <th className="p-4">Nom complet</th>
                                <th className="p-4">Téléphone</th>
                                <th className="p-4">Email</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredContacts.map((contact) => (
                                <tr key={contact.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 font-medium text-slate-800">
                                        {contact.firstName} {contact.lastName}
                                    </td>
                                    <td className="p-4 text-slate-600">{contact.phone}</td>
                                    <td className="p-4 text-slate-600">{contact.email || '-'}</td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button
                                            onClick={() => handleEditClick(contact)}
                                            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors"
                                            title="Modifier"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteId(contact.id)}
                                            className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal Ajouter / Modifier */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">


                        {/* Header du Modal */}
                        <div className="flex flex-col items-center pt-8 pb-4 relative">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="absolute right-6 top-6 text-slate-400 hover:text-slate-600">
                            <X className="w-6 h-6" />
                            </button>
                            <h2 className="text-3xl font-extrabold text-brand-dark mb-2">
                            {editingContactId ? 'Modifier le Client' : 'Ajouter un Client'}
                            </h2>
                            <div className="w-32 h-1 bg-brand-red rounded-full"></div>
                        </div>

                         {/* Corps du Formulaire */}
                        <form onSubmit={handleSaveContact} className="p-8 space-y-5">
                            
                            {/* LIGNE 1 : Nom et Prénom (Côté à côte) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                <label className="block text-sm font-bold text-brand-dark mb-1 ml-2">Nom</label>
                                <input type="text" required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} placeholder="Nom de famille" className="w-full px-4 py-2 border border-slate-300 rounded-full text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none" />
                                </div>
                                <div>
                                <label className="block text-sm font-bold text-brand-dark mb-1 ml-2">Prénom</label>
                                <input type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} placeholder="Prénom" className="w-full px-4 py-2 border border-slate-300 rounded-full text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none" />
                                </div>
                            </div>

                            {/* LIGNE 2 : Téléphone (Pleine largeur avec beau composant) */}
                            <div>
                                <label className="block text-sm font-bold text-brand-dark mb-1 ml-2">Téléphone</label>
                                <PhoneInput
                                international
                                defaultCountry="TG" /* Togo par défaut ! */
                                value={formData.phoneNumber}
                                onChange={value => setFormData({ ...formData, phoneNumber: value })}
                                error={formData.phoneNumber ? (formData.phoneNumber.length < 10 ? 'Numéro invalide' : undefined) : 'Numéro requis'}
                                />
                            </div>

                            {/* LIGNE 3 : Email (Pleine largeur) */}
                            <div>
                                <label className="block text-sm font-bold text-brand-dark mb-1 ml-2">Email <span className="text-slate-400 font-normal">(Optionnel)</span></label>
                                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="ex: nom@gmail.com" className="w-full px-4 py-2 border border-slate-300 rounded-full text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none" />
                            </div>

                            {/* BOUTON VALIDATION */}
                            <div className="flex justify-center pt-4">
                                <button type="submit" className="px-8 py-2.5 bg-white border-2 border-slate-200 hover:border-slate-300 text-brand-dark font-bold text-lg rounded-full flex items-center shadow-sm transition-all active:scale-95">
                                <span className="text-green-500 mr-2 text-xl">✓</span> 
                                {editingContactId ? 'Mettre à jour' : 'Enregistrer'}
                                </button>
                            </div>
                            </form>
        
                        
                    </div>
                </div>
            )}

            {/* Modal Confirmation de suppression */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression</h3>
                        <p className="text-slate-600 mb-6">Voulez-vous vraiment supprimer ce contact ? Cette action est définitive.</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleDeleteContact}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow"
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