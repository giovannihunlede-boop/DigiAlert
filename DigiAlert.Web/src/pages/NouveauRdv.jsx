 import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, UserIcon,Calendar as CalendarIcon, Check, X, Plus, Clock } from 'lucide-react';
import { fetchWithAuth } from '../services/api';
import { Trash2, Mail } from 'lucide-react';

const NouveauRdv = () => {
  const navigate = useNavigate();
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const [editEventId, setEditEventId] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const location = useLocation();

  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);
  

  // Gestion de l'équipe
  const [team, setTeam] = useState([]);
  const [newStaff, setNewStaff] = useState({ firstName: '', email: '', password: '' });
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentTimeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
  const isFuture = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return false;
    return new Date(`${dateStr}T${timeStr}:00`).getTime() > (new Date().getTime() - 60000); 
  };

  useEffect(() => {
    const fetchEditData = async () => {
      if (location.state && location.state.editEventId) {
        const eventId = location.state.editEventId;
        setEditEventId(eventId);
        
        try {
          const resEvt = await fetchWithAuth('/api/Events');
          let resReminders = await fetchWithAuth('/api/Reminders/all');
          if (!resReminders.ok) resReminders = await fetchWithAuth('/api/Reminders');

          if (resEvt.ok) {
            const events = await resEvt.json();
            const myEvent = events.find(e => (e.idEvent || e.IdEvent) === eventId);
            
            if (myEvent) {
              const resContacts = await fetchWithAuth('/api/Contacts');
              let eventClients = [];
              if (resContacts.ok) {
                const allContacts = await resContacts.json();
                eventClients = allContacts.filter(c => 
                  myEvent.participants && myEvent.participants.some(p => (p.idContact || p.IdContact) === (c.idContact || c.IdContact))
                );
              }

              if (myEvent.hasSentReminders || myEvent.HasSentReminders) {
                alert("Modification impossible : Un rappel a déjà été expédié pour ce rendez-vous.");
                navigate('/agenda');
                return;
              }

              const startStr = myEvent.startDateTime || myEvent.StartDateTime;
              const endStr = myEvent.endDateTime || myEvent.EndDateTime;
              const startDate = new Date(startStr);
              const endDate = new Date(endStr);
              
              let durationMins = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
              if (durationMins < 0) durationMins += (24 * 60);

              const pad = (n) => String(n).padStart(2, '0');
              const toLocalDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
              const toLocalTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

              let msgSMS = '';
              let msgEmail = '';
              let loadedRappels = [];
              let isEmailActive = false;
              
              if (resReminders.ok) {
                const allReminders = await resReminders.json();
                const myReminders = allReminders.filter(r => (r.idEvent || r.IdEvent) === eventId);
                
                const smsReminders = myReminders.filter(r => (r.channel || r.Channel || '').toUpperCase() !== 'EMAIL');
                const emailReminders = myReminders.filter(r => (r.channel || r.Channel || '').toUpperCase() === 'EMAIL');
                
                if (smsReminders.length > 0) {
                   msgSMS = smsReminders[0].messageText || smsReminders[0].MessageText || '';
                   // Convertion horaires .
                   loadedRappels = smsReminders.map(r => {
                      const d = new Date(r.scheduledTime || r.ScheduledTime);
                      return { date: toLocalDate(d), heure: toLocalTime(d) };
                   });
                   loadedRappels = loadedRappels.filter((v,i,a)=>a.findIndex(v2=>(v2.date===v.date && v2.heure===v.heure))===i);
                }

                if (emailReminders.length > 0) {
                   isEmailActive = true;
                   msgEmail = emailReminders[0].messageText || emailReminders[0].MessageText || ''; 
                   eventClients = eventClients.map(c => { 
                       const emailReminder = emailReminders.find(r => (r.idContact || r.IdContact) === (c.idContact || c.IdContact));
                       return { 
                           ...c, 
                           tempMessage: emailReminder ? (emailReminder.messageText || emailReminder.MessageText || '') : '' 
                       };
                   });
                }
              }
              setFormData(prev => ({
                ...prev,
                titre: myEvent.title || myEvent.Title || '',
                clients: eventClients,
                date: toLocalDate(startDate),
                heure: toLocalTime(startDate),
                duree: durationMins,
                messageSMS: msgSMS,
                messageEmail: msgEmail,
                rappels: loadedRappels,
                emailEnabled: isEmailActive,
                recurrenceEnabled: false, 
                recurrences: []
              }));
            }
          }
        } catch (e) {
          console.error("Erreur de pré-remplissage :", e);
        }
      }
    };

    fetchEditData();
  }, []);
  
  // État des données du formulaire 
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
    recurrences: [],
    emailEnabled: false,
    recurrenceEnabled: false,
    rappels: [],
    
  });

  const [tempRappelDate, setTempRappelDate] = useState('');
  const [tempRappelHeure, setTempRappelHeure] = useState('');

  const [isRappelAuto, setIsRappelAuto] = useState(true);
  const [rappelAutoValue, setRappelAutoValue] = useState(24);
  const [rappelAutoUnit, setRappelAutoUnit] = useState('heures');
  
  // Validation en temps réel des données saisies.
  
  let minEndDateStr = todayStr;
  if (formData.recurrences && formData.recurrences.length > 0) {
    const validDates = formData.recurrences.filter(r => r.date).map(r => new Date(r.date).getTime());
    if (validDates.length > 0) {
      const maxDate = new Date(Math.max(...validDates));
      minEndDateStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;
    }
  }

  const hasRepetition = formData.recurrences && formData.recurrences.length > 0 && formData.recurrences.some(r => r.repeat && r.repeat.trim().toLowerCase() !== 'non');
  const allRecurrencesValid = formData.recurrences && formData.recurrences.length > 0 && formData.recurrences.every(r => r.date !== '' && r.heure !== '');
  const isEndDateValid = !hasRepetition || (formData.dateFinRecurrence !== '' && formData.dateFinRecurrence >= minEndDateStr);

  const isCol1Valid = 
    formData.titre && formData.titre.trim() !== '' && 
    formData.clients.length > 0 && 
    formData.duree > 0 &&
    (
      (formData.recurrenceEnabled && allRecurrencesValid && isEndDateValid) 
      ||
      (!formData.recurrenceEnabled && formData.date !== '' && formData.heure !== '')
    );
  const validEmails = formData.clients.filter(c => {
    const mail = (c.tempEmail !== undefined ? c.tempEmail : c.email) || '';
    return mail.trim() !== '';
  });

  const isCol2Valid = 
    formData.messageSMS.trim() !== '' && 
    formData.rappels?.length > 0 && 
    (!formData.emailEnabled || (
      formData.emailEnabled && 
      validEmails.length > 0 &&
      validEmails.every(c => ((c.tempMessage || formData.messageEmail || '').trim() !== ''))
    ));
  const [dbContacts, setDbContacts] = useState([]);
  const [dbTemplates, setDbTemplates] = useState([]);

useEffect(() => {
  const loadData = async () => {
    try {
      // 1. Charger les contacts
      const resContacts = await fetchWithAuth('/api/Contacts');
      if (resContacts.ok) {
        const jsonContacts = await resContacts.json();
        
        let contactsArray = [];
        
        // On cherche le tableau, quel que soit le nom de la variable utilisée par votre backend C#
        if (Array.isArray(jsonContacts)) {
          contactsArray = jsonContacts;
        } else if (jsonContacts.items && Array.isArray(jsonContacts.items)) {
          contactsArray = jsonContacts.items; // Format paginé classique
        } else if (jsonContacts.Items && Array.isArray(jsonContacts.Items)) {
          contactsArray = jsonContacts.Items; // Format paginé C# (Majuscule)
        } else if (jsonContacts.data && Array.isArray(jsonContacts.data)) {
          contactsArray = jsonContacts.data;
        } else if (jsonContacts.$values && Array.isArray(jsonContacts.$values)) {
          contactsArray = jsonContacts.$values; // Format System.Text.Json (Preserve References)
        } else {
          // Ultime recours : on cherche n'importe quel tableau dans l'objet
          const found = Object.values(jsonContacts).find(v => Array.isArray(v));
          if (found) contactsArray = found;
        }

        setDbContacts(contactsArray);
      }

      // 2. Charger les Templates
      const resTemplates = await fetchWithAuth('/api/SmsTemplates');
      if (resTemplates.ok) {
        const jsonTemplates = await resTemplates.json();
        
        let templatesArray = [];
        if (Array.isArray(jsonTemplates)) templatesArray = jsonTemplates;
        else if (jsonTemplates.items && Array.isArray(jsonTemplates.items)) templatesArray = jsonTemplates.items;
        else if (jsonTemplates.Items && Array.isArray(jsonTemplates.Items)) templatesArray = jsonTemplates.Items;
        else if (jsonTemplates.data && Array.isArray(jsonTemplates.data)) templatesArray = jsonTemplates.data;
        else if (jsonTemplates.$values && Array.isArray(jsonTemplates.$values)) templatesArray = jsonTemplates.$values;
        else {
          const found = Object.values(jsonTemplates).find(v => Array.isArray(v));
          if (found) templatesArray = found;
        }
        
        setDbTemplates(templatesArray);
      }
    } catch (error) {
      console.error("Erreur API:", error);
      setDbContacts([]);
      setDbTemplates([]);
    }
  };

  loadData();
}, []);

  const [RécurrenceRows, setRécurrenceRows] = useState([
    { id: 1, date: '', heure: '', repeat: 'Non' }
  ]);
  const [selectedMsgId, setSelectedMsgId] = useState(1);
  const [msgFields, setMsgFields] = useState({ nom: '', prenom: '', date: '' });

  const AVAILABLE_CLIENTS = ['Dr. Koffi', 'M. Amida', 'Mme. Aminata'];
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const handleConfirm = async () => {
    if (isSubmitting) return;

    // 1. Vérifications de base.
    if (!formData.titre || formData.clients.length === 0) {
      return alert("Veuillez donner un titre et sélectionner au moins un client.");
    }

    if (!formData.duree || parseInt(formData.duree) <= 0) {
      return alert("Veuillez entrer une durée valide (minimum 1 minute).");
    }

    // 2. Génération des dates.
    let datesToProcess = [];
    if (formData.recurrenceEnabled && formData.recurrences && formData.recurrences.length > 0) {
      
      const hasRepetition = formData.recurrences.some(r => r.repeat !== 'Non');

      if (hasRepetition && !formData.dateFinRecurrence) {
        return alert("Veuillez définir une date de fin pour la récurrence dans le badge noir.");
      }
      
      const limitDate = hasRepetition ? new Date(`${formData.dateFinRecurrence}T23:59:59`).getTime() : null;

      try {
        formData.recurrences.forEach(r => {
          if (!r.date || !r.heure) return;
          let currentDate = new Date(`${r.date}T${r.heure}:00`);
          if (hasRepetition && limitDate <= currentDate.getTime()) {
            throw new Error(`Erreur: La date de fin (${formData.dateFinRecurrence}) doit être strictement après le ${r.date}.`);
          }

          datesToProcess.push(new Date(currentDate));

          // Si répétition, on calcule et on crée les dates suivantes
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
              if (currentDate.getTime() > limitDate) break;
              
              datesToProcess.push(new Date(currentDate));
            }
          }
        });
      } catch (e) {
        return alert(e.message); 
      }
    } else {
      if (!formData.date || !formData.heure) {
          return alert("Veuillez définir la date et l'heure de l'événement à gauche.");
      }
      const singleDate = new Date(`${formData.date}T${formData.heure}:00`);

      if (singleDate.getTime() <= new Date().getTime() && !isUpdate) { 
        return alert("Erreur : La date du rendez-vous ne peut pas être dans le passé !");
      }

      datesToProcess = [singleDate];
    }

    datesToProcess.sort((a, b) => a.getTime() - b.getTime());

    setIsSubmitting(true);
    
    try {
      if (isUpdate && datesToProcess.length > 1) {
         throw new Error("Vous ne pouvez pas transformer un événement unique existant en récurrence multiple.");
      }

      // -------------------------------------------------------------------------
      // Vérifie toutes les données avant le premier envoi à la base de données.
      // -------------------------------------------------------------------------
      const resAllEvts = await fetchWithAuth('/api/Events');
      if (!resAllEvts.ok) throw new Error("Impossible de joindre le serveur pour la vérification.");
      const existingEvents = await resAllEvts.json();
      
      const firstEventTime = datesToProcess[0].getTime();
      const currentTimeMs = new Date().getTime();
      const gracePeriodMs = currentTimeMs - (2 * 60000); // Tolérance de 2 min
      let fallbackDate = formData.date;
      let fallbackHeure = formData.heure;
      if (formData.recurrenceEnabled && formData.recurrences && formData.recurrences.length > 0) {
        fallbackDate = formData.recurrences[0].date;
        fallbackHeure = formData.recurrences[0].heure;
      }
      const finalRappels = (formData.rappels && formData.rappels.length > 0) 
         ? formData.rappels 
         : [{ date: fallbackDate, heure: fallbackHeure }];
      for (const startDate of datesToProcess) {
          const startMs = startDate.getTime();
          const endMs = startMs + (formData.duree ? parseInt(formData.duree) : 45) * 60000;
          if (startMs <= gracePeriodMs && !isUpdate) {
              setIsSubmitting(false);
              setShowValidationModal(false);
              return alert(`OPÉRATION ANNULÉE :\nL'événement du ${startDate.toLocaleString('fr-FR')} est dans le passé.`);
          }

          // 1. Chevauchement d'agenda ?
          const hasOverlap = existingEvents.some(e => {
              if (isUpdate && (e.idEvent || e.IdEvent) === editEventId) return false;
              const st = (e.status || e.Status || '').toUpperCase();
              if (st === 'CANCELLED' || st === 'COMPLETED') return false;
              
              const eStart = new Date(e.startDateTime || e.StartDateTime).getTime();
              const eEnd = new Date(e.endDateTime || e.EndDateTime).getTime();
              
              return eStart < endMs && eEnd > startMs;
          });
          
          if (hasOverlap) {
              setIsSubmitting(false);
              setShowValidationModal(false);
              return alert(`OPÉRATION ANNULÉE :\nLe créneau du ${startDate.toLocaleString('fr-FR')} chevauche un rendez-vous existant.`);
          }

          // 2. Les Rappels (SMS & Email) sont-ils valides ?
          const hasSms = formData.messageSMS && formData.messageSMS.trim() !== '';
          const hasEmail = formData.emailEnabled;

          if (hasSms || hasEmail) {
              for (const rap of finalRappels) {
                  if (!rap.date || !rap.heure) continue;
                  
                  const originalRappelTime = new Date(`${rap.date}T${rap.heure}:00`).getTime();
                  const offset = firstEventTime - originalRappelTime;
                  const scheduledTimeMs = startMs - offset;

                  if (scheduledTimeMs <= gracePeriodMs) {
                      setIsSubmitting(false);
                      setShowValidationModal(false);
                      return alert(`OPÉRATION ANNULÉE :\nLe rappel prévu pour le ${new Date(scheduledTimeMs).toLocaleString('fr-FR')} est dans le passé !\n\nVeuillez ajuster l'heure de votre rappel.`);
                  }
              }
          }
      }
      // =========================================================================
      // FIN DU PRE-FLIGHT CHECK - TOUT EST VALIDE, ON PEUT ENREGISTRER EN TOUTE SÉCURITÉ !
      // =========================================================================

      // 3. boucle sur chaque date pour créer l'événement et ses rappels
      for (const startDate of datesToProcess) {
        // 1. Filtrage des dates passées dans le bloc 'if'
        if (startDate.getTime() <= new Date().getTime()) {
          console.warn(`La date ${startDate.toLocaleString()} est dans le passé, ignorée.`);
          continue;
        }

        const startDateTime = startDate.toISOString();
        const durationMins = formData.duree ? parseInt(formData.duree) : 45;

        // 2. Ajout des symboles '=' et correction des backticks pour l'URL
        const endDateTime = new Date(startDate.getTime() + durationMins * 60000).toISOString();
        const isUpdate = editEventId !== null;
        const url = isUpdate ? `/api/Events/${editEventId}` : '/api/Events';
        const method = isUpdate ? 'PUT' : 'POST';

        const evtRes = await fetchWithAuth(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.titre,
            startDateTime: startDateTime,
            endDatetime: endDateTime,
            contactIds: formData.clients.map(c => c.idContact || c.IdContact || c.id).filter(Boolean),
          }),
        });

        // 3. Encapsulation de la levée d'erreur dans le bloc 'if (!evtRes.ok)'
        if (!evtRes.ok) {
          const errText = await evtRes.text();
          let errMsg = errText;
          try {
            const errObj = JSON.parse(errText);
            errMsg = errObj.message || errObj.Message || errObj.title || errText;
          } catch (e) {}
          throw new Error(`L'événement a été refusé : \n${errMsg}`);
        }
        const evtData = await evtRes.json();
        const finalEventId = isUpdate ? editEventId : (evtData.idEvent || evtData.IdEvent);

        // 1. la date du tout premier événement de la série ?
        const firstEventDate = datesToProcess[0]; 
        
        // 2. On prépare la liste des rappels (Fallback si vide)
        let fallbackDate = formData.date;
        let fallbackHeure = formData.heure;
        if (formData.recurrenceEnabled && formData.recurrences && formData.recurrences.length > 0) {
          fallbackDate = formData.recurrences[0].date;
          fallbackHeure = formData.recurrences[0].heure;
        }
        const finalRappels = (formData.rappels && formData.rappels.length > 0) 
            ? formData.rappels 
            : [{ date: fallbackDate, heure: fallbackHeure }];

        if (formData.messageSMS && formData.messageSMS.trim() !== '') {
          for (const rap of finalRappels) {
            // CALCUL DU DÉCALAGE 
            const originalRappelTime = new Date(`${rap.date}T${rap.heure}:00`).getTime();
            const offset = firstEventDate.getTime() - originalRappelTime;
            
            // APPLICATION DU DÉCALAGE SUR L'ÉVÉNEMENT ACTUEL DE LA BOUCLE
            const scheduledTime = new Date(startDate.getTime() - offset).toISOString();
            
            for (const client of formData.clients) {
              const finalMessageSMS = formData.messageSMS
                .replace(/\{Prenom\}/gi, client.firstName || '')
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
                  channel: "SMS" 
                }),
              });

              if (!remRes.ok) {
                 const errText = await remRes.text();
                 let errMsg = errText;
                 try { const errObj = JSON.parse(errText); errMsg = errObj.message || errObj.Message || errObj.title || errText; } catch(e){}
                 throw new Error(`RDV enregistré, mais le rappel SMS a échoué : \n${errMsg}`);
              }
            }
          }
        }

        // C. Création des rappels EMAIL
        if (formData.emailEnabled) {
          for (const rap of finalRappels) {

            const originalRappelTime = new Date(`${rap.date}T${rap.heure}:00`).getTime();
            const offset = firstEventDate.getTime() - originalRappelTime;
            const scheduledTime = new Date(startDate.getTime() - offset).toISOString();

            for (const client of formData.clients) {
              const contactId = client.idContact || client.IdContact || client.id;
              const emailToUse = ((client.tempEmail !== undefined ? client.tempEmail : client.email) || formData.emailAddress || '').trim();
              const messageToUse = (client.tempMessage || formData.messageEmail || '').trim();

              if (!emailToUse || !messageToUse || !contactId) continue;

              if (emailToUse !== (client.email || '').trim()) {
                const updRes = await fetchWithAuth(`/api/Contacts/${contactId}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                    idContact: contactId,
                    firstName: client.firstName || '',
                    lastName: client.lastName || '',
                    phoneNumber: client.phoneNumber || client.phone || '',
                    email: emailToUse
                  }),
                });
                if (updRes.ok) client.email = emailToUse;
              }

              const finalMessageEmail = messageToUse
                .replace(/\{Prenom\}/gi, client.firstName || '')
                .replace(/\{Nom\}/gi, client.lastName || '')
                .replace(/\{Date\}/gi, startDate.toLocaleDateString('fr-FR'))
                .replace(/\{Heure\}/gi, startDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}));

              const emailRes = await fetchWithAuth('/api/Reminders', {
                method: 'POST',
                body: JSON.stringify({
                  idEvent: finalEventId,
                  contactIds: [contactId],
                  scheduledTime: scheduledTime, 
                  messageText: finalMessageEmail,
                  channel: "EMAIL"
                }),
              });

              if (!emailRes.ok) {
                const errText = await emailRes.text();
                let errMsg = errText;
                try { const errObj = JSON.parse(errText); errMsg = errObj.Message || errObj.message || errObj.title || JSON.stringify(errObj.errors); } catch(e){}
                throw new Error(`RDV enregistré, mais l'email a échoué : \n${errMsg}`);
              }
            }
          }
        }

      } 
      setShowValidationModal(false);
      alert("RDV et Rappels enregistrés avec succès !");
      
      setFormData({ 
        titre: '', clients: [], date: '', heure: '', duree: 45,
        messageSMS: '', messageEmail: '', recurrences: [], 
        emailEnabled: true, recurrenceEnabled: false, rappels: [], dateFinRecurrence: '' 
      });
      setTempRappelDate('');
      setTempRappelHeure('');
      
      window.location.href = '/agenda';

    } catch (error) {
      console.error(error);

      alert(error.message || `Une erreur est survenue lors de l'enregistrement.\n\n${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateClick = (tpl) => {

    const extractedTags = tpl.messageContent.match(/\{([^}]+)\}/g) || [];
    const newFields = {};
    
    extractedTags.forEach(tag => {
      const cleanTag = tag.replace(/[{}]/g, '');
      
      if (cleanTag.toLowerCase() === 'nom') {
        newFields[cleanTag] = formData.clients.length > 0 ? formData.clients[0].lastName || '' : '';
      } else if (cleanTag.toLowerCase() === 'prenom') {
        newFields[cleanTag] = formData.clients.length > 0 ? formData.clients[0].firstName || '' : '';
      } else if (cleanTag.toLowerCase() === 'date') {
        newFields[cleanTag] = formData.date || '';
      } else if (cleanTag.toLowerCase() === 'heure') {
        newFields[cleanTag] = formData.heure || '';
      } else {
        newFields[cleanTag] = ''; 
      }
    });
    
    setMsgFields(newFields);
    setSelectedMsgId(tpl.idTemplate);
  };

  const isUpdate = editEventId !== null;

  return (
    <div id="page-nouveau-rdv" className="flex-1 flex flex-col overflow-y-auto p-2 sm:p-4 md:p-10 bg-brand-bg relative scroll-smooth">

      {/* Conteneur Principal */}
      <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-xl border border-slate-100 p-4 sm:p-6 md:p-8 flex flex-col md:flex-row gap-8 md:gap-12 max-w-6xl w-full mx-auto">
        
        {/* ================= COLONNE GAUCHE ================= */}
        <div className="flex-1 space-y-6">

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
              <button 
                type="button" 
                onClick={() => !isUpdate && setShowClientDropdown(!showClientDropdown)}
                className={`w-full text-left px-4 py-2 border border-slate-300 rounded-full flex justify-between items-center transition-all ${isUpdate ? 'bg-slate-100 cursor-not-allowed opacity-60' : 'bg-white hover:bg-slate-50'}`}
              >
                <span className="text-slate-700">
                  {formData.clients && formData.clients.length > 0 ? `${formData.clients.length} client(s) sélectionné(s)` : 'Sélectionner un client'}
                </span>
                {!isUpdate && <span className="text-slate-400">▾</span>}
              </button>
              

              {showClientDropdown && !isUpdate && (
              <div className="absolute z-40 mt-2 w-full bg-white border rounded-lg shadow-md max-h-48 overflow-auto">
                {Array.isArray(dbContacts) && dbContacts.map((c) => {
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
          
            {/* Ligne des Dates */}
            <div className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                
                {/* CHAMP DATE */}
                <div>
                  <label className={`block text-lg font-bold mb-2 ${formData.recurrenceEnabled ? 'text-slate-400' : 'text-brand-dark'}`}>Date</label>
                  <div className="relative">
                    <CalendarIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${formData.recurrenceEnabled ? 'text-slate-400' : 'text-brand-red'}`} />
                    <input 
                      type="date" 
                      min={todayStr} 
                      value={formData.date} 
                      onChange={e => setFormData({...formData, date: e.target.value})} 
                      disabled={formData.recurrenceEnabled} 
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className={`w-full pl-12 pr-4 py-3 border rounded-full outline-none transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full ${
                        formData.recurrenceEnabled 
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                          : (!isFuture(formData.date, formData.heure) && formData.date && formData.heure 
                              ? 'border-brand-red bg-red-50 text-brand-red focus:ring-2 focus:ring-brand-red/30' 
                              : 'border-slate-300 focus:ring-2 focus:ring-brand-red/20 text-brand-dark font-medium')
                      }`} 
                    />
                  </div>
                </div>

                {/* CHAMP HEURE */}
                <div>
                  <label className={`block text-lg font-bold mb-2 ${formData.recurrenceEnabled ? 'text-slate-400' : 'text-brand-dark'}`}>Heure</label>
                  <div className="relative">
                    <input 
                      type="time" 
                      value={formData.heure} 
                      onChange={e => setFormData({...formData, heure: e.target.value})} 
                      disabled={formData.recurrenceEnabled} 
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className={`w-full pl-5 pr-12 py-3 border rounded-full outline-none transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full ${
                        formData.recurrenceEnabled 
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                          : (!isFuture(formData.date, formData.heure) && formData.date && formData.heure 
                              ? 'border-brand-red bg-red-50 text-brand-red focus:ring-2 focus:ring-brand-red/30' 
                              : 'border-slate-300 focus:ring-2 focus:ring-brand-red/20 text-brand-dark font-medium')
                      }`} 
                    />
                    <Clock className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${formData.recurrenceEnabled ? 'text-slate-400' : 'text-brand-red'}`} />
                  </div>
                </div>
                
              </div>
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
              {!formData.recurrenceEnabled && formData.date && formData.heure && !isFuture(formData.date, formData.heure) && (
                <div className="mt-3 text-center text-sm font-bold text-brand-red animate-in fade-in flex items-center justify-center bg-red-50 py-2 rounded-lg border border-red-200">
                   La date et l'heure doivent être dans le futur !
                </div>
              )}
            </div>

          {/* BLOC RÉCURRENCE Activable */}
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
                <div className="flex justify-center mb-6 mt-2">
                  <button type="button" onClick={() => setShowRecurrenceModal(true)} className="px-6 py-2 bg-brand-dark text-white font-bold rounded-full hover:bg-slate-800 hover:scale-105 transition-all text-sm shadow-md flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Ajouter des dates
                  </button>
                </div>
                
                {formData.recurrences && formData.recurrences.length > 0 ? (
                  <div className="space-y-3">
                    {formData.recurrences.map((r, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 flex justify-between items-center group transition-colors hover:border-brand-red/30 shadow-sm">
                        {/* flex-1 garantit que le texte ne pousse pas la poubelle vers le bas */}
                        <div className="flex-1 pr-2">
                          <div className="text-sm font-bold text-brand-dark truncate">{idx+1}. {r.date || '—'} à {r.heure || '—'}</div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5">Répète : {r.repeat}</div>
                        </div>
                        
                        <button 
                          type="button"
                          onClick={() => {
                            const newRecurrences = formData.recurrences.filter((_, i) => i !== idx);
                            setFormData({...formData, recurrences: newRecurrences});
                            
                            setRécurrenceRows(newRecurrences.length > 0 ? newRecurrences : [{ id: 1, date: '', heure: '', repeat: 'Non' }]);
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

              {formData.recurrenceEnabled && hasRepetition && (
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-brand-dark text-white px-5 py-2 rounded-xl font-bold shadow-xl flex flex-col items-center z-30">
                  <span className="text-[10px] mb-1 text-slate-300 uppercase tracking-widest">Date de fin requise</span>
                  <div className="flex items-center gap-2 bg-white/20 px-2 py-0.5 rounded-lg border border-slate-500">
                    <input 
                      type="date" 
                      min={minEndDateStr} 
                      value={formData.dateFinRecurrence || ''} 
                      onChange={e => setFormData({...formData, dateFinRecurrence: e.target.value})} 
                      className="bg-transparent outline-none text-sm text-center text-white cursor-pointer" 
                    />
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
        <div className="hidden md:block w-px bg-brand-red opacity-30"></div>

        {/* ================= COLONNE DROITE ================= */}
        <div className="flex-1 space-y-6">

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
              className="w-full h-24 mt-2 resize-none text-lg md:text-xl text-slate-500 outline-none leading-relaxed"
              onChange={e => setFormData({...formData, messageSMS: e.target.value})}
              value={formData.messageSMS}
            ></textarea>

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

          {/* ================= BLOC EMAIL REPENSU ================= */}
          <div className="border border-slate-200 rounded-2xl p-4 sm:p-6 mt-8 relative bg-slate-50">
            
            <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-4">
              <h3 className="text-base sm:text-lg font-bold text-brand-dark flex items-center">
                <Mail className="w-5 h-5 mr-2 text-slate-500" /> 
                Rappels par Email
              </h3>
              
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm font-bold text-slate-600 hidden sm:inline">Activer ?</span>
                <div 
                  className={`w-12 h-6 rounded-full relative cursor-pointer flex items-center p-1 transition-colors shadow-inner ${formData.emailEnabled ? 'bg-brand-red' : 'bg-slate-300'} ${!formData.messageSMS ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (!formData.messageSMS) return alert("Vous devez d'abord programmer un rappel SMS !");
                    setFormData({...formData, emailEnabled: !formData.emailEnabled});
                  }}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${formData.emailEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </div>
              </div>
            </div>

            {/* Contenu des Emails */}
            {formData.emailEnabled && formData.clients.length > 0 ? (
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {formData.clients.map((client) => {
                  const realIdx = formData.clients.findIndex(c => (c.idContact || c.IdContact) === (client.idContact || client.IdContact));
                  return (
                    <div key={client.idContact || client.IdContact} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <span className="font-bold text-brand-dark mb-3 block flex items-center">
                        <UserIcon className="w-4 h-4 mr-2 text-slate-400"/> 
                        {client.firstName} {client.lastName}
                      </span>
                      <input 
                        type="email" 
                        placeholder="Adresse Email"
                        value={client.tempEmail !== undefined ? client.tempEmail : (client.email || '')} 
                        onChange={e => {
                          const updated = [...formData.clients];
                          updated[realIdx].tempEmail = e.target.value;
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
                        className="w-full h-20 resize-none px-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-brand-red leading-relaxed"
                      ></textarea>
                    </div>
                  );
                })}
              </div>
            ) : formData.emailEnabled ? (
              <p className="text-center text-sm font-bold text-brand-red py-4">
                Sélectionnez au moins un client pour configurer les emails.
              </p>
            ) : (
              <p className="text-center text-sm text-slate-400 italic py-2">
                Les rappels par email sont désactivés pour ce rendez-vous.
              </p>
            )}
          </div>

          <div className="border border-slate-300 rounded-3xl p-6 relative mt-10 flex flex-col items-center shadow-sm bg-white">
            <div className="absolute -top-4 bg-white px-4 text-brand-dark font-extrabold text-xl">
              Envoyer le rappel
            </div>

            {/* Switcher Auto / Manuel */}
            <div className="flex items-center gap-4 w-full justify-center mb-6 mt-2">
              <span className={`font-bold text-sm cursor-pointer transition-colors ${!isRappelAuto ? 'text-brand-red' : 'text-slate-400'}`} onClick={() => setIsRappelAuto(false)}>Date Fixe</span>
              
              <div 
                className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer flex items-center p-1 shadow-inner"
                onClick={() => setIsRappelAuto(!isRappelAuto)}
              >
                <div className={`w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${isRappelAuto ? 'translate-x-6 bg-brand-red' : 'bg-slate-400'}`}></div>
              </div>

              <span className={`font-bold text-sm cursor-pointer transition-colors ${isRappelAuto ? 'text-brand-red' : 'text-slate-400'}`} onClick={() => setIsRappelAuto(true)}>Automatique</span>
            </div>

            {/* Liste des rappels ajoutés */}
            <div className="w-full space-y-2 mb-6 max-h-32 overflow-y-auto px-2">
              {formData.rappels && formData.rappels.map((rap, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-700 shadow-sm">
                  <span>{rap.label ? <><span className="text-brand-red">{rap.label}</span> <span className="text-xs text-slate-400 font-normal hidden sm:inline">(Soit le {rap.date} à {rap.heure})</span></> : `Le ${rap.date} à ${rap.heure}`}</span>
                  <button type="button" onClick={() => setFormData({ ...formData, rappels: formData.rappels.filter((_, i) => i !== idx) })} className="text-slate-400 hover:text-brand-red bg-white rounded-md p-1 shadow-sm border border-slate-100"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            {/* Formulaire Dynamique */}
            {isRappelAuto ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 font-bold text-slate-600 text-lg w-full justify-center animate-in fade-in">
                
                <input 
                  type="number" min="1" 
                  value={rappelAutoValue} 
                  onChange={e => setRappelAutoValue(e.target.value)} 
                  className="w-16 border-b-2 border-brand-red bg-transparent text-center font-extrabold text-brand-dark outline-none py-1" 
                />
                <select 
                  value={rappelAutoUnit} 
                  onChange={e => setRappelAutoUnit(e.target.value)} 
                  className="border-b-2 border-brand-red bg-transparent font-extrabold text-brand-dark outline-none cursor-pointer py-1"
                >
                  <option value="minutes">Minute(s)</option>
                  <option value="heures">Heure(s)</option>
                  <option value="jours">Jour(s)</option>
                </select>
                <span>avant.</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4 font-medium text-slate-600 text-base sm:text-lg w-full justify-center animate-in fade-in">
              Le
              {/* ZONE DATE*/}
              <div className="relative flex items-center justify-center border-b-2 border-brand-red pb-1 min-w-[120px]">
                <CalendarIcon className="w-5 h-5 text-brand-red mr-2" />
                <span className="text-brand-dark font-bold text-sm">
                  {tempRappelDate ? tempRappelDate.split('-').reverse().join('/') : 'Date'}
                </span>

                <input
                  type="date"
                  min={todayStr}
                  value={tempRappelDate}
                  onChange={e => setTempRappelDate(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
              </div>
              
              à
              
              {/* ZONE HEURE */}
              <div className="relative flex items-center justify-center border-b-2 border-brand-red pb-1 min-w-[90px]">
                <span className="text-brand-dark font-bold text-sm">
                  {tempRappelHeure || 'Heure'}
                </span>
                <Clock className="w-5 h-5 text-brand-red ml-2" />

                <input
                  type="time"
                  value={tempRappelHeure}
                  onChange={e => setTempRappelHeure(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
              </div>
            </div>
            )}
            
            <button 
              type="button" 
              onClick={() => {
                  let tDate = tempRappelDate;
                  let tHeure = tempRappelHeure;
                  let label = null;

                  // date du premier événement
                  let baseDateStr = formData.date;
                  let baseTimeStr = formData.heure;
                  
                  if (formData.recurrenceEnabled) {
                    const validRecs = formData.recurrences ? formData.recurrences.filter(r => r.date && r.heure) : [];
                    if (validRecs.length === 0) return alert("Veuillez d'abord ajouter au moins une date dans le bloc Récurrence à gauche.");

                    const earliestMs = Math.min(...validRecs.map(r => new Date(`${r.date}T${r.heure}:00`).getTime()));
                    const earliestDate = new Date(earliestMs);
                    const pad = n => String(n).padStart(2, '0');
                    baseDateStr = `${earliestDate.getFullYear()}-${pad(earliestDate.getMonth() + 1)}-${pad(earliestDate.getDate())}`;
                    baseTimeStr = `${pad(earliestDate.getHours())}:${pad(earliestDate.getMinutes())}`;
                  } else {
                    if (!baseDateStr || !baseTimeStr) return alert("Veuillez d'abord définir la date et l'heure de l'événement à gauche.");
                  }

                  const evtTimeMs = new Date(`${baseDateStr}T${baseTimeStr}:00`).getTime();

                  if (isRappelAuto) {
                      if (!rappelAutoValue || rappelAutoValue <= 0) return alert("Valeur de temps invalide.");
                      let offsetMs = 0;
                      if (rappelAutoUnit === 'minutes') offsetMs = rappelAutoValue * 60000;
                      if (rappelAutoUnit === 'heures') offsetMs = rappelAutoValue * 3600000;
                      if (rappelAutoUnit === 'jours') offsetMs = rappelAutoValue * 86400000;

                      const rTime = new Date(evtTimeMs - offsetMs);
                      const pad = n => String(n).padStart(2, '0');
                      tDate = `${rTime.getFullYear()}-${pad(rTime.getMonth()+1)}-${pad(rTime.getDate())}`;
                      tHeure = `${pad(rTime.getHours())}:${pad(rTime.getMinutes())}`;
                      label = `${rappelAutoValue} ${rappelAutoUnit} avant`;
                  } else {
                      if (!tDate || !tHeure) return alert("Sélectionnez une date et une heure pour le rappel.");
                  }

                  const rappelTimeMs = new Date(`${tDate}T${tHeure}:00`).getTime();
                  if (rappelTimeMs >= evtTimeMs) return alert("Le rappel doit être envoyé AVANT le tout premier événement.");
                  if (rappelTimeMs <= new Date().getTime()) return alert("Calcul impossible : Le rappel serait programmé dans le passé !");
                  
                  setFormData({ ...formData, rappels: [...(formData.rappels || []), { date: tDate, heure: tHeure, label: label }] });
                  setTempRappelDate(''); 
                  setTempRappelHeure('');
              }}
              className="absolute -bottom-5 bg-brand-dark text-white p-2.5 rounded-full shadow-lg hover:scale-110 hover:bg-brand-red transition-all z-10 border-4 border-white"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="flex justify-center pt-8">
            <button 
              type="button"
              disabled={!isCol1Valid || !isCol2Valid}
              onClick={() => {
                setShowValidationModal(true);

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
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-8 w-full max-w-2xl border-t-4 border-brand-red animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            {/* En-tête */}
            <div className="flex justify-end shrink-0 mb-2">
              <button type="button" onClick={() => setShowMsgModal(false)} className="text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-brand-red transition-colors p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 pr-2">

            <div className="flex flex-col md:flex-row gap-8 mt-4">
              
              {/* Colonne Gauche */}
              <div className="flex-1 md:border-r border-slate-100 md:pr-6">
                <h3 className="text-xl font-bold text-center mb-4 text-brand-dark">Liste Messages</h3>
                <div className="space-y-3 max-h-[220px] md:max-h-[300px] overflow-y-auto pr-2">
                  
                  {/* 1. Sécurité sur le .map() des templates */}
                  {Array.isArray(dbTemplates) && dbTemplates.map((tpl) => (
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

                  {/* 2. Sécurité sur le .length pour le message "Aucun modèle" */}
                  {(!Array.isArray(dbTemplates) || dbTemplates.length === 0) && (
                    <p className="text-sm text-slate-500 italic text-center">
                      Aucun modèle. Allez dans Paramètres.
                    </p>
                  )}
                  
                </div>
              </div>

              {/* Colonne Droite */}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-center mb-4 text-brand-dark">Champs du modèle</h3>
                <div className="grid grid-cols-1 gap-4 max-h-[220px] md:max-h-[300px] overflow-y-auto pr-2">
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
                           <input type={inputType} value={msgFields[key]} onChange={e => setMsgFields({...msgFields, [key]: e.target.value})} onClick={(e) => (inputType === 'date' || inputType === 'time') && e.target.showPicker && e.target.showPicker()} className={`w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red outline-none transition-all shadow-sm ${(inputType === 'date' || inputType === 'time') ? '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer' : ''}`} />
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
                  
                  Object.keys(msgFields).forEach(key => {
                    if (key.toLowerCase() !== 'nom' && key.toLowerCase() !== 'prenom' && key.toLowerCase() !== 'date' && key.toLowerCase() !== 'heure') {
                        const regex = new RegExp(`\\{${key}\\}`, 'gi');
                        baseMessage = baseMessage.replace(regex, msgFields[key]);
                    }
                  });
                  const dateVal = msgFields['Date'] || formData.date || '';
                  const heureVal = msgFields['Heure'] || formData.heure || '';
                  baseMessage = baseMessage.replace(/\{Date\}/gi, dateVal).replace(/\{Heure\}/gi, heureVal);
                  
                  let smsMsg = baseMessage;
                  if (formData.clients.length === 1) {
                    smsMsg = smsMsg.replace(/\{Prenom\}/gi, formData.clients[0].firstName || '')
                                   .replace(/\{Nom\}/gi, formData.clients[0].lastName || '');
                  }

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
        </div>
      )}

      {/* ================= 2. POP-UP RÉCURRENCE ================= */}
      {showRecurrenceModal && (
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-8 w-full max-w-xl border-b-4 border-brand-red animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            {/* En-tête */}
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl sm:text-2xl font-bold text-brand-dark">Programmer une Récurrence</h3>
              <button type="button" onClick={() => setShowRecurrenceModal(false)} className="text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-brand-red transition-colors p-2 rounded-full shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto px-2 pb-2 flex-1 min-h-[150px]">
              {RécurrenceRows.map((row, idx) => (
                <div key={row.id} className="flex flex-col gap-3 border border-slate-200 p-4 rounded-xl shadow-sm bg-slate-50 relative mt-3">
                  <div className="absolute -top-3 left-4 bg-brand-dark text-white text-xs font-bold px-3 py-1 rounded-full">Dates N°{idx + 1}</div>
                  
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-end w-full mt-2">
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Date</label>
                      <input type="date" value={row.date} onChange={e => { const copy=[...RécurrenceRows]; copy[idx].date = e.target.value; setRécurrenceRows(copy); }} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-red cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:opacity-0" />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">Heure</label>
                      <input type="time" value={row.heure} onChange={e => { const copy=[...RécurrenceRows]; copy[idx].heure = e.target.value; setRécurrenceRows(copy); }} onClick={(e) => e.target.showPicker && e.target.showPicker()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-red cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:opacity-0" />
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
                  
                  {/* Bloc Personnaliser */}
                  {row.repeat === 'Personnaliser' && (
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mt-2 p-3 bg-white rounded-lg border border-brand-red/30 animate-in fade-in shadow-sm w-full sm:w-max">
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
              
              <div className="mt-4 pt-4 flex justify-center shrink-0 border-t border-slate-100">
                <button onClick={() => { 

                  const hasEmpty = RécurrenceRows.some(r => !r.date || !r.heure);
                  if(hasEmpty) {
                    return alert("Veuillez remplir la date et l'heure pour chaque bloc de récurrence.");
                  }

                  const hasPast = RécurrenceRows.some(r => !isFuture(r.date, r.heure));
                  if(hasPast && !isUpdate) {
                    return alert("Erreur : Toutes les dates et heures de la récurrence doivent être dans le futur !");
                  }

                  setFormData({...formData, recurrences: RécurrenceRows, date: '', heure: ''}); 
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
        <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">       
        <div className=" max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-8 animate-in fade-in zoom-in duration-200">
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

              {formData.recurrences && formData.recurrences.length>0 && (
                <div>
                  <p className="font-bold text-brand-dark">recurrences :</p>
                  <ul className="list-disc list-inside text-slate-700">
                    {formData.recurrences.map((r,i) => (
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

              {/* APERÇU EMAIL */}
              {formData.emailEnabled && formData.messageEmail && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                  <p className="text-xs font-bold text-brand-dark mb-1">Aperçu Email :</p>
                  <p className="text-sm italic text-slate-600">"{formData.messageEmail}"</p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-center gap-3 sm:space-x-4 mt-4">
              <button onClick={() => setShowValidationModal(false)} className=" w-full sm:w-auto  px-6 py-2 border-2 border-slate-200 text-slate-600 font-bold rounded-full hover:bg-slate-50 transition-colors">
                Modifier
              </button>
              <button 
                disabled={isSubmitting}
                onClick={handleConfirm} 
                className={` w-full sm:w-auto  px-6 py-2 text-white font-bold rounded-full shadow-md transition-colors ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-brand-red hover:bg-rose-700'}`}
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
