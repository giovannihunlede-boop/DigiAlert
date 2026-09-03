import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../services/api';
import { ChevronLeft, Edit2, ChevronRight, Calendar as CalendarIcon, List, Trash2 } from 'lucide-react';


const RED = '#EA1552';
const INK = '#0B0D1F';
const PAGE_BG = '#F3F4F8';

const EVENT_PALETTE = [
  { bg: '#50B787', text: '#0F172A' },
  { bg: '#B8C556', text: '#0F172A' },
  { bg: '#4182A4', text: '#FFFFFF' },
  { bg: '#E11D48', text: '#FFFFFF' },
  { bg: '#F59E0B', text: '#0F172A' },
];

const STATUS_COLORS = {
  pending: { bg: '#eab308', text: '#713f12' },
  sent: { bg: '#4ade80', text: '#064e3b' },
  failed: { bg: '#E11D48', text: '#ffffff' },
  DEFAULT: { bg: '#3b82f6', text: '#eff6ff' },
};

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const ROW_HEIGHT = 96;
const HOUR_COL_WIDTH = 80;
const DAY_COL_MIN_WIDTH = 120;

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMondayOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatTime = (h) => {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, '0')}h${String(mins).padStart(2, '0')}`;
};

const normalizeAppointment = (event) => {
  // Récupèreration des noms envoyés par C# 
  const startStr = event.dateHeureDebut || event.DateHeureDebut || event.startDateTime || event.StartDateTime;
  const endStr = event.dateHeureFin || event.DateHeureFin || event.endDateTime || event.EndDateTime;
  const titleStr = event.titre || event.Titre || event.title || event.Title || 'Sans Titre';
  const statusStr = event.statut || event.Statut || event.status || event.Status || 'PLANNED';

  const start = new Date(startStr);
  const end = new Date(endStr);

  let startHour = start.getHours() + start.getMinutes() / 60;
  let endHour = end.getHours() + end.getMinutes() / 60;

  if (endHour === 0 && startHour > 0) {
    endHour = 24;
  }

  // Récupèration des noms du contact associé.
  const clientName = event.participants && event.participants.length > 0
    ? event.participants.map((p) => {
        const fn = p.contact?.prenom || p.contact?.firstName || p.prenom || p.firstName || '';
        const ln = p.contact?.nom || p.contact?.lastName || p.nom || p.lastName || '';
        return `${fn} ${ln}`.trim();
      }).join(' & ')
    : 'Client(s)';

  const evtId = event.idEvent || event.IdEvent || event.id || 0;
  
  // Vérification de l'id event
  const colorIndex = typeof evtId === 'number' ? evtId % EVENT_PALETTE.length : 0;
  const color = EVENT_PALETTE[colorIndex] || EVENT_PALETTE[0];

  return {
    id: evtId,
    date: start,
    realEnd: end,
    start: startHour,
    end: endHour,
    title: titleStr,
    status: statusStr.toUpperCase(),
    clientName,
    nbClients: event.participants ? event.participants.length : 0,
    hasSentReminders: event.hasSentReminders || event.HasSentReminders || false,
    bg: color.bg,
    text: color.text,
  };
};

const getDurationText = (start, end) => {
  const durationMins = Math.round((end - start) * 60);
  if (durationMins >= 60) {
    return `${Math.floor(durationMins / 60)}h${(durationMins % 60).toString().padStart(2, '0')}`;
  }
  return `${durationMins} min`;
};

const EventsListModal = ({ appointments, isOpen, onClose, onDelete, onEdit }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200 overflow-hidden border-2 border-slate-200">
        
        {/* 
          1. EN-TÊTE FIXE 
        */}
        <div className="hidden md:grid bg-[#DEDEDE] grid-cols-[80px_2.5fr_1.5fr_1fr_1.5fr_180px] items-center shrink-0 shadow-sm z-20 border-b border-slate-200">
          <div className="p-5 font-extrabold text-brand-dark pl-8 rounded-tl-3xl">N°</div>
          <div className="p-5 font-extrabold text-brand-dark">Titre</div>
          <div className="p-5 font-extrabold text-brand-dark">Date & heure</div>
          <div className="p-5 font-extrabold text-brand-dark">Durée</div>
          <div className="p-5 font-extrabold text-brand-dark">Client(s)</div>
          <div className="p-5 font-extrabold text-brand-dark text-right pr-8 rounded-tr-3xl">Actions</div>
        </div>

        {/* 
          2. ZONE SCROLLABLE
        */}
        <div className="overflow-y-auto flex-1 bg-white">
          <div className="flex flex-col divide-y divide-slate-100">
            {appointments.map((evt, idx) => {
              const durationStr = getDurationText(evt.start, evt.end);
              const now = new Date().getTime();
              
              // MOTEUR D'ÉTAT TEMPOREL
              const hasStarted = evt.date.getTime() <= now;
              const isFinished = evt.realEnd.getTime() <= now;
              const isCancelled = (evt.status || '').toUpperCase() === 'CANCELLED';

              let statusBadge = '';
              if (isCancelled) statusBadge = 'Annulé';
              else if (isFinished) statusBadge = 'Terminé';
              else if (hasStarted) statusBadge = 'En cours';

              return (
                <div 
                  key={evt.id} 
                  className="flex flex-col md:grid md:grid-cols-[80px_2.5fr_1.5fr_1fr_1.5fr_180px] md:items-center p-4 md:p-0 border-b border-slate-200 md:border-none gap-2 md:gap-0 hover:bg-slate-50 transition-colors"
                >
                  <div className="hidden md:block p-5 text-slate-800 font-bold pl-8">{idx + 1}</div>
                  
                  <div className="text-brand-dark font-extrabold text-lg md:text-base flex justify-between items-start md:p-5">
                    <span className="truncate pr-2">{evt.title}</span>
                    
                  </div>
                  
                  <div className="md:p-5 text-slate-600 leading-tight font-medium text-sm md:text-base">
                    <span className="md:hidden font-bold mr-2">Date:</span>
                    {evt.date.toLocaleDateString('fr-FR')} à <span className="text-brand-dark">{formatTime(evt.start)}</span>
                  </div>
                  
                  <div className="md:p-5 text-slate-600 font-bold text-sm md:text-base">
                    <span className="md:hidden font-medium mr-2">Durée:</span>
                    {durationStr}
                  </div>
                  
                  <div className="md:p-5 text-slate-600 font-medium truncate pr-2 text-sm md:text-base">
                    <span className="md:hidden font-bold mr-2">Client:</span>
                    {evt.clientName}
                  </div>
                  
                  {/* Colonne Actions */}
                  <div className="md:p-5 mt-3 md:mt-0 flex justify-start md:justify-end gap-3 items-center md:pr-8">
                    
                    {/* BOUTON Modifier */}
                    <button
                      onClick={() => onEdit(evt)}
                      className={`p-2.5 rounded-xl shadow-sm transition-all flex-shrink-0 ${evt.hasSentReminders || hasStarted || isCancelled ? 'text-slate-300 bg-slate-50 cursor-not-allowed border border-slate-100' : 'text-slate-600 hover:text-white hover:bg-brand-dark border border-slate-200'}`}
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* BADGE */}
                    {hasStarted || isCancelled ? (
                      <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center shadow-sm uppercase tracking-wider flex-shrink-0 ${
                        isCancelled ? 'bg-red-50 text-brand-red border border-red-200' : 
                        isFinished ? 'bg-slate-100 text-slate-400 border border-slate-200' : 
                        'bg-blue-50 text-blue-600 border border-blue-200 animate-pulse'
                      }`}>
                        {statusBadge}
                      </span>
                    ) : (
                      <button
                        onClick={() => onDelete(evt.id)}
                        className="p-2.5 text-slate-600 bg-white hover:text-white hover:bg-brand-red border border-slate-200 rounded-xl shadow-sm transition-all flex-shrink-0"
                        title={evt.hasSentReminders ? "Annuler et prévenir le client" : "Annuler le RDV"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                  </div>
                </div>
              );
            })}
            
            {appointments.length === 0 && (
              <div className="p-10 text-center text-slate-500 font-medium italic bg-white">
                Aucun événement programmé.
              </div>
            )}
          </div>
        </div>

        {/* 3. FOOTER */}
        <div className="bg-[#DEDEDE] p-4 md:p-5 px-4 md:px-8 flex justify-center md:justify-between items-center shrink-0 border-t border-slate-300">
          <span className="hidden md:inline-block px-5 py-2 border-2 border-slate-400 text-slate-600 bg-white/50 rounded-xl font-bold text-sm uppercase tracking-wider">
            Liste des Événements
          </span>
          <button
            onClick={onClose}
            className="w-full md:w-auto px-8 py-3 md:py-2.5 font-bold text-brand-dark bg-white border-b-4 border-brand-red rounded-xl hover:bg-slate-50 active:translate-y-[2px] active:border-b-2 transition-all shadow-sm"
          >
            Quitter
          </button>
        </div>
      </div>
    </div>
  );
};


const Agenda = ({ onCreateNew: _onCreateNew }) => {
  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}h00`);
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const [cancelModal, setCancelModal] = useState({ isOpen: false, eventId: null, message: '' });
  const [isCancelling, setIsCancelling] = useState(false);

  const navigate = useNavigate();
  const containerRef = useRef(null);
  const eightAmRef = useRef(null);
  const dateInputRef = useRef(null);

  const weekDates = useMemo(() => {
    const monday = getMondayOfWeek(new Date(selectedDate));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const eventStyle = (start, end, bg, text) => {
    const height = (end - start) * ROW_HEIGHT;
    return {
      top: `${start * ROW_HEIGHT}px`,
      height: `${height < 28 ? 28 : height}px`,
      backgroundColor: bg,
      color: text || '#fff',
      borderLeft: `4px solid ${RED}`,
      zIndex: 10,
    };
  };

  const handleDeleteEvent = async (idEvent) => {
    const evtToCancel = appointments.find(a => a.id === idEvent);
    if (!evtToCancel) return;

    if (evtToCancel.hasSentReminders) {
      setCancelModal({ isOpen: true, eventId: idEvent, message: '' });
      return; 
    }

    if (!window.confirm("Voulez-vous vraiment annuler cet événement (et tous ses rappels en attente) ?")) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/api/Events/${idEvent}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json(); 
        
        setAppointments((prev) => prev.filter((a) => a.id !== idEvent));
        alert(`${data.message || data.Message || "Événement annulé avec succès"}`);
      } else {
        const errText = await res.text();
        try {
          const errObj = JSON.parse(errText);
          
          if (errObj.RequiresCancellationMessage || errObj.requiresCancellationMessage) {
            setCancelModal({ isOpen: true, eventId: idEvent, message: '' });
            return;
          }
          
          alert(`❌ ${errObj.message || errObj.Message || "Action impossible."}`);
        } catch (e) {
          alert("❌ Erreur de communication avec le serveur.");
        }
      }
    } catch (e) {
      console.error('Erreur suppression:', e);
    }
  };

  const submitCancellation = async () => {
    setIsCancelling(true);
    try {
      const res = await fetchWithAuth(`/api/Events/${cancelModal.eventId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ Message: cancelModal.message }),
      });

      if (res.ok) {
        const data = await res.json();
        setAppointments((prev) => prev.filter((a) => a.id !== cancelModal.eventId));
        setCancelModal({ isOpen: false, eventId: null, message: '' });

        const successMsg = data.message || data.Message || "Rendez-vous annulé. Les messages d'excuse vont partir.";
        alert(`${successMsg}`);
      } else {
        const errText = await res.text();
        try {
          const errObj = JSON.parse(errText);
          alert(`❌ ${errObj.message || errObj.Message || "Erreur lors de l'annulation"}`);
        } catch (e) {
          alert("❌ Erreur lors de l'annulation.");
        }
      }
    } catch (error) {
      console.error('Erreur annulation avec message:', error);
      alert("Erreur réseau lors de l'annulation.");
    } finally {
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetchWithAuth('/api/Events');
        if (!res.ok) return;

        const data = await res.json();
        setAppointments(Array.isArray(data) ? data.map(normalizeAppointment) : []);
      } catch (error) {
        console.error('Erreur de récupération :', error);
      }
    };

    loadEvents();
  }, []);

  useEffect(() => {
    if (containerRef.current && eightAmRef.current) {
      containerRef.current.scrollTop = eightAmRef.current.offsetTop - 20;
    }
  }, [weekDates]);

  const prevWeek = () => {
    const monday = getMondayOfWeek(new Date(selectedDate));
    monday.setDate(monday.getDate() - 7);
    setSelectedDate(formatDateInput(monday));
  };

  const nextWeek = () => {
    const monday = getMondayOfWeek(new Date(selectedDate));
    monday.setDate(monday.getDate() + 7);
    setSelectedDate(formatDateInput(monday));
  };

  const openEventEditor = (evtObj) => {
    const now = new Date().getTime();

    if (evtObj.date.getTime() <= now) {
      alert("Modification impossible : Cet événement a déjà commencé ou est terminé.");
      return;
    }

    if (evtObj.hasSentReminders) {
      alert("Modification impossible : Un rappel (SMS ou Email) a déjà été envoyé au client. Le rendez-vous est verrouillé.");
      return;
    }
    
    setIsListModalOpen(false);
    navigate('/nouveau-rdv', { state: { editEventId: evtObj.id } });
  };

  const gridMinWidth = HOUR_COL_WIDTH + weekDates.length * DAY_COL_MIN_WIDTH;

  return (
    <div className="h-screen flex flex-col overflow-hidden p-2 sm:p-4 md:p-10" style={{ backgroundColor: PAGE_BG }}>
      <div className="flex flex-col gap-4 justify-between items-start mb-6 shrink-0 md:flex-row">
        <div className="relative flex shrink-0">
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker()}
            className="bg-brand-red text-white p-2 rounded-lg hover:bg-rose-700 transition-colors flex items-center justify-center relative z-10"
          >
            <CalendarIcon className="w-5 h-5" />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <h4 className="text-base sm:text-xl md:text-2xl font-extrabold truncate" style={{ color: INK }}>
          {weekDates[0] ? `Semaine du ${weekDates[0].getDate()} ${MOIS_FR[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}` : 'Semaine'}
        </h4>
        
      </div>

      <div className="flex-1 flex flex-col overflow-hidden rounded-3xl shadow-lg bg-white border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 sm:p-6 border-b border-slate-100 shrink-0">
          <h3 className="text-xl sm:text-2xl font-extrabold" style={{ color: INK }}>
            {weekDates[0] ? `Semaine du ${weekDates[0].getDate()} ${MOIS_FR[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}` : 'Semaine'}
          </h3>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsListModalOpen(true)}
              className="p-2 sm:px-4 sm:py-2 bg-brand-red text-white rounded-lg shadow-md hover:bg-rose-700 transition-colors flex items-center justify-center flex-1 sm:flex-none"
              title="Vue Liste"
            >
              <List className="w-5 h-5 sm:mr-2" />
              <span className="font-bold hidden sm:inline">Liste</span>
            </button>

            <div className="flex space-x-1 sm:space-x-2 border-l border-slate-200 pl-3">
              <button onClick={prevWeek} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors bg-white">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={nextWeek} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors bg-white">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden bg-white relative no-scrollbar">
          <div className="flex flex-col h-full" style={{ minWidth: `${gridMinWidth}px` }}>
            
            <div ref={containerRef} className="flex-1 overflow-y-auto relative bg-white" style={{ scrollbarGutter: 'stable' }}>
              
              {/* EN-TÊTE */}
              <div className="flex sticky top-0 z-30 bg-slate-50 border-b border-slate-200 shadow-sm">
                <div style={{ width: HOUR_COL_WIDTH }} className="shrink-0 bg-slate-50 border-r border-slate-200" />
                {weekDates.map((d, idx) => (
                  <div key={idx} className="flex-1 text-center py-4 font-bold text-slate-700 text-lg border-r border-slate-200 last:border-r-0" style={{ minWidth: DAY_COL_MIN_WIDTH }}>
                    {DAY_LABELS[idx]} {d.getDate()}
                  </div>
                ))}
              </div>

              {/* CORPS DE L'AGENDA */}
              <div className="flex relative">

                {/* COLONNE DES HEURES */}
                <div style={{ width: HOUR_COL_WIDTH }} className="shrink-0 border-r border-slate-200 bg-white">
                  {hours.map((hour, idx) => (
                    <div key={idx} ref={hour === '08h00' ? eightAmRef : null} className="h-24 relative border-t border-transparent">
                      <span className={`absolute right-2 text-xs font-bold text-slate-400 bg-white px-1 ${idx === 0 ? 'top-1.5' : '-top-2.5'}`}>
                        {hour}
                      </span>
                    </div>
                  ))}
                </div>

                {/* GRILLE DES JOURS */}
                <div className="flex flex-1 relative">
                  {weekDates.map((d, idx) => (
                    <div key={idx} className="flex-1 border-r border-slate-200 relative" style={{ minWidth: DAY_COL_MIN_WIDTH }}>

                      {hours.map((_, hIdx) => (
                        <div key={hIdx} className="h-24 border-t border-slate-100" />
                      ))}

                      {appointments.filter((a) => sameDay(a.date, d)).map((a, i) => (
                        <div
                          key={i}
                          className="absolute left-1 right-1 rounded-md p-1.5 shadow-sm cursor-pointer hover:brightness-105 flex flex-col overflow-hidden no-scrollbar z-10 hover:z-50 hover:shadow-lg transition-all"
                          style={eventStyle(a.start, a.end, a.bg, a.text)}
                          onClick={() => openEventEditor(a)}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget;
                            if (el.scrollHeight > el.clientHeight) {
                              el.scrollInterval = setInterval(() => {
                                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
                                  el.scrollTop = 0;
                                } else {
                                  el.scrollTop += 1;
                                }
                              }, 40);
                            }
                          }}
                          onMouseLeave={(e) => {
                            const el = e.currentTarget;
                            clearInterval(el.scrollInterval);
                            el.scrollTop = 0;
                          }}
                        >
                          <p className="text-[10px] font-bold shrink-0 opacity-90">{formatTime(a.start)} - {formatTime(a.end)}</p>
                          <p className="text-xs font-semibold leading-tight mt-0.5 break-words">{a.title}</p>
                          <p className="text-[10px] font-medium opacity-90 truncate">{a.clientName}</p>
                          <p className="text-[10px] font-medium opacity-90">Nb Clients: {a.nbClients}</p>

                          {a.status && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                              style={{
                                backgroundColor: STATUS_COLORS[a.status?.toLowerCase()]?.bg || STATUS_COLORS.pending.bg,
                                color: STATUS_COLORS[a.status?.toLowerCase()]?.text || STATUS_COLORS.pending.text,
                              }}
                            >
                              {a.status}
                            </span>
                          )}
                        </div>
                      ))}

                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      <EventsListModal
        appointments={appointments}
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        onDelete={handleDeleteEvent}
        onEdit={openEventEditor}
      />

      {/* ================= MODALE D'ANNULATION  ================= */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(225,29,72,0.15)] w-full max-w-lg p-5 md:p-8 mx-2 md:mx-0 animate-in zoom-in duration-200 border-2 border-rose-100 relative">
            
            <h3 className="text-2xl font-extrabold text-brand-dark mb-2 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-brand-red animate-pulse"></span>
              Annulation Requise
            </h3>
            <p className="text-slate-600 mb-6">
              Un ou plusieurs rappels ont <strong>déjà été envoyés</strong> pour ce rendez-vous. 
              Vous devez rédiger un message d'excuse/annulation qui sera envoyé <strong className="text-brand-red">immédiatement</strong> aux clients concernés.
            </p>

            <textarea
              className="w-full h-32 p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red resize-none text-slate-700"
              placeholder="Ex: Bonjour {Firstname}, le Dr Koffi a un empêchement de dernière minute. Votre RDV de demain est annulé..."
              value={cancelModal.message}
              onChange={(e) => setCancelModal({ ...cancelModal, message: e.target.value })}
            ></textarea>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setCancelModal({ isOpen: false, eventId: null, message: '' })}
                disabled={isCancelling}
                className="px-6 py-2 border border-slate-300 rounded-full text-slate-600 font-bold hover:bg-slate-50 transition-colors"
              >
                Retour
              </button>
              <button
                onClick={submitCancellation}
                disabled={isCancelling || cancelModal.message.trim().length < 5}
                className={`px-6 py-2 rounded-full font-bold text-white shadow-md transition-all ${
                  isCancelling || cancelModal.message.trim().length < 5
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-brand-red hover:bg-rose-700 active:scale-95'
                }`}
              >
                {isCancelling ? 'Annulation...' : 'Envoyer & Annuler le RDV'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Agenda;