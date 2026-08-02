import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, Calendar as CalendarIcon, Check, X, Plus } from 'lucide-react';
import { fetchWithAuth } from '../services/api';
import { Trash2 } from 'lucide-react';




const NouveauRdv = () => {
  // États pour gérer l'ouverture des 3 Pop-ups
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const [editEventId, setEditEventId] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const location = useLocation();

// --- VARIABLES POUR BLOQUER LE PASSÉ ---
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentTimeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  // Fonction magique qui vérifie si une date+heure est bien dans le futur !
  const isFuture = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return false;
    // On rajoute 1 minute de marge pour éviter que l'utilisateur soit bloqué s'il valide à la seconde près
    return new Date(`${dateStr}T${timeStr}:00`).getTime() > (new Date().getTime() - 60000); 
  };

  useEffect(() => {
    const fetchEditData = async () => {
      if (location.state && location.state.editEventId) {
        const eventId = location.state.editEventId;
        setEditEventId(eventId);
        
        try {
          const resEvt = await fetchWithAuth('/api/Events');
          
          // On essaie de récupérer les rappels
          let resReminders = await fetchWithAuth('/api/Reminders/all');
          if (!resReminders.ok) resReminders = await fetchWithAuth('/api/Reminders');

          if (resEvt.ok) {
            const events = await resEvt.json();
            const myEvent = events.find(e => (e.idEvent || e.IdEvent) === eventId);
            
            if (myEvent) {
              // 1. Récupération des clients associés à cet événement
              const resContacts = await fetchWithAuth('/api/Contacts');
              let eventClients = [];
              if (resContacts.ok) {
                const allContacts = await resContacts.json();
                eventClients = allContacts.filter(c => 
                  myEvent.participants && myEvent.participants.some(p => (p.idContact || p.IdContact) === (c.idContact || c.IdContact))
                );
              }

              // 2. Calcul des dates et durée
              const startStr = myEvent.startDateTime || myEvent.StartDateTime;
              const endStr = myEvent.endDateTime || myEvent.EndDateTime;
              const startDate = new Date(startStr);
              const endDate = new Date(endStr);
              
              let durationMins = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
              if (durationMins < 0) durationMins += (24 * 60); 

              // 3. Traitement des rappels
              let msgSMS = '';
              let loadedRappels = [];
              let isEmailActive = false;
              
              if (resReminders.ok) {
                const allReminders = await resReminders.json();
                
                // Si l'API ne renvoie pas IdEvent dans /all, on filtre par le titre de l'événement !
                const myReminders = allReminders.filter(r => 
                  (r.idEvent || r.IdEvent) === eventId || 
                  (r.eventTitle || r.EventTitle) === (myEvent.title || myEvent.Title)
                );
                
                // On sépare SMS et EMAIL
                const smsReminders = myReminders.filter(r => (r.channel || r.Channel || '').toUpperCase() !== 'EMAIL');
                const emailReminders = myReminders.filter(r => (r.channel || r.Channel || '').toUpperCase() === 'EMAIL');
                
                // Pré-remplir les SMS
                if (smsReminders.length > 0) {
                   msgSMS = smsReminders[0].messageText || smsReminders[0].MessageText || '';
                   const uniqueTimes = [...new Set(smsReminders.map(r => r.scheduledTime || r.ScheduledTime))];
                   loadedRappels = uniqueTimes.map(t => {
                      const d = new Date(t);
                      return { date: d.toISOString().split('T')[0], heure: d.toTimeString().substring(0, 5) };
                   });
                }

                // Pré-remplir les EMAILS pour le bouton checkbox
                if (emailReminders.length > 0) {
                   isEmailActive = true;
                }
              }

              // 4. Injection finale et parfaite dans le formulaire !
              setFormData(prev => ({
                ...prev,
                titre: myEvent.title || myEvent.Title || '',
                clients: eventClients, // 👈 Les clients sont bien conservés ici
                date: startDate.toISOString().split('T')[0],
                heure: startDate.toTimeString().substring(0, 5),
                duree: durationMins,
                messageSMS: msgSMS,
                rappels: loadedRappels, // 👈 La liste des rappels est rechargée
                emailEnabled: isEmailActive
              }));
            }
          }
        } catch (e) {
          console.error("Erreur de pré-remplissage :", e);
        }
      }
    };

    fetchEditData();
  }, [location.state]);
  
  // État des données du formulaire (pour le résumé de validation)
  const [formData, setFormData] = useState({
    titre: '',
    clients: [],
    date: '',
    heure: '',
    duree: '',
    dateFinRecurrence: '', 
    emailAddress: '',
    messageSMS: '',
    messageEmail: '',
    dateRappel: '',
    heureRappel: '',
    Récurrences: [],
    emailEnabled: true,
    recurrenceEnabled: false,
    rappels: [],
    
  });

  const [tempRappelDate, setTempRappelDate] = useState('');
  const [tempRappelHeure, setTempRappelHeure] = useState('');
  
  // 🛡️ MOTEUR DE VALIDATION UX EN TEMPS RÉEL
  const isCol1Valid = 
    formData.titre && formData.titre.trim() !== '' && 
    formData.clients.length > 0 && 
    formData.duree > 0 &&
    (
      // Soit c'est une récurrence, on a des dates, ET la date de fin est remplie
      (formData.recurrenceEnabled && formData.Récurrences?.length > 0 && formData.dateFinRecurrence !== '') 
      ||
      // Soit c'est normal, et on a une date et une heure
      (!formData.recurrenceEnabled && formData.date !== '' && formData.heure !== '')
    );
  // On récupère tous les clients qui ont une adresse email valide
  const validEmails = formData.clients.filter(c => {
    const mail = c.tempEmail !== undefined ? c.tempEmail : c.email;
    return mail && mail.trim() !== '';
  });

  const isCol2Valid = 
    formData.messageSMS.trim() !== '' && 
    formData.rappels?.length > 0 && 
    (!formData.emailEnabled || (
      // Si Email activé : Il faut au moins 1 client avec email, ET que chaque email ait un message !
      formData.emailEnabled && 
      validEmails.length > 0 &&
      validEmails.every(c => c.tempMessage && c.tempMessage.trim() !== '')
    ));
  const [dbContacts, setDbContacts] = useState([]);
  const [dbTemplates, setDbTemplates] = useState([]);

  useEffect(() => {
    const loadContacts = async () => {
      const res = await fetchWithAuth('/api/Contacts');
      if (res.ok) {
        const data = await res.json();
        setDbContacts(data);
      }
    };
    loadContacts();

    const loadData = async () => {
      // Charger les contacts
      const resContacts = await fetchWithAuth('/api/Contacts');
      if (resContacts.ok) setDbContacts(await resContacts.json());

      // Charger les modèles de SMS (Templates)
      const resTemplates = await fetchWithAuth('/api/SmsTemplates');
      if (resTemplates.ok) setDbTemplates(await resTemplates.json());
    };
    loadData();
  }, []);

  // Récurrence rows temporaires pour le modal
  const [RécurrenceRows, setRécurrenceRows] = useState([
    { id: 1, date: '', heure: '', repeat: 'Non' }
  ]);

  // Message modal selections
  const [selectedMsgId, setSelectedMsgId] = useState(1);
  const [msgFields, setMsgFields] = useState({ nom: '', prenom: '', date: '' });
  // Clients dropdown
  const AVAILABLE_CLIENTS = ['Dr. Koffi', 'M. Amida', 'Mme. Aminata'];
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const handleConfirm = async () => {

    // 1. VERIFICATION DE BASE (TRÈS IMPORTANT)
    if (!formData.titre || formData.clients.length === 0) {
      return alert("Veuillez donner un titre et sélectionner au moins un client.");
    }

    if (!formData.duree || parseInt(formData.duree) <= 0) {
      return alert("Veuillez entrer une durée valide (minimum 1 minute).");
    }

    // 2. MOTEUR DE GÉNÉRATION DES DATES
    let datesToProcess = [];

    if (formData.recurrenceEnabled && formData.Récurrences && formData.Récurrences.length > 0) {
      // 🛡️ BOUCLIER : Vérifier que la date de fin existe !
      if (!formData.dateFinRecurrence) {
        return alert("Veuillez définir une date de fin pour la récurrence.");
      }
      
      const limitDate = new Date(`${formData.dateFinRecurrence}T23:59:59`).getTime();

      try {
        formData.Récurrences.forEach(r => {
          if (!r.date || !r.heure) return;
          let currentDate = new Date(`${r.date}T${r.heure}:00`);

          // BARRAGE : La date de fin doit être supérieure à la date de début !
          if (limitDate <= currentDate.getTime()) {
            throw new Error(`Erreur: La date de fin (${formData.dateFinRecurrence}) doit être strictement après le ${r.date}.`);
          }

          // On ajoute la première occurrence
          datesToProcess.push(new Date(currentDate));

          // Si répétition demandée, on calcule et on crée les dates suivantes !
          if (r.repeat !== 'Non') {
            while (true) {
              if (r.repeat === 'Jour') currentDate.setDate(currentDate.getDate() + 1);
              else if (r.repeat === 'Semaine') currentDate.setDate(currentDate.getDate() + 7);
              else if (r.repeat === 'Mois') currentDate.setMonth(currentDate.getMonth() + 1);
              else if (r.repeat === 'Personnaliser') {
                const interval = parseInt(r.customInterval) || 1;
                if (r.customFreq === 'Jour(s)') currentDate.setDate(currentDate.getDate() + interval);
                else if (r.customFreq === 'Semaine(s)') currentDate.setDate(currentDate.getDate() + (interval * 7));
                else if (r.customFreq === 'Mois') currentDate.setMonth(currentDate.getMonth() + interval);
              }

              // On arrête la boucle si on a dépassé la limite de fin
              if (currentDate.getTime() > limitDate) break;
              
              // Sinon on ajoute la date clonée à la liste d'envoi
              datesToProcess.push(new Date(currentDate));
            }
          }
        });
      } catch (e) {
        return alert(e.message); // Stoppe l'envoi et affiche l'erreur à l'utilisateur
      }
    } else {
      // Cas classique : un seul événement
      if (!formData.date || !formData.heure) {
          return alert("Veuillez définir la date et l'heure du rendez-vous.");
      }
      const singleDate = new Date(`${formData.date}T${formData.heure}:00`);
      if (singleDate.getTime() <= new Date().getTime() && !editEventId) { 
        return alert("Erreur : La date du rendez-vous ne peut pas être dans le passé !");
      }
      datesToProcess = [singleDate];
    }

    setIsSubmitting(true);

    try {

      // Sécurité : on empêche de dupliquer un événement qu'on modifie !
      if (isUpdate && datesToProcess.length > 1) {
         throw new Error("Vous ne pouvez pas transformer un événement unique existant en récurrence multiple.");
      }

      // 3. On boucle sur chaque date pour créer l'événement et ses rappels
      for (const startDate of datesToProcess) {
        
        // Sécurité : On ignore les dates dans le passé
        if (startDate.getTime() <= new Date().getTime()) {
          console.warn(`La date ${startDate.toLocaleString()} est dans le passé, ignorée.`);
          continue; 
        }

        const startDateTime = startDate.toISOString();
        const durationMins = formData.duree ? parseInt(formData.duree) : 45; // 🛡️ Sécurité sur la durée
        const endDateTime = new Date(startDate.getTime() + durationMins * 60000).toISOString();

        // A. Sauvegarde de l'Événement (Création POST ou Modification PUT)
        const isUpdate = editEventId !== null;

        if (isSubmitting) return;

        let finalRappels = [...(formData.rappels || [])];
        if (tempRappelDate && tempRappelHeure) {
          finalRappels.push({ date: tempRappelDate, heure: tempRappelHeure });
        }

        const url = isUpdate ? `/api/Events/${editEventId}` : '/api/Events';
        const method = isUpdate ? 'PUT' : 'POST';

        const evtRes = await fetchWithAuth(url, {
          method: method,
          body: JSON.stringify({
            title: formData.titre,
            startDateTime: startDateTime,
            endDateTime: endDateTime, // En PUT le C# attend EndDatetime, React gère ça
            endDatetime: endDateTime, // On envoie les 2 orthographes pour être sûr à 100% avec le backend
            startDatetime: startDateTime, 
            contactIds: formData.clients.map(c => c.idContact || c.IdContact || c.id).filter(id => id),
          }),
        });

        if (!evtRes.ok) {
           const errText = await evtRes.text();
           let errMsg = errText;
           try { 
               const errObj = JSON.parse(errText); 
               errMsg = errObj.message || errObj.Message || errObj.title || errText; 
           } catch(e){}
           throw new Error(`L'événement a été refusé : \n${errMsg}`);
        }
        
        // BINGO : On récupère proprement l'ID (En gérant les majuscules/minuscules)
        const evtData = await evtRes.json();
        const finalEventId = isUpdate ? editEventId : (evtData.idEvent || evtData.IdEvent);

        // CORRECTION ICI : On récupère idEvent en gérant les majuscules/minuscules
        const currentEventId = evtData.idEvent || evtData.IdEvent;

        // 🧠 ON DÉFINIT LA LISTE DES DATES DE RAPPELS ICI !
        // Si l'utilisateur a défini des rappels personnalisés on les prend, sinon on envoie à l'heure du RDV
        const rappelsList = (formData.rappels && formData.rappels.length > 0) 
            ? formData.rappels.map(r => new Date(`${r.date}T${r.heure}:00`).toISOString())
            : [startDateTime];

        // B. Création de la liste des rappels SMS PERSONNALISÉS
        if (formData.messageSMS && finalRappels && finalRappels.length > 0) {
          for (const rap of finalRappels) {
            const scheduledTime = new Date(`${rap.date}T${rap.heure}:00`).toISOString();
            
            for (const client of formData.clients) {
              const finalMessageSMS = formData.messageSMS
                .replace(/\{Prenom\}/gi, client.firstName || '').replace(/\{Nom\}/gi, client.lastName || '')
                .replace(/\{Nom\}/gi, client.lastName || '')
                .replace(/\{Date\}/gi, startDate.toLocaleDateString('fr-FR'))
                .replace(/\{Heure\}/gi, startDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}));

              const remRes = await fetchWithAuth('/api/Reminders', {
                method: 'POST',
                body: JSON.stringify({
                  idEvent: finalEventId,
                  contactIds: [client.idContact || client.IdContact || client.id],
                  scheduledTime: scheduledTime,
                  messageText: finalMessageSMS,
                  channel: "SMS" // 👈 FORCÉ EN SMS
                }),
              });
              

              if (!remRes.ok) {
                 const errText = await remRes.text();
                 let errMsg = errText;
                 try { 
                     const errObj = JSON.parse(errText); 
                     errMsg = errObj.message || errObj.Message || errObj.title || errText; 
                 } catch(e){}
                 throw new Error(`RDV enregistré, mais le rappel a échoué : \n${errMsg}`);
              }
            }
          }
        }

        // C. Création des rappels EMAIL (Si activé)
        if (formData.emailEnabled && formData.messageEmail && finalRappels && finalRappels.length > 0) {
          for (const rap of finalRappels) {
            const scheduledTime = new Date(`${rap.date}T${rap.heure}:00`).toISOString();

            for (const client of formData.clients) {
              // On vérifie que le client a bien un email ! Sinon on ignore.
              if (!client.email && !client.tempEmail && !formData.emailAddress) continue;

              const finalMessageEmail = formData.messageEmail
                .replace(/\{Prenom\}/gi, client.firstName || '').replace(/\{Nom\}/gi, client.lastName || '')
                .replace(/\{Nom\}/gi, client.lastName || '')
                .replace(/\{Date\}/gi, startDate.toLocaleDateString('fr-FR'))
                .replace(/\{Heure\}/gi, startDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}));

              const emailRes = await fetchWithAuth('/api/Reminders', {
                method: 'POST',
                body: JSON.stringify({
                  idEvent: finalEventId,
                  contactIds: [client.idContact || client.IdContact || client.id],
                  scheduledTime: scheduledTime,
                  messageText: finalMessageEmail,
                  channel: "EMAIL" // 👈 FORCÉ EN EMAIL !
                }),
              });

              if (!emailRes.ok) {
                const errText = await emailRes.text();
                let errMsg = errText;
                try { const errObj = JSON.parse(errText); errMsg = errObj.Message || errObj.title || JSON.stringify(errObj.errors); } catch(e){}
                console.warn(`Erreur Email pour ${client.firstName}: ${errMsg}`);
              }
            }
          }
        }

      } 

      // 4. Succès et Redirection (UNE FOIS LA BOUCLE TERMINÉE)
      setShowValidationModal(false);
      alert("RDV et Rappels enregistrés avec succès !");
      
      setFormData({ 
        titre: '', clients: [], date: '', heure: '', duree: 45,
        messageSMS: '', messageEmail: '', Récurrences: [], 
        emailEnabled: true, recurrenceEnabled: false, rappels: [], dateFinRecurrence: '' 
      });
      setTempRappelDate('');
      setTempRappelHeure('');
      
      window.location.href = '/agenda';

    } catch (error) {
      console.error(error);
      // 🚨 On affiche le VRAI message d'erreur à l'utilisateur, pas le message générique !
      alert(error.message || `Une erreur est survenue lors de l'enregistrement.\n\n${error.message}`);
    } finally {
      setIsSubmitting(false); // 👈 On débloque le bouton
    }
  };

// Fonction magique qui analyse le template et génère les champs dynamiques
  const handleTemplateClick = (tpl) => {
    // 1. On extrait tout ce qui est entre accolades (ex: ["{Prenom}", "{Nom}"])
    const extractedTags = tpl.messageContent.match(/\{([^}]+)\}/g) || [];
    const newFields = {};
    
    // 2. On pré-remplit intelligemment
    extractedTags.forEach(tag => {
      const cleanTag = tag.replace(/[{}]/g, ''); // Enlève les {}
      
      if (cleanTag.toLowerCase() === 'nom') {
        newFields[cleanTag] = formData.clients.length > 0 ? formData.clients[0].lastName || '' : '';
      } else if (cleanTag.toLowerCase() === 'prenom') {
        newFields[cleanTag] = formData.clients.length > 0 ? formData.clients[0].firstName || '' : '';
      } else if (cleanTag.toLowerCase() === 'date') {
        newFields[cleanTag] = formData.date || '';
      } else if (cleanTag.toLowerCase() === 'heure') {
        newFields[cleanTag] = formData.heure || '';
      } else {
        newFields[cleanTag] = ''; // Champ personnalisé (ex: {Motif})
      }
    });
    
    setMsgFields(newFields);
    setSelectedMsgId(tpl.idTemplate);
  };

  const isUpdate = editEventId !== null;

  return (
    <div id="page-nouveau-rdv" className="flex-1 flex flex-col overflow-y-auto p-10 bg-brand-bg relative scroll-smooth">

      {/* Conteneur Principal (Les 2 Colonnes) */}
      <div className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 p-8 flex flex-col md:flex-row gap-12">
        
        {/* ================= COLONNE GAUCHE (Infos RDV) ================= */}
        <div className="flex-1 space-y-6">

          {/* TITRE DE LA COLONNE 1 DYNAMIQUE */}
          <h2 className="text-2xl font-extrabold text-brand-dark mb-6 flex items-center border-b-2 border-slate-100 pb-4">
            <span className={`w-8 h-8 rounded-full inline-flex items-center justify-center mr-3 text-lg shadow-sm transition-colors duration-300 ${isCol1Valid ? 'bg-brand-red text-white' : 'bg-slate-200 text-slate-400'}`}>
              1
            </span> 
            Détails du Rendez-vous
          </h2>

          <div>
            <label className="block text-lg font-bold text-brand-dark mb-2">Titre</label>
            <input type="text" placeholder="Titre du Rappel" className="w-full px-4 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-brand-red/20 outline-none" value={formData.titre} onChange={e => setFormData({...formData, titre: e.target.value})} />
          </div>

          <div className="relative">
            <label className="block text-lg font-bold text-brand-dark mb-2">Client(s)</label>
            <div>
              {/* 🛡️ BOUTON VERROUILLÉ EN MODE UPDATE */}
              <button 
                type="button" 
                onClick={() => !isUpdate && setShowClientDropdown(!showClientDropdown)}
                className={`w-full text-left px-4 py-2 border border-slate-300 rounded-full flex justify-between items-center transition-all ${isUpdate ? 'bg-slate-100 cursor-not-allowed opacity-60' : 'bg-white hover:bg-slate-50'}`}
              >
                <span className="text-slate-700">
                  {formData.clients && formData.clients.length > 0 ? `${formData.clients.length} client(s) sélectionné(s)` : 'Sélectionner un client'}
                </span>
                {/* On cache la petite flèche si c'est verrouillé */}
                {!isUpdate && <span className="text-slate-400">▾</span>}
              </button>

              {showClientDropdown && !isUpdate && (
                <div className="absolute z-40 mt-2 w-full bg-white border rounded-lg shadow-md max-h-48 overflow-auto">
                    {dbContacts.map((c) => {
                    const fullName = `${c.firstName} ${c.lastName || ''}`.trim();
                    const exists = formData.clients.some(client => client.idContact === c.idContact);
                    
                    return (
                        <div key={c.idContact} className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center" 
                            onClick={() => {
                            if (!exists) setFormData({...formData, clients: [...formData.clients, c]});
                            setShowClientDropdown(false);
                            }}>
                        <span>{fullName}</span>
                        {exists ? <span className="text-sm text-brand-red font-bold">✓</span> : null}
                        </div>
                    );
                    })}
                    {dbContacts.length === 0 && <div className="p-4 text-slate-500 text-sm">Aucun contact trouvé. Allez en créer un !</div>}
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {formData.clients && formData.clients.map((c) => (
                <span key={c.idContact} className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-sm">
                    <span className="truncate max-w-[12rem]">{c.firstName} {c.lastName}</span>
                    {!isUpdate && (
                    <button type="button" 
                      onClick={() => { 
                        const copy = formData.clients.filter(x => (x.idContact || x.id) !== (c.idContact || c.id)); 
                        setFormData({...formData, clients: copy}); 
                      }} 
                      className="text-slate-500 hover:text-slate-700">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
                ))}
            </div>
          </div>
          
            {/* Ligne des Dates Simples */}
            <div className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-lg font-bold mb-2 ${formData.recurrenceEnabled ? 'text-slate-400' : 'text-brand-dark'}`}>Date</label>
                  <input 
                    type="date" 
                    min={todayStr} 
                    value={formData.date} 
                    onChange={e => setFormData({...formData, date: e.target.value})} 
                    disabled={formData.recurrenceEnabled} 
                    /* 🎨 MAGIE CSS : Si c'est dans le passé, on met la bordure et le fond en rouge ! */
                    className={`w-full px-4 py-2 border rounded-full outline-none transition-colors ${
                      formData.recurrenceEnabled 
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                        : (!isFuture(formData.date, formData.heure) && formData.date && formData.heure 
                            ? 'border-brand-red bg-red-50 text-brand-red focus:ring-2 focus:ring-brand-red/30' 
                            : 'border-slate-300 focus:ring-2 focus:ring-brand-red/20')
                    }`} 
                  />
                </div>
                <div>
                  <label className={`block text-lg font-bold mb-2 ${formData.recurrenceEnabled ? 'text-slate-400' : 'text-brand-dark'}`}>Heure</label>
                  <input 
                    type="time" 
                    min={formData.date === todayStr ? currentTimeStr : ""} 
                    value={formData.heure} 
                    onChange={e => setFormData({...formData, heure: e.target.value})} 
                    disabled={formData.recurrenceEnabled} 
                    className={`w-full px-4 py-2 border rounded-full outline-none transition-colors ${
                      formData.recurrenceEnabled 
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                        : (!isFuture(formData.date, formData.heure) && formData.date && formData.heure 
                            ? 'border-brand-red bg-red-50 text-brand-red focus:ring-2 focus:ring-brand-red/30' 
                            : 'border-slate-300 focus:ring-2 focus:ring-brand-red/20')
                    }`} 
                  />
                </div>
              </div>

              {/* Le champ Durée est maintenant LIBÉRÉ et toujours visible */}
              <div className="flex flex-col items-center mt-6 mb-4">
                <label className={`text-sm font-bold mb-2 ${!formData.duree ? 'text-brand-red' : 'text-brand-dark'}`}>
                  Durée (minutes)
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="1440" 
                  value={formData.duree || ''} 
                  onChange={e => setFormData({...formData, duree: parseInt(e.target.value) || 0})} 
                  className={`px-6 py-2 border rounded-full font-medium outline-none focus:ring-2 focus:ring-brand-red/20 shadow-sm w-32 text-center transition-colors ${
                    !formData.duree || formData.duree <= 0 
                    ? 'border-brand-red bg-red-50 text-brand-red' 
                    : 'border-slate-300 text-brand-dark focus:border-brand-red'
                  }`}
                />
              </div>

              {/* Message d'erreur bien positionné (Totalement indépendant) */}
              {!formData.recurrenceEnabled && formData.date && formData.heure && !isFuture(formData.date, formData.heure) && (
                <div className="mt-3 text-center text-sm font-bold text-brand-red animate-in fade-in flex items-center justify-center bg-red-50 py-2 rounded-lg border border-red-200">
                  ⚠ La date et l'heure doivent être dans le futur !
                </div>
              )}
            </div>

          {/* Nouveau BLOC RÉCURRENCE Activable */}
            <div className={`border border-slate-200 rounded-2xl p-6 relative mt-10 transition-all duration-300 ${!formData.recurrenceEnabled ? 'bg-slate-50' : 'bg-white'} ${isUpdate ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-brand-dark text-white px-6 py-1.5 rounded-full flex items-center space-x-3 shadow-md">
                <span className="font-bold">Récurrence ?</span>
                <input 
                  type="checkbox" 
                  checked={formData.recurrenceEnabled} 
                  onChange={e => setFormData({...formData, recurrenceEnabled: e.target.checked})} 
                  className="w-4 h-4 accent-brand-red cursor-pointer" 
                />
              </div>

              <div className={`mt-4 ${!formData.recurrenceEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex justify-center mb-4">
                  <button type="button" onClick={() => setShowRecurrenceModal(true)} className="px-6 py-2 bg-slate-100 text-brand-dark font-bold rounded-full hover:bg-slate-200 transition-all text-sm shadow-sm border border-slate-200">
                    + Ajouter des dates
                  </button>
                </div>
                
                {formData.Récurrences && formData.Récurrences.length > 0 ? (
                  <div className="space-y-3">
                    {formData.Récurrences.map((r, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 flex justify-between items-center group transition-colors hover:border-brand-red/30 shadow-sm">
                        {/* flex-1 garantit que le texte ne pousse pas la poubelle vers le bas */}
                        <div className="flex-1 pr-2">
                          <div className="text-sm font-bold text-brand-dark truncate">{idx+1}. {r.date || '—'} à {r.heure || '—'}</div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5">Répète : {r.repeat}</div>
                        </div>
                        
                        {/* shrink-0 garantit que la poubelle garde sa taille et reste parfaitement alignée */}
                        <button 
                          type="button"
                          onClick={() => {
                            const newRecurrences = formData.Récurrences.filter((_, i) => i !== idx);
                            setFormData({...formData, Récurrences: newRecurrences});
                          }}
                          className="p-2 text-slate-400 hover:bg-red-100 hover:text-brand-red rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          title="Supprimer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
              ) : (
                <div className="flex items-center justify-center h-28">
                  <span className="text-slate-400 font-bold">Pas de Récurrence Defini</span>
                </div>
              )}

              {/*Badge Date de fin qui dépasse en bas */}
              {formData.recurrenceEnabled && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-brand-dark text-white px-4 py-1.5 rounded-xl font-bold shadow-md flex flex-col items-center z-10">
                  <span className="text-xs mb-1 text-slate-300 uppercase tracking-wider">Date de fin</span>
                  <div className="flex items-center gap-2 bg-white/20 px-2 py-0.5 rounded-lg border border-slate-500">
                    <input 
                      type="date" 
                      min={todayStr}
                      value={formData.dateFinRecurrence} 
                      onChange={e => setFormData({...formData, dateFinRecurrence: e.target.value})} 
                      className="bg-transparent outline-none text-sm text-center text-white cursor-pointer" 
                    />
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Ligne Séparatrice Verticale */}
        <div className="hidden md:block w-px bg-brand-red opacity-30"></div>

        {/* ================= COLONNE DROITE (Automatisations) ================= */}
        <div className="flex-1 space-y-6">

          {/* TITRE DE LA COLONNE 2 DYNAMIQUE */}
          <h2 className="text-2xl font-extrabold text-brand-dark mb-6 flex items-center border-b-2 border-slate-100 pb-4">
            <span className={`w-8 h-8 rounded-full inline-flex items-center justify-center mr-3 text-lg shadow-sm transition-colors duration-300 ${isCol2Valid ? 'bg-brand-red text-white' : 'bg-slate-200 text-slate-400'}`}>
              2
            </span> 
            Programmation des Rappels
        </h2>
          
          {/* Bloc SMS */}
          <div className="border border-slate-200 rounded-2xl p-6 relative">
            <h3 className="flex items-center text-lg font-bold text-brand-dark absolute -top-3.5 left-4 bg-white px-2">
              <MessageSquare className="w-5 h-5 mr-2" /> Rappel SMS
            </h3>
            <textarea 
              placeholder="Message" 
              className="w-full h-24 mt-2 resize-none text-2xl text-slate-400 outline-none"
              onChange={e => setFormData({...formData, messageSMS: e.target.value})}
              value={formData.messageSMS}
            ></textarea>
            {/* 👈 LE MESSAGE INTELLIGENT POUR RASSURER L'UTILISATEUR */}
            {formData.clients.length > 1 && (formData.messageSMS.match(/\{Nom\}|\{Prenom\}/i)) && (
              <div className="mt-2 p-3 bg-rose-50 rounded-lg border border-red-100 flex items-start animate-in fade-in">
                 <span className="text-brand-red font-bold text-xs leading-snug">
                  Info : Vous avez sélectionné plusieurs clients. Les balises {"{Prenom}"} et {"{Nom}"} sont conservées ici, mais le serveur les remplacera automatiquement par le vrai nom de chaque patient lors de l'envoi !
                 </span>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button onClick={() => setShowMsgModal(true)} className="px-6 py-2 bg-brand-dark text-white font-bold rounded-full shadow-md hover:bg-slate-800 transition-all">
              Message Programmé ?
            </button>
          </div>

          {/* Bloc Email */}
          
          <div className="flex items-center space-x-3 mt-8 mb-4">
            <label className="font-bold text-brand-dark">Emails ?</label>
            <input type="checkbox" checked={formData.emailEnabled} onChange={e => setFormData({...formData, emailEnabled: e.target.checked})} className="w-5 h-5 accent-brand-red cursor-pointer" />
          </div>

          {formData.emailEnabled && formData.clients.length > 0 && (
            <div className="border border-slate-200 rounded-2xl p-6 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-brand-dark text-white px-6 py-1.5 rounded-full flex items-center shadow-md">
                <span className="font-bold">Emails Personnalisés</span>
              </div>
              
              <div className="space-y-6 mt-4 max-h-[300px] overflow-y-auto pr-2">
                
                {/* 🛡️ 1. On filtre pour ne garder QUE les clients avec un email */}
                {formData.clients.filter(c => c.email && c.email.trim() !== '').map((client) => {
                  
                  // On retrouve le vrai index du client dans le tableau d'origine
                  const realIdx = formData.clients.findIndex(c => (c.idContact || c.IdContact) === (client.idContact || client.IdContact));

                  return (
                    <div key={client.idContact || client.IdContact} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="font-bold text-brand-dark mb-2 block flex items-center">
                        Client : {client.firstName} {client.lastName}
                      </span>
                      <input 
                        type="email" 
                        placeholder="Adresse Email"
                        value={client.tempEmail !== undefined ? client.tempEmail : (client.email || '')} 
                        onChange={e => {
                          const updated = [...formData.clients];
                          updated[realIdx].tempEmail = e.target.value; // Mise à jour sécurisée !
                          setFormData({...formData, clients: updated});
                        }}
                        className="w-full px-4 py-2 mb-3 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-red" 
                      />
                      <textarea 
                        placeholder={`Message Email pour ${client.firstName}`}
                        value={client.tempMessage || ''}
                        onChange={e => {
                          const updated = [...formData.clients];
                          updated[realIdx].tempMessage = e.target.value;
                          setFormData({...formData, clients: updated});
                        }}
                        className="w-full h-20 resize-none px-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-red"
                      ></textarea>
                    </div>
                  );
                })}

                {/* 🛡️ 2. Message si AUCUN client n'a d'email */}
                {formData.clients.filter(c => c.email && c.email.trim() !== '').length === 0 && (
                  <p className="text-center text-sm font-bold text-brand-red py-4">
                    Aucun des clients sélectionnés ne possède d'adresse email enregistrée.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* NOUVEAU BLOC : Envoyer le rappel */}
          <div className="border border-slate-300 rounded-3xl p-6 relative mt-10 flex flex-col items-center shadow-sm">
            <div className="absolute -top-4 bg-white px-4 text-brand-dark font-extrabold text-xl">
              Envoyer le rapelle
            </div>

            {/* Liste des rappels ajoutés */}
            <div className="w-full space-y-2 mb-4 max-h-32 overflow-y-auto">
              {formData.rappels && formData.rappels.map((rap, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg text-sm font-bold text-slate-700">
                  <span>{rap.date} à {rap.heure}</span>
                  <button type="button" onClick={() => {
                    const newRappels = formData.rappels.filter((_, i) => i !== idx);
                    setFormData({ ...formData, rappels: newRappels });
                  }} className="text-brand-red hover:text-rose-700"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            {/* Formulaire d'ajout d'un rappel */}
            <div className="flex items-center gap-4 mt-2 font-medium text-slate-600 text-lg w-full justify-center">
              Le 
              <div className="flex items-center gap-2 border-b-2 border-brand-red pb-1">
                <CalendarIcon className="w-5 h-5 text-brand-red" />
                <input 
                  type="date" 
                  min={todayStr}
                  value={tempRappelDate} 
                  onChange={e => setTempRappelDate(e.target.value)} 
                  className="outline-none bg-transparent text-brand-dark font-bold text-sm w-full" 
                />
              </div>
              à
              <div className="flex items-center gap-2 border-b-2 border-brand-red pb-1">
                <input 
                  type="time" 
                  value={tempRappelHeure} 
                  onChange={e => setTempRappelHeure(e.target.value)} 
                  className="outline-none bg-transparent text-brand-dark font-bold text-sm w-full" 
                />
              </div>
            </div>
            
            <button 
              type="button" 
              onClick={() => {
                  if (!tempRappelDate || !tempRappelHeure) return alert("Sélectionnez une date et une heure pour le rappel.");
                  
                  let evtDate;
                  // 1. Si récurrence activée, on se base sur la PREMIÈRE date de la récurrence
                  if (formData.recurrenceEnabled) {
                    if (!formData.Récurrences || formData.Récurrences.length === 0) {
                      return alert("Veuillez d'abord ajouter au moins une date dans le bloc Récurrence à gauche.");
                    }
                    evtDate = new Date(`${formData.Récurrences[0].date}T${formData.Récurrences[0].heure}:00`).getTime();
                  } 
                  // 2. Sinon, on se base sur la date classique
                  else {
                    if (!formData.date || !formData.heure) {
                      return alert("Veuillez d'abord définir la date et l'heure de l'événement à gauche.");
                    }
                    evtDate = new Date(`${formData.date}T${formData.heure}:00`).getTime();
                  }
                  
                  const rappelDate = new Date(`${tempRappelDate}T${tempRappelHeure}:00`).getTime();
                  
                  if (rappelDate >= evtDate) return alert("Le rappel doit être envoyé AVANT l'événement.");
                  if (rappelDate <= new Date().getTime()) return alert("Le rappel ne peut pas être dans le passé.");
                  
                  setFormData({ ...formData, rappels: [...(formData.rappels || []), { date: tempRappelDate, heure: tempRappelHeure }] });
                  setTempRappelDate(''); 
                  setTempRappelHeure('');
              }} 
              className="absolute -bottom-3 bg-brand-red text-white p-1.5 rounded-full shadow-md hover:scale-110 transition-transform z-10">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Bouton Programmer Final (Géré par React !) */}
          <div className="flex justify-center pt-8">
            <button 
              type="button"
              disabled={!isCol1Valid || !isCol2Valid}
              onClick={() => {
                setShowValidationModal(true);
                // 🚀 L'effet magique Smooth Scroll vers le haut !
                document.getElementById('page-nouveau-rdv').scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-12 py-3 font-bold text-xl rounded-full shadow-xl transition-all ${isCol1Valid && isCol2Valid ? 'bg-brand-dark text-white hover:bg-slate-800 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-70'}`}
            >
              Programmer
            </button>
          </div>
        </div>
      </div>

      {/* ================= 1. POP-UP MESSAGE PROGRAMMÉ ================= */}
      {showMsgModal && (
        <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-50">
          {/* On a ajouté "relative" ici 👇 */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-2xl border-t-4 border-brand-red animate-in zoom-in duration-200 relative">
            
            {/* 👈 LA NOUVELLE CROIX DE FERMETURE ICI */}
            <button 
              type="button" 
              onClick={() => setShowMsgModal(false)} 
              className="absolute right-6 top-6 text-slate-400 hover:text-brand-red transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* On a ajouté mt-4 ici pour espacer le contenu de la croix 👇 */}
            <div className="flex flex-col md:flex-row gap-8 mt-4">
              
              {/* Colonne Gauche : Choix du Template */}
              <div className="flex-1 md:border-r border-slate-100 md:pr-6">
                <h3 className="text-xl font-bold text-center mb-4 text-brand-dark">Liste Messages</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {dbTemplates.map((tpl) => (
                    <button 
                      key={tpl.idTemplate}
                      type="button"
                      onClick={() => handleTemplateClick(tpl)} 
                      className={`w-full py-2.5 border border-slate-200 rounded-2xl font-bold text-brand-dark hover:bg-slate-50 flex items-center px-4 transition-all ${selectedMsgId === tpl.idTemplate ? 'bg-slate-50 shadow-md border-brand-red ring-1 ring-brand-red/20' : ''}`}
                    >
                      <span className={`mr-3 text-2xl leading-none ${selectedMsgId === tpl.idTemplate ? 'text-brand-red' : 'text-slate-300'}`}>•</span> 
                      <span className="truncate">{tpl.templateName}</span>
                    </button>
                  ))}
                  {dbTemplates.length === 0 && (
                    <p className="text-sm text-slate-500 italic text-center">Aucun modèle. Allez dans Paramètres.</p>
                  )}
                </div>
              </div>

              {/* Colonne Droite : Les Champs Dynamiques */}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-center mb-4 text-brand-dark">Champs du modèle</h3>
                <div className="grid grid-cols-1 gap-4 max-h-[300px] overflow-y-auto pr-2">
                  {Object.keys(msgFields).length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[100px] text-sm text-slate-500 italic text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Sélectionnez un modèle pour voir ses champs.
                    </div>
                  ) : (
                    Object.keys(msgFields).map(key => {
                       // On adapte le type d'input selon le nom du champ !
                       const inputType = key.toLowerCase() === 'date' ? 'date' : key.toLowerCase() === 'heure' ? 'time' : 'text';
                       
                       return (
                         <div key={key}>
                           <label className="text-sm font-bold pl-2 text-brand-dark mb-1 block capitalize">{key}</label>
                           <input 
                             type={inputType} 
                             value={msgFields[key]} 
                             onChange={e => setMsgFields({...msgFields, [key]: e.target.value})} 
                             className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none transition-all shadow-sm"
                           />
                         </div>
                       );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Bouton de Validation final */}
            <div className="mt-8 flex justify-center">
              <button 
                type="button"
                onClick={() => {
                  const selectedTpl = dbTemplates.find(t => t.idTemplate === selectedMsgId);
                  if (!selectedTpl) return setShowMsgModal(false);
                  
                  let baseMessage = selectedTpl.messageContent;
                  
                  // 1. On remplace les champs personnalisés (ex: Motif)
                  Object.keys(msgFields).forEach(key => {
                    if (key.toLowerCase() !== 'nom' && key.toLowerCase() !== 'prenom' && key.toLowerCase() !== 'date' && key.toLowerCase() !== 'heure') {
                        const regex = new RegExp(`\\{${key}\\}`, 'gi');
                        baseMessage = baseMessage.replace(regex, msgFields[key]);
                    }
                  });

                  // 2. On remplace Date et Heure partout (C'est commun à tout le monde !)
                  const dateVal = msgFields['Date'] || formData.date || '';
                  const heureVal = msgFields['Heure'] || formData.heure || '';
                  baseMessage = baseMessage.replace(/\{Date\}/gi, dateVal).replace(/\{Heure\}/gi, heureVal);
                  
                  // 3. SMS : Remplacement Nom/Prenom UNIQUEMENT si 1 seul client !
                  let smsMsg = baseMessage;
                  if (formData.clients.length === 1) {
                    smsMsg = smsMsg.replace(/\{Prenom\}/gi, formData.clients[0].firstName || '')
                                   .replace(/\{Nom\}/gi, formData.clients[0].lastName || '');
                  }

                  // 4. EMAILS : Remplacement individuel pour CHAQUE client dans SA propre boîte !
                  const updatedClients = formData.clients.map(c => {
                    let clientMsg = baseMessage;
                    clientMsg = clientMsg.replace(/\{Prenom\}/gi, c.firstName || '')
                                         .replace(/\{Nom\}/gi, c.lastName || '');
                    return { ...c, tempMessage: clientMsg };
                  });
                  
                  setFormData({ ...formData, messageSMS: smsMsg, clients: updatedClients });
                  setShowMsgModal(false);
                }}
                className="px-8 py-3 bg-brand-dark text-white font-bold rounded-full flex items-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all"
              >
                <Check className="w-5 h-5 mr-2 text-green-400"/> Valider le texte
              </button>
            </div>
            <div className="mt-8 flex justify-center">
              
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. POP-UP RÉCURRENCE ================= */}
      {showRecurrenceModal && (
        <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-xl border-b-4 border-brand-red animate-in zoom-in duration-200 relative">
            <button 
              type="button" 
              onClick={() => setShowRecurrenceModal(false)} 
              className="absolute right-6 top-6 text-slate-400 hover:text-brand-red transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold text-center mb-6">Programmer une Récurrence</h3>
            <div className="space-y-6 max-h-[50vh] overflow-y-auto px-2 pb-2">
              {RécurrenceRows.map((row, idx) => (
                <div key={row.id} className="flex flex-col gap-3 border border-slate-200 p-4 rounded-xl shadow-sm bg-slate-50 relative mt-3">
                  <div className="absolute -top-3 left-4 bg-brand-dark text-white text-xs font-bold px-3 py-1 rounded-full">Dates N°{idx + 1}</div>
                  
                  {/* Ligne des inputs */}
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-end w-full mt-2">
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Date</label>
                      <input type="date" min={todayStr} value={row.date} onChange={e => { const copy=[...RécurrenceRows]; copy[idx].date = e.target.value; setRécurrenceRows(copy); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-red cursor-pointer"/>
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Heure</label>
                      <input type="time" value={row.heure} onChange={e => { const copy=[...RécurrenceRows]; copy[idx].heure = e.target.value; setRécurrenceRows(copy); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-red cursor-pointer"/>
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Répéter</label>
                      <select value={row.repeat} onChange={e => { const copy=[...RécurrenceRows]; copy[idx].repeat = e.target.value; setRécurrenceRows(copy); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-red cursor-pointer">
                          <option value="Non">Non</option>
                          <option value="Jour">Jour</option>
                          <option value="Semaine">Semaine</option>
                          <option value="Mois">Mois</option>
                          <option value="Personnaliser">Personnaliser...</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Bloc Personnaliser qui s'ouvre proprement */}
                  {row.repeat === 'Personnaliser' && (
                    <div className="flex items-center gap-2 mt-2 p-3 bg-white rounded-lg border border-brand-red/30 animate-in fade-in shadow-sm w-max">
                      <span className="text-sm font-medium text-slate-600">Répéter tous les</span>
                      <input type="number" min="1" value={row.customInterval || 1} onChange={e => { const copy=[...RécurrenceRows]; copy[idx].customInterval = e.target.value; setRécurrenceRows(copy); }} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-16 text-center outline-none focus:border-brand-red" />
                      <select value={row.customFreq || 'Jour(s)'} onChange={e => { const copy=[...RécurrenceRows]; copy[idx].customFreq = e.target.value; setRécurrenceRows(copy); }} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-red cursor-pointer">
                          <option value="Jour(s)">Jour(s)</option>
                          <option value="Semaine(s)">Semaine(s)</option>
                          <option value="Mois">Mois</option>
                      </select>
                    </div>
                  )}

                  {/* Bouton de suppression */}
                  {RécurrenceRows.length > 1 && (
                    <button type="button" onClick={() => { const copy = RécurrenceRows.filter((_, i) => i !== idx); setRécurrenceRows(copy); }} className="absolute -top-3 right-4 bg-red-100 text-brand-red p-1.5 rounded-full hover:bg-brand-red hover:text-white transition-colors shadow-sm" title="Supprimer">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              </div>
              <div className="flex justify-center mt-6 text-brand-red">
                <Plus onClick={() => { const nextId = RécurrenceRows.length ? RécurrenceRows[RécurrenceRows.length-1].id + 1 : 1; setRécurrenceRows([...RécurrenceRows, { id: nextId, date: '', heure: '', repeat: 'Non' }]); }} className="w-8 h-8 cursor-pointer hover:scale-110 transition-transform bg-red-50 rounded-full p-1 border border-brand-red/30" />
              </div>
              
              <div className="mt-8 flex justify-center">
                <button onClick={() => { 
                  // 🛡️ BARRAGE : Interdit de valider si un champ est vide !
                  const hasEmpty = RécurrenceRows.some(r => !r.date || !r.heure);
                  if(hasEmpty) {
                    return alert("Veuillez remplir la date et l'heure pour chaque bloc de récurrence.");
                  }

                  setFormData({...formData, Récurrences: RécurrenceRows, date: '', heure: ''}); 
                  setShowRecurrenceModal(false); 
                }} className="px-10 py-3 bg-brand-dark text-white font-bold rounded-full flex items-center shadow-lg hover:bg-slate-800 transition-all hover:-translate-y-1">
                  <Check className="w-5 h-5 mr-2 text-green-400"/> Valider les dates
                </button>
              </div>
          </div>
        </div>
      )}

      {/* ================= 3. POP-UP VALIDATION FINALE ================= */}
      {showValidationModal && (
        <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm flex items-center justify-center z-50">          
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold text-brand-dark mb-6 text-center border-b border-slate-100 pb-4">Résumé de la Programmation</h2>
            
            <div className="space-y-3 mb-8 text-slate-700">
              <p><span className="font-bold text-brand-dark">Titre :</span> {formData.titre || '-'}</p>

              <div>
                <span className="font-bold text-brand-dark">Clients :</span>
                <ul className="mt-1 list-disc list-inside text-slate-700">
                    {formData.clients && formData.clients.length > 0 ? formData.clients.map((c) => (
                        <li key={c.idContact}>{c.firstName} {c.lastName}</li>
                    )) : <li>-</li>}
                </ul>
              </div>

              <p><span className="font-bold text-brand-dark">Date :</span> {formData.date ? `${formData.date} à ${formData.heure || '-'}` : '-'}</p>

              {formData.Récurrences && formData.Récurrences.length>0 && (
                <div>
                  <p className="font-bold text-brand-dark">Récurrences :</p>
                  <ul className="list-disc list-inside text-slate-700">
                    {formData.Récurrences.map((r,i) => (
                      <li key={i}>{r.date || '-'} à {r.heure || '-'} — {r.repeat}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                <p className="text-xs font-bold text-brand-dark mb-1">Aperçu SMS :</p>
                <p className="text-sm italic text-slate-600">"{formData.messageSMS || 'Aucun message configuré.'}"</p>
              </div>

              {formData.rappels && formData.rappels.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                  <p className="text-xs font-bold text-brand-dark mb-2">Moments d'envoi du SMS :</p>
                  <ul className="list-disc list-inside text-sm text-slate-700">
                    {formData.rappels.map((rap, idx) => (
                      <li key={idx}>Le {rap.date} à {rap.heure}</li>
                    ))}
                  </ul>
                </div>
              )}

              {formData.emailEnabled && (formData.email || formData.messageEmail) && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                  <p className="text-xs font-bold text-brand-dark mb-1">Email :</p>
                  <p className="text-sm text-slate-700">{formData.email || '-'}</p>
                  <p className="text-xs font-bold text-brand-dark mb-1 mt-2">Aperçu Email :</p>
                  <p className="text-sm italic text-slate-600">"{formData.messageEmail || 'Aucun message configuré.'}"</p>
                </div>
              )}
            </div>

            <div className="flex justify-center space-x-4">
              <button onClick={() => setShowValidationModal(false)} className="px-6 py-2 border-2 border-slate-200 text-slate-600 font-bold rounded-full hover:bg-slate-50 transition-colors">
                Modifier
              </button>
              <button 
                disabled={isSubmitting}
                onClick={handleConfirm} 
                className={`px-6 py-2 text-white font-bold rounded-full shadow-md transition-colors ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-brand-red hover:bg-rose-700'}`}
              >
                {isSubmitting ? 'Enregistrement...' : "Confirmer l'envoi"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NouveauRdv;
