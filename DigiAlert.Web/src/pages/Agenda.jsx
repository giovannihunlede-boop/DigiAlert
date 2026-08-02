import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../services/api';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Trash2 } from 'lucide-react';



const RED = '#EA1552';
const INK = '#0B0D1F';
// Les couleurs exactes de ta maquette !
const EVENT_PALETTE = [
  { bg: '#50B787', text: '#0F172A' }, // Vert
  { bg: '#B8C556', text: '#0F172A' }, // Olive
  { bg: '#4182A4', text: '#FFFFFF' }, // Bleu
  { bg: '#E11D48', text: '#FFFFFF' }, // Rouge
  { bg: '#F59E0B', text: '#0F172A' }, // Jaune
];
const PAGE_BG = '#F3F4F8';

// Fonction pour trouver le lundi de la semaine en cours
const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const STATUS_COLORS = {
  'pending': { bg: '#eab308', text: '#713f12' }, // Jaune/Moutarde
  'sent': { bg: '#4ade80', text: '#064e3b' },    // Vert
  'failed': { bg: '#E11D48', text: '#ffffff' },  // Rouge
  'DEFAULT': { bg: '#3b82f6', text: '#eff6ff' }  // Bleu par défaut
};

const getMondayOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const ROW_HEIGHT = 96; // h-24
const HOUR_COL_WIDTH = 80; // w-20
const DAY_COL_MIN_WIDTH = 120;

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const Agenda = ({ onCreateNew }) => {
  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}h00`);
  const [appointments, setAppointments] = useState([]);
  // const [selectedDate, setSelectedDate] = useState('');
  // const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date())); 
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0] // today's date in yyyy-MM-dd
  );

  const navigate = useNavigate();

  const [isListModalOpen, setIsListModalOpen] = useState(false);
  
  const [weekDates, setWeekDates] = useState(() => {
    const monday = getMondayOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  });


  // Fonction pour supprimer un événement
  const handleDeleteEvent = async (idEvent) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cet événement (et tous ses rappels) ?")) return;
    try {
      const res = await fetchWithAuth(`/api/Events/${idEvent}`, { method: 'DELETE' });
      if (res.ok) {
        // On retire l'événement de l'affichage instantanément
        setAppointments(prev => prev.filter(a => a.id !== idEvent));
      } else {
        alert("Erreur lors de la suppression.");
      }
    } catch (e) {
      console.error("Erreur suppression:", e);
    }
  };
  

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetchWithAuth('/api/Events');
        if (res.ok) {
          const data = await res.json();
          console.log("RDV reçus depuis l'API :", data); 
          setAppointments(data.map(e => {
          // L'astuce de pro : on check la version C# ET la version JS !
          const startStr = e.startDateTime || e.StartDateTime;
          const endStr = e.endDateTime || e.EndDateTime;
          const titleStr = e.title || e.Title;
          const statusStr = e.status || e.Status;

          const start = new Date(startStr);
          const end = new Date(endStr);

          let startHour = start.getHours() + start.getMinutes() / 60;
          let endHour = end.getHours() + end.getMinutes() / 60;
          
          // 🧠 MAGIE : Si ça finit à 00h00, ça veut dire 24h00 pour notre calendrier !
          if (endHour === 0 && startHour > 0) {
            endHour = 24;
          }

          // On génère le nom complet de TOUS les clients du RDV
          const clientName = e.participants && e.participants.length > 0 
            ? e.participants.map(p => `${p.firstName || ''} ${p.lastName || ''}`.trim()).join(' & ') 
            : 'Client(s)';

          // On attribue une couleur de la palette basée sur l'ID de l'événement
          const color = EVENT_PALETTE[(e.idEvent || e.IdEvent) % EVENT_PALETTE.length];
          
          return {
            id: e.idEvent || e.IdEvent, // On stocke l'ID !
            date: start,
            start: startHour, 
            end: endHour, 
            title: titleStr,
            
            clientName: clientName,
            nbClients: e.participants ? e.participants.length : 0, // 👈 NOUVEAU : On stocke le nombre de clients
            
            bg: color.bg,
            text: color.text
          };
        }));
      }
    } catch (error) {
      console.error("Erreur de récupération :", error);
    }
  };
    loadEvents();
  }, [weekDates]);

  const containerRef = useRef(null);
  const eightAmRef = useRef(null);
  const dateInputRef = useRef(null);

  useEffect(() => {
    const monday = getMondayOfWeek(new Date(selectedDate));
    setWeekDates(Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    }));
  }, [selectedDate]);

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

// 2. Style avec hauteur minimale pour que le bloc ne soit jamais écrasé
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

  // 1. Calcul mathématique exact des minutes
  const formatTime = (h) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${String(hours).padStart(2, '0')}h${String(mins).padStart(2, '0')}`;
  };
  const gridMinWidth = HOUR_COL_WIDTH + weekDates.length * DAY_COL_MIN_WIDTH;

  return (
    <div className="h-screen flex flex-col overflow-hidden p-10" style={{ backgroundColor: PAGE_BG }}>
      
      <div className="flex flex-col gap-4 justify-between items-start mb-6 shrink-0 md:flex-row">
        <div className="flex items-center gap-4 relative w-max">
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker()} // showPicker ouvre le calendrier natif
            className="p-3 rounded-xl shadow-md bg-brand-red text-white flex items-center justify-center"
            style={{ backgroundColor: RED }}
          >
            <CalendarIcon className="w-6 h-6" />
          </button>

          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="sr-only" // cache l’input visuellement mais garde l’accessibilité
          />

          <div className="text-sm text-slate-600">
            Date sélectionnée: <strong>{new Date(selectedDate).toLocaleDateString('fr-FR')}</strong>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-600">
          <span className="font-semibold">Semaine :</span>
          <span>{weekDates[0] ? `${weekDates[0].getDate()} ${MOIS_FR[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}` : '-'}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col flex-1 min-h-0 overflow-hidden">

        <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
          <h3 className="text-2xl font-extrabold" style={{ color: INK }}>
            {weekDates[0] ? `Semaine du ${weekDates[0].getDate()} ${MOIS_FR[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}` : 'Semaine'}
          </h3>

          <div className="flex items-center space-x-3">
            {/* Le bouton Liste Rouge */}
            <button onClick={() => setIsListModalOpen(true)} className="p-2 bg-brand-red text-white rounded-lg shadow-md hover:bg-rose-700 transition-colors" title="Vue Liste">
              <List className="w-5 h-5" />
            </button>
            
            <div className="flex space-x-2 border-l border-slate-200 pl-3">
              <button onClick={prevWeek} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={nextWeek} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Un SEUL conteneur possède le scroll horizontal : l'en-tête des jours et la
            grille des heures sont dedans ensemble, donc ils bougent toujours en phase. */}
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="flex flex-col h-full" style={{ minWidth: `${gridMinWidth}px` }}>

            {/* En-tête des jours : suit le scroll horizontal, jamais le scroll vertical */}
            <div className="flex border-slate-200 bg-slate-100 shrink-0 overflow-y-auto"style={{ scrollbarGutter: 'stable' }}>
              
              <div style={{ width: HOUR_COL_WIDTH }} className="shrink-0 bg-white" />
              {weekDates.map((d, idx) => (
                <div key={idx} className="flex-1 text-center py-4 font-bold text-slate-700 text-lg border-l border-r border-slate-200" style={{ minWidth: DAY_COL_MIN_WIDTH }}>
                  {DAY_LABELS[idx]} {d.getDate()}
                </div>
              ))}
            </div>

            {/* Corps : scroll vertical uniquement ici, largeur héritée du wrapper ci-dessus */}
            <div ref={containerRef} className="flex flex-1 min-h-0 overflow-y-auto relative bg-white" style={{ scrollbarGutter: 'stable' }}>

              {/* Colonne des heures : simple empilement de div (pas de flex-col => pas de compression) */}
              <div style={{ width: HOUR_COL_WIDTH }} className="shrink-0 border-slate-200 relative pt-2 ">
                {hours.map((hour, idx) => (
                  <div key={idx} ref={hour === '08h00' ? eightAmRef : null} className="h-24 relative border-r">
                    <span className="absolute -top-3 right-3 text-sm font-medium text-slate-500">{hour}</span>
                  </div>
                ))}
              </div>

              {/* Colonnes des jours + événements, même structure que l'en-tête ci-dessus */}
              <div className="flex flex-1 relative">
                {weekDates.map((d, idx) => (
                  <div key={idx} className="flex-1 border-r border-slate-200 relative h-max" style={{ minWidth: DAY_COL_MIN_WIDTH }}>
                    {hours.map((_, hIdx) => (
                      <div key={hIdx} className="h-24 border-b border-slate-100" />
                    ))}

                    {appointments.filter((a) => sameDay(a.date, d)).map((a, i) => (
              <div 
                key={i} 
                className="absolute left-1 right-1 rounded-md p-1.5 shadow-sm cursor-pointer hover:brightness-105 flex flex-col overflow-hidden no-scrollbar z-10 hover:z-50 hover:shadow-lg transition-all" 
                style={eventStyle(a.start, a.end, a.bg, a.text)}
                // ⚙️ MOTEUR AUTOSCROLL ⚙️
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  // On vérifie s'il y a vraiment besoin de scroller (si le texte dépasse)
                  if (el.scrollHeight > el.clientHeight) {
                    el.scrollInterval = setInterval(() => {
                      // Si on arrive tout en bas, on remet à zéro (boucle infinie)
                      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
                        el.scrollTop = 0;
                      } else {
                        el.scrollTop += 1; // Vitesse du scroll (1px par 40ms)
                      }
                    }, 40);
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  clearInterval(el.scrollInterval); // On arrête le moteur
                  el.scrollTop = 0; // On remet le texte tout en haut
                }}
              >
                <p className="text-[10px] font-bold shrink-0 opacity-90">{formatTime(a.start)} - {formatTime(a.end)}</p>
                <p className="text-xs font-semibold leading-tight mt-0.5 break-words">{a.title}</p>
                      <p className="text-[10px] font-medium opacity-90 truncate">{a.clientName}</p>
                      <p className="text-[10px] font-medium opacity-90">Nb Clients: {a.nbClients}</p>
                      

                      {/* Affichage du statut avec couleur */}
                      {a.status && (
                        <span 
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                          style={{
                            backgroundColor: STATUS_COLORS[a.status]?.bg || STATUS_COLORS['pending']?.bg,
                            color: STATUS_COLORS[a.status]?.text || STATUS_COLORS['pending']?.text,
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
      {/* ================= MODALE : LISTE DES ÉVÉNEMENTS ================= */}
      {isListModalOpen && (
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200 overflow-hidden">
            
            {/* En-tête / Tableau */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#DEDEDE] sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 font-bold text-brand-dark rounded-tl-3xl">N°</th>
                    <th className="p-4 font-bold text-brand-dark">Titre</th>
                    <th className="p-4 font-bold text-brand-dark">Date&heure</th>
                    <th className="p-4 font-bold text-brand-dark">Duree</th>
                    <th className="p-4 font-bold text-brand-dark text-center rounded-tr-3xl">Nb Clients</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((apt, idx) => {
                    // Formatage de la date (ex: 12/09/2026)
                    const dateStr = apt.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    // Formatage de l'heure (ex: 15H35)
                    const timeStr = formatTime(apt.start).replace('h', 'H');
                    
                    // Calcul intelligent de la durée pour un affichage "5h45 min"
                    const dHours = Math.floor(apt.end - apt.start);
                    const dMins = Math.round(((apt.end - apt.start) % 1) * 60);
                    let dureeStr = '';
                    if (dHours > 0) dureeStr += `${dHours}h`;
                    if (dMins > 0) dureeStr += `${dMins} min`;
                    if (dureeStr === '') dureeStr = '0 min';

                    return (
                      <tr key={apt.id || idx} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-slate-800 font-medium">{idx + 1}</td>
                        <td className="p-4 text-brand-dark font-bold">{apt.title}</td>
                        <td className="p-4 text-slate-600 leading-tight">
                          {dateStr}<br/>{timeStr}
                        </td>
                        <td className="p-4 text-slate-600">{dureeStr}</td>
                        <td className="p-4 text-slate-800 font-bold text-center">{apt.nbClients}</td>
                      </tr>
                    );
                  })}
                  {appointments.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">
                        Aucun événement programmé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Footer de la modale */}
            <div className="bg-[#DEDEDE] p-4 px-8 flex justify-between items-center shrink-0">
              <span className="px-5 py-2 border border-slate-400 bg-transparent rounded-xl font-bold text-brand-dark">
                Liste des Evenement
              </span>
              <button 
                onClick={() => setIsListModalOpen(false)} 
                className="px-8 py-2 font-bold text-brand-dark border-b-4 border-brand-red rounded-xl hover:bg-gray-300 transition-colors"
              >
                Quiter
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODALE : LISTE DES ÉVÉNEMENTS ================= */}
      {isListModalOpen && (
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200 overflow-hidden">
            
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#DEDEDE] sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 font-bold text-brand-dark rounded-tl-3xl">N°</th>
                    <th className="p-4 font-bold text-brand-dark">Titre</th>
                    <th className="p-4 font-bold text-brand-dark">Date & heure</th>
                    <th className="p-4 font-bold text-brand-dark">Durée</th>
                    <th className="p-4 font-bold text-brand-dark">Client(s)</th>
                    <th className="p-4 font-bold text-brand-dark rounded-tr-3xl text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((evt, idx) => {
                    // Calcul de la durée pour l'affichage
                    const durationMins = Math.round((evt.end - evt.start) * 60);
                    const durationStr = durationMins >= 60 ? `${Math.floor(durationMins/60)}h${(durationMins%60).toString().padStart(2,'0')}` : `${durationMins} min`;
                    
                    return (
                      <tr key={evt.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-slate-800 font-medium">{idx + 1}</td>
                        <td className="p-4 text-brand-dark font-bold">
                          {/* 👈 LE LIEN MAGIQUE VERS LA PAGE NOUVEAU RDV */}
                          <span 
                            onClick={() => {
                              setIsListModalOpen(false);
                              navigate('/nouveau-rdv', { state: { editEventId: evt.id } });
                            }} 
                            className="cursor-pointer hover:text-brand-red hover:underline transition-colors"
                          >
                            {evt.subtitle !== 'COMPLETED' ? (
                              evt.title
                            ) : (
                              <span className="text-emerald-500">
                                {evt.title}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 leading-tight">
                          {evt.date.toLocaleDateString('fr-FR')}<br/>
                          {formatTime(evt.start)}
                        </td>
                        <td className="p-4 text-slate-600">{durationStr}</td>
                        <td className="p-4 text-slate-600 font-medium max-w-[200px] truncate">{evt.clientName}</td>
                        <td className="p-4 text-right">
                          {/* 👈 LE BOUTON POUBELLE */}
                          {/* Si l'événement est COMPLETED, on cache la corbeille, ou on la grise */}
                          {evt.subtitle !== 'COMPLETED' ? (
                            <button 
                              onClick={() => handleDeleteEvent(evt.idEvent)} // Remplace par ta vraie fonction
                              className="p-2 text-slate-400 hover:text-brand-red transition-colors bg-slate-50 rounded-full hover:bg-red-50 shadow-sm active:scale-95"
                              title="Supprimer cet événement"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">
                              Terminé
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {appointments.length === 0 && (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500">Aucun événement programmé.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-[#DEDEDE] p-4 px-8 flex justify-between items-center shrink-0">
              <span className="px-5 py-2 border border-slate-400 bg-transparent rounded-xl font-bold text-brand-dark">
                Liste des Événements
              </span>
              <button 
                onClick={() => setIsListModalOpen(false)} 
                className="px-8 py-2 font-bold text-brand-dark border-b-4 border-brand-red rounded-xl hover:bg-gray-300 transition-colors"
              >
                Quitter
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Agenda;