import React, { useState, useEffect } from 'react';
import { BASE_URL } from '../services/api';
import 'react-phone-number-input/style.css'; 
import PhoneInput from 'react-phone-number-input';

const KioskCheckin = () => {
    const [telephone, setTelephone] = useState('');
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [cabinetId, setCabinetId] = useState(null);

    React.useEffect(() => {
        // Récupère l'identifiant du cabinet depuis l'URL.
        const pathParts = window.location.pathname.split('/');
        const idFromUrl = pathParts[pathParts.length - 1];
        setCabinetId(idFromUrl);
    }, []); 



    const handleCheckin = async (e) => {
        e.preventDefault();
        
        if (!telephone) {
            setError("Veuillez saisir un numéro valide.");
            return;
        }

        if (!cabinetId) {
            setError("ID du cabinet introuvable. Veuillez vérifier l'URL.");
            return;
        }

        setLoading(true);
        setMessage(null);
        setError(null);

        try {
        const response = await fetch(`${BASE_URL}/api/Events/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
            telephone: telephone, 
            userId: cabinetId 
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.Message || "Erreur lors de l'enregistrement"); 
        }
        
        setMessage(data.message || data.Message);
        setTelephone('');

        } catch (err) {
        setError(err.message || "Une erreur est survenue. Veuillez réessayer.");
        } finally {
        setLoading(false);
        }
    };

    // Réinitialise l'écran et revient au formulaire.
    const handleRetry = () => {
        setError(null);
        setTelephone('');
    };

    // Tente de fermer l'onglet; à défaut, redirige vers une page vide.
    const handleQuit = () => {
        window.close(); // Ferme l'onglet si le navigateur l'autorise
        window.location.href = "about:blank"; // Fallback
    };

    return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 font-sans">
            <div className="bg-white p-10 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-100 animate-in zoom-in duration-300">
                
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-brand-dark mb-2">
                        Digi<span className="text-brand-red">Alert</span>
                    </h1>
                    <p className="text-slate-500 font-medium">Enregistrement en salle d'attente</p>
                </div>

                {/* Écran de confirmation. */}
                {message ? (
                    <div className="bg-emerald-50 text-emerald-600 p-6 rounded-xl text-center border border-emerald-100 animate-in fade-in">
                        <div className="text-4xl mb-3">✅</div>
                        <p className="font-bold text-lg">{message}</p>
                        <button 
                            onClick={() => setMessage(null)}
                            className="mt-6 text-sm text-emerald-700 hover:underline font-medium"
                        >
                            Enregistrer un autre patient
                        </button>
                    </div>

                /* Écran d'erreur lorsqu'aucun rendez-vous n'est trouvé. */
                ) : error ? (
                    <div className="bg-rose-50 text-brand-red p-6 rounded-xl text-center border border-rose-200 animate-in fade-in">
                        <div className="text-4xl mb-3">⚠️</div>
                        <p className="font-bold text-lg mb-2">{error}</p>
                        <p className="text-sm text-rose-700 mb-6">
                            Si vous pensez qu'il s'agit d'une erreur, veuillez vous adresser directement au secrétariat.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleRetry}
                                className="w-full px-4 py-3 bg-white text-brand-red border-2 border-rose-200 hover:bg-rose-100 font-bold rounded-xl transition-colors"
                            >
                                Réessayer
                            </button>
                            <button 
                                onClick={handleQuit}
                                className="w-full px-4 py-3 bg-brand-red text-white font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-md"
                            >
                                Quitter la page
                            </button>
                        </div>
                    </div>

                /* Écran principal avec le formulaire. */
                ) : (
                    <form onSubmit={handleCheckin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-brand-dark mb-2">
                                Votre numéro de téléphone
                            </label>
                            
                            <div className="border border-slate-300 rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-brand-red/20 focus-within:border-brand-red transition-all bg-slate-50">
                                <PhoneInput
                                    international
                                    defaultCountry="TG"
                                    value={telephone}
                                    onChange={setTelephone}
                                    className="w-full outline-none bg-transparent text-lg font-medium text-slate-800"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-brand-dark hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-95 flex justify-center mt-4 disabled:bg-slate-400"
                        >
                            {loading ? 'Vérification en cours...' : "Signaler mon arrivée"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default KioskCheckin;