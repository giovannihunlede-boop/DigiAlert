import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CalendarDays, MessageSquare, Trash2, TrendingUp, Clock, User as UserIcon, Calendar as CalendarIcon, Mail, X} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchWithAuth } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG as QRCode } from 'qrcode.react';

const rangeLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const INK = '#0B0D1F';
const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

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

const getWeekDates = (date) => {
  const monday = getMondayOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const dateInputRef = useRef(null);

  const weekDates = useMemo(() => getWeekDates(new Date(selectedDate)), [selectedDate]);
  const selectedDayIndex = useMemo(() => {
    const day = new Date(selectedDate).getDay();
    return day === 0 ? 6 : day - 1;
  }, [selectedDate]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allReminders, setAllReminders] = useState([]);
  const [reminderFilter, setReminderFilter] = useState('ALL');
  
  const [showDailyEventsModal, setShowDailyEventsModal] = useState(false);
  const [eventsList, setEventsList] = useState([]);
  const [lastClick, setLastClick] = useState({ index: null, time: 0 });
  
  const navigate = useNavigate();
  const [showKioskModal, setShowKioskModal] = useState(false);

  const [cancelModal, setCancelModal] = useState({ isOpen: false, targetId: null, type: '', message: '' });
  const [isCancelling, setIsCancelling] = useState(false);

  const handleDeleteReminder = async (rem) => {
    const statusText = (rem.status || '').toUpperCase();
    const eventId = rem.idEvent || rem.IdEvent;
    const remId = rem.idReminder || rem.IdReminder;

    if (statusText === 'SENT') {
      setCancelModal({ isOpen: true, targetId: remId, type: 'reminder', message: '' });
      return;
    }

    const pendingForThisEvent = allReminders.filter(r => (r.idEvent || r.IdEvent) === eventId && (r.status || '').toUpperCase() === 'PENDING');
    
    if (statusText === 'PENDING' && pendingForThisEvent.length === 1) {
      if (!window.confirm("Attention : C'est le dernier rappel pour cet événement. Si vous le supprimez, l'événement entier sera annulé. Continuer ?")) return;
      
      try {
        const res = await fetchWithAuth(`/api/Events/${eventId}`, { method: 'DELETE' });
        if (res.ok) {
          setAllReminders(prev => prev.filter(r => (r.idEvent || r.IdEvent) !== eventId));
          fetchDashboardInfo();
          return alert("Dernier rappel supprimé. L'événement a été annulé.");
        }
      } catch (e) { console.error(e); }
      return;
    }

    if (!window.confirm("Voulez-vous vraiment supprimer ce rappel ? (L'email associé sera aussi supprimé si applicable)")) return;
    try {
      const res = await fetchWithAuth(`/api/Reminders/${remId}`, { method: 'DELETE' });
      if (res.ok) {
        setAllReminders(prev => prev.filter(r => (r.idReminder || r.IdReminder) !== remId));
        fetchDashboardInfo();
      } else {
        const errObj = await res.json();
        alert(`❌ ${errObj.message || errObj.Message || 'Erreur'}`);
      }
    } catch (e) { console.error(e); }
  };

  const submitCancellation = async () => {
    setIsCancelling(true);
    const url = cancelModal.type === 'event' 
      ? `/api/Events/${cancelModal.targetId}/cancel`
      : `/api/Reminders/${cancelModal.targetId}/cancel`;

    try {
      const res = await fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify({ Message: cancelModal.message }),
      });

      if (res.ok) {
        const data = await res.json();
        setAllReminders((prev) => prev.filter((a) => (a.idEvent || a.IdEvent) !== cancelModal.eventId));
        setCancelModal({ isOpen: false, eventId: null, message: '' });
        fetchDashboardInfo();
        alert(` ${data.message || data.Message || "Annulation traitée avec succès"}`);
      } else {
        const errText = await res.text();
        let errMsg = "Erreur lors de l'annulation";
        try {
          const errObj = JSON.parse(errText);
          errMsg = errObj.message || errObj.Message || errObj.title || errMsg;
        } catch (_) {}
        alert(`❌ Refusé : ${errMsg}`);
      }
    } catch (error) {
      alert("Erreur réseau lors de l'annulation.");
    } finally {
      setIsCancelling(false);
    }
  };

  const [summaryData, setSummaryData] = useState({
    rdvDuJour: 0,
    smsEnvoyes: 0,
    emailsEnvoyes: 0,
    tauxDelivrabilite: 0,
    prochainsSms: []
  });
  const [chartData, setChartData] = useState([]);

  const fetchDashboardInfo = useCallback(async () => {
    try {
      const summaryRes = await fetchWithAuth(`/api/Dashboard?targetDate=${selectedDate}`);
      if (summaryRes.ok) setSummaryData(await summaryRes.json());

      const eventsRes = await fetchWithAuth(`/api/Events?targetDate=${selectedDate}`);
      if(eventsRes.ok) {
        const allEvents = await eventsRes.json();
        setEventsList(allEvents);
      }

      const mondayStr = formatDateInput(weekDates[0]);
        const chartRes = await fetchWithAuth(`/api/Dashboard/chart?startDate=${mondayStr}`);
        
        if (chartRes.ok) {
            const counts = await chartRes.json();
            const today = new Date();
            
            const newChartData = weekDates.map((d, idx) => ({
                day: rangeLabels[idx],
                sms: counts[idx], // 👈 Le backend a déjà fait le calcul !
                isToday: d.getDate() === today.getDate() && 
                          d.getMonth() === today.getMonth() && 
                          d.getFullYear() === today.getFullYear()
            }));
            setChartData(newChartData);
        }
    } catch (error) {
      console.error("Erreur Dashboard :", error);
    }
  }, [selectedDate, weekDates]);

  useEffect(() => {
    fetchDashboardInfo();
  }, [fetchDashboardInfo]);

  const handleOpenModal = async (filter = 'ALL') => {
    setReminderFilter(filter);
    setIsModalOpen(true);
    try {
      const res = await fetchWithAuth('/api/Reminders');
      if (res.ok) setAllReminders(await res.json());
    } catch (error) {
      console.error("Erreur lors du chargement :", error);
    }
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-brand-bg">

      {/* Statistiques principales. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-4 md:mb-8">
        <div onClick={() => setShowDailyEventsModal(true)} className="bg-white p-4 md:p-6 rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 flex flex-col justify-between h-32 md:h-36 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer"> 
          <div className="flex justify-between items-start">
            <p className="text-slate-600 font-medium text-sm md:text-base truncate pr-2">
              Rendez-vous du {new Date(selectedDate).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}
            </p>
            <button type="button" onClick={(e) => { e.stopPropagation(); dateInputRef.current?.showPicker?.(); }} className="text-slate-400 hover:text-brand-red transition-colors shrink-0">
              <CalendarDays className="w-5 h-5" />
            </button>
          </div>
          <h3 className="text-5xl md:text-7xl font-semibold text-brand-dark tracking-tight">{summaryData.rdvDuJour}</h3>
        </div>

        <div onClick={() => handleOpenModal('PROCESSED')} className="bg-white p-4 md:p-6 rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 flex flex-col justify-between h-32 md:h-36 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer">
          <div className="flex justify-between items-start">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs font-bold text-blue-500 mb-1 truncate">{summaryData.emailsEnvoyes || 0} Emails envoyés</span>
              <p className="text-slate-600 font-medium text-sm md:text-base truncate">Rappels SMS envoyés</p>
            </div>
            <MessageSquare className="text-slate-400 w-5 h-5 shrink-0" />
          </div>
          <h3 className="text-5xl md:text-7xl font-semibold text-brand-dark tracking-tight">{summaryData.smsEnvoyes}</h3>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 flex flex-col justify-between h-32 md:h-36 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="flex justify-between items-start">
            <p className="text-slate-600 font-medium text-sm md:text-base truncate pr-2">Taux de délivrabilité API</p>
            <TrendingUp className="text-green-500 w-5 h-5 shrink-0" />
          </div>
          <h3 className="text-5xl md:text-7xl font-semibold text-brand-dark tracking-tight">{summaryData.tauxDelivrabilite}%</h3>
        </div>
      </div>

      {/* Graphique et liste des rappels. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
         
         {/* Graphique. */}
         <div className="md:col-span-2 bg-white rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 p-4 md:p-6 flex flex-col h-[380px] md:h-[400px]">
            
            {/* Header du graphique */}
            <div className="flex items-center justify-between mb-4 md:mb-6 shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => dateInputRef.current?.showPicker?.()}
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
              
              <h4 className="text-base sm:text-xl md:text-2xl font-extrabold text-brand-dark text-center truncate px-2">
                {weekDates[0] ? `Semaine du ${weekDates[0].getDate()} ${MOIS_FR[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}` : 'Semaine'}
              </h4>
              
              <div className="w-9"></div> {/* Espaceur */}
            </div>

            <div className="flex-1 w-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartData} 
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  onClick={(e) => {
                    if (e && e.activeTooltipIndex !== undefined) {
                      if (!weekDates[e.activeTooltipIndex]) return; 
                      const now = Date.now();
                      const clickedDate = weekDates[e.activeTooltipIndex];
                      
                      if (lastClick.index === e.activeTooltipIndex && (now - lastClick.time) < 300) {
                        setSelectedDate(formatDateInput(clickedDate));
                        setShowDailyEventsModal(true);
                      } else {
                        setSelectedDate(formatDateInput(clickedDate));
                        setLastClick({ index: e.activeTooltipIndex, time: now });
                      }
                    }
                  }}
                >
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={(props) => {
                      const { x, y, payload } = props;
                      const isToday = chartData[payload.index]?.isToday;
                      const isSelected = payload.index === selectedDayIndex;
                      
                      let textColor = '#94A3B8';
                      if (isToday) textColor = '#E11D48';
                      else if (isSelected) textColor = '#0F172A';
                      
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={16} textAnchor="middle" fill={textColor} fontSize={16} fontWeight="800" style={{ pointerEvents: 'none' }}>
                            {payload.value}
                          </text>
                          {isToday && (
                            <text x={0} y={0} dy={30} textAnchor="middle" fill="#E11D48" fontSize={9} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                              (aujourd'hui)
                            </text>
                          )}
                        </g>
                      );
                    }} 
                  />
                  <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="sms" name="Rappels" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === selectedDayIndex ? '#E11D48' : '#0F172A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* --- LISTE DES PROCHAINS RAPPELS --- */}
         <div className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 p-4 md:p-6 flex flex-col h-[380px] md:h-[400px]">
            <h4 className="font-bold text-brand-dark text-base md:text-lg text-center border-b border-slate-100 pb-3 md:pb-4 mb-3 shrink-0">
              Prochains Rappels
            </h4>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-[100px]">
              {(!summaryData?.prochainsSms || summaryData.prochainsSms.length === 0) ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-center text-slate-400 italic text-sm">Aucun rappel programmé.</p>
                </div>
              ) : (
                summaryData.prochainsSms.map((sms, index) => {
                    const rawDate = sms.scheduledTime || sms.scheduled_time || sms.date;
                    const dateObj = rawDate ? new Date(rawDate) : null;
                    const isValidDate = dateObj && !isNaN(dateObj.getTime());
                    const formattedTime = isValidDate ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    const formattedDate = isValidDate ? dateObj.toLocaleDateString('fr-FR') : 'Date inconnue';

                    return (
                        <div key={sms.idReminder || index} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex justify-between items-center gap-2 mb-2">
                                <div className="flex items-center text-brand-dark font-bold text-sm min-w-0">
                                    <UserIcon className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                                    <span className="truncate">{sms.clientName || "Client"}</span>
                                </div>
                                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0">
                                    En Attente
                                </span>
                            </div>
                            <div className="flex items-center text-slate-500 text-xs pl-5">
                                <Clock className="w-3 h-3 mr-1.5 shrink-0" />
                                <span className="truncate">{formattedTime} <span className="mx-1">•</span> {formattedDate}</span>
                            </div>
                        </div>
                    );
                })
              )}
            </div>

            {/* Boutons d'action */}
            <div className="pt-4 mt-2 flex flex-col gap-2 shrink-0 border-t border-slate-100">
              <button 
                onClick={() => handleOpenModal('PENDING')} 
                className="w-full py-2.5 font-bold text-brand-dark text-sm bg-slate-50 hover:bg-slate-100 border-b-2 border-brand-red rounded-xl transition-colors"
              >
                Voir la Liste Complète
              </button>
              <button 
                onClick={() => setShowKioskModal(true)} 
                className="w-full py-2 font-bold text-slate-500 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-700 transition-colors"
              >
                Kiosque Patient
              </button>
            </div>
         </div>
      </div>

      
      {/* Historique des rappels */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200 overflow-hidden border-2 border-slate-200">
            <div className="overflow-x-auto flex-1 min-h-0 flex flex-col">
              <div className="md:min-w-[760px] flex flex-col flex-1 min-h-0">
                <div className="hidden md:grid bg-slate-50 grid-cols-[80px_1.5fr_1.5fr_2fr_120px_100px_100px] items-center shrink-0 shadow-sm z-20 border-b border-slate-200">
                  <div className="p-4 font-bold text-brand-dark pl-4 sm:pl-8">N°</div>
                  <div className="p-3 font-bold text-brand-dark">Événement</div>
                  <div className="p-3 font-bold text-brand-dark">Destinataire</div>
                  <div className="p-1 font-bold text-brand-dark">Message</div>
                  <div className="p-1 font-bold text-brand-dark">Date d'envoi</div>
                  <div className="p-1 font-bold text-brand-dark">Statut</div>
                  <div className="font-bold text-brand-dark text-right pr-4 sm:pr-9">Actions</div>
                </div>

                <div className="overflow-y-auto flex-1 bg-white">
                  <div className="flex flex-col divide-y divide-slate-100">
                    {allReminders.filter(rem => {
                      const status = (rem.status || '').toUpperCase();
                      if (reminderFilter === 'PENDING') return status === 'PENDING';
                      if (reminderFilter === 'PROCESSED') return status === 'SENT' || status === 'FAILED';
                      return true;
                    }).map((rem, idx) => {
                      const dateObj = new Date(rem.scheduledTime);
                      const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'H');
                      const statusText = (rem.status || '').toUpperCase();
                      const isSent = statusText === 'SENT';
                      const isFailed = statusText === 'FAILED';
                      
                      return (
                        <div key={rem.idReminder || idx} className="flex flex-col md:grid md:grid-cols-[80px_1.5fr_1.5fr_2fr_120px_100px_100px] md:items-center hover:bg-slate-50 transition-colors p-4 md:p-0 gap-3 md:gap-0">
                          <div className="hidden md:block p-4 text-slate-800 font-medium pl-4 sm:pl-8">{idx + 1}</div>
                          <div className="md:p-4 text-brand-dark font-bold min-w-0 flex justify-between items-start md:block">
                            <div className="flex-1">
                              <span className="md:hidden text-slate-400 font-medium text-[11px] uppercase tracking-wider block mb-1">Événement</span>
                              <span onClick={() => { setIsModalOpen(false); navigate('/nouveau-rdv', { state: { editEventId: rem.idEvent } }); }} className="cursor-pointer hover:text-blue-600 hover:underline transition-colors block truncate">
                                {rem.eventTitle || 'Consultation'}
                              </span>
                            </div>
                            <div className="md:hidden shrink-0 ml-3">
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${isSent ? 'bg-green-50 text-green-600' : isFailed ? 'bg-red-50 text-brand-red' : 'bg-amber-50 text-amber-600'}`}>
                                  {isSent ? 'Envoyé' : isFailed ? 'Échoué' : 'En Attente'}
                              </span>
                            </div>
                          </div>
                          <div className="md:p-4 text-brand-dark font-bold min-w-0">
                            <span className="md:hidden text-slate-400 font-medium text-[11px] uppercase tracking-wider block mb-1">Destinataire</span>
                            <div className="flex items-center gap-2 truncate">
                              {(rem.channel || rem.Channel || 'SMS').toUpperCase() === 'EMAIL' ? <Mail className="w-4 h-4 text-blue-500 shrink-0" /> : <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0" />}
                              <span className="truncate">{rem.clientName}</span>
                            </div>
                          </div>
                          <div className="md:p-4 text-slate-500 text-sm align-middle min-w-0">
                            <span className="md:hidden text-slate-400 font-medium text-[11px] uppercase tracking-wider block mb-1">Message</span>
                            <div className="w-full overflow-hidden whitespace-nowrap no-scrollbar cursor-e-resize bg-slate-50 md:bg-transparent p-2 md:p-0 rounded-lg md:rounded-none border border-slate-100 md:border-none">
                              {rem.messageText}
                            </div>
                          </div>
                          <div className="md:p-4 text-slate-600 leading-tight text-sm">
                            <span className="md:hidden text-slate-400 font-medium text-[11px] uppercase tracking-wider block mb-1">Date d'envoi</span>
                            <span className="md:hidden">{dateStr} à <strong className="text-brand-dark">{timeStr}</strong></span>
                            <span className="hidden md:inline">{dateStr}<br/><span className="font-medium">{timeStr}</span></span>
                          </div>
                          <div className={`hidden md:block p-4 font-semibold ${isSent ? 'text-green-500' : isFailed ? 'text-brand-red' : 'text-amber-500'}`}>
                            {isSent ? 'Envoyé' : isFailed ? 'Échoué' : 'En Attente'}
                          </div>
                          <div className="md:p-4 text-right md:pr-4 sm:pr-8 flex justify-end mt-2 md:mt-0 pt-3 border-t border-slate-100 md:border-none">
                            <button onClick={() => handleDeleteReminder(rem)} className={`p-2 rounded-lg transition-colors shadow-sm border flex items-center justify-center ${isSent ? 'text-amber-600 border-amber-200 hover:text-white hover:bg-amber-500 bg-amber-50' : 'text-slate-500 border-slate-200 hover:text-white hover:bg-brand-red hover:border-brand-red'}`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {allReminders.length === 0 && (
                      <div className="p-10 text-center text-slate-500 font-medium italic bg-white">Aucun historique de rappel trouvé.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-3 sm:p-4 px-4 sm:px-8 flex justify-center sm:justify-between items-center shrink-0 border-t border-slate-200">
              <span className="hidden sm:inline-block px-4 py-2 border-2 border-slate-300 bg-white rounded-xl font-bold text-slate-600 text-xs sm:text-sm uppercase tracking-wider">
                Liste des Rappels
              </span>
              <button onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-8 py-3 sm:py-2.5 font-bold text-brand-dark bg-white border-b-4 border-brand-red rounded-xl hover:bg-slate-50 active:translate-y-[2px] active:border-b-2 transition-all shadow-sm">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kiosque */}
      {showKioskModal && (
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center animate-in zoom-in duration-200 relative">
            <button onClick={() => setShowKioskModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-extrabold text-brand-dark mb-2">Kiosque d'Accueil</h3>
            <p className="text-center text-slate-500 text-sm mb-6">Scannez le QR Code pour accéder au kiosque.</p>
            <div className="p-4 border-2 border-slate-100 rounded-2xl shadow-sm mb-6 bg-white">
              <QRCode value={`${window.location.origin}/kiosk-checkin/${localStorage.getItem('kioskToken')}`} size={200} fgColor="#0F172A" />
            </div>
            <a href={`/kiosk-checkin/${localStorage.getItem('kioskToken')}`} target="_blank" rel="noopener noreferrer" className="text-brand-red font-bold hover:underline">
              Ouvrir le Kiosque dans un nouvel onglet
            </a>
          </div>
        </div>
      )}

      {/* Annulation */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-[0_20px_60px_rgba(225,29,72,0.15)] w-full max-w-lg p-5 sm:p-8 animate-in zoom-in duration-200 border-2 border-rose-100 relative">
            <h3 className="text-xl sm:text-2xl font-extrabold text-brand-dark mb-2 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-brand-red animate-pulse shrink-0"></span> Annulation Requise
            </h3>
            <p className="text-slate-600 mb-6 text-sm sm:text-base">Ce rappel a <strong>déjà été envoyé</strong>. <br/>Rédigez un message d'annulation qui sera envoyé immédiatement.</p>
            <textarea
              className="w-full h-28 p-4 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red resize-none text-slate-700 text-sm"
              placeholder="Motif de l'annulation..."
              value={cancelModal.message}
              onChange={(e) => setCancelModal({ ...cancelModal, message: e.target.value })}
            ></textarea>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
              <button onClick={() => setCancelModal({ isOpen: false, targetId: null, type: '', message: '' })} disabled={isCancelling} className="px-6 py-2 border border-slate-300 rounded-full text-slate-600 font-bold hover:bg-slate-50 transition-colors">
                Retour
              </button>
              <button onClick={submitCancellation} disabled={isCancelling || cancelModal.message.trim().length < 5} className={`px-6 py-2 rounded-full font-bold text-white shadow-md ${isCancelling || cancelModal.message.trim().length < 5 ? 'bg-slate-400 cursor-not-allowed' : 'bg-brand-red hover:bg-rose-700'}`}>
                {isCancelling ? 'Annulation...' : 'Envoyer & Annuler'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RDV du jour */}
      {showDailyEventsModal && (
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200 overflow-hidden border-b-[6px] border-brand-red">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center gap-4 shrink-0">
              <h3 className="text-lg sm:text-2xl font-extrabold text-brand-dark flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-brand-red" />
                Rendez-vous du {new Date(selectedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => setShowDailyEventsModal(false)} className="bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-brand-red transition-colors p-2 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-3 min-h-0 max-h-[400px]">
              {eventsList.filter(e => {
                const eDate = new Date(e.startDateTime || e.StartDateTime);
                const sDate = new Date(selectedDate);
                return eDate.getFullYear() === sDate.getFullYear() && eDate.getMonth() === sDate.getMonth() && eDate.getDate() === sDate.getDate();
              }).map((evt, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-brand-red/50 transition-colors">
                  <div>
                    <h4 className="font-bold text-lg text-brand-dark">{evt.title || evt.Title}</h4>
                    <div className="text-slate-500 text-sm flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4" />
                      {new Date(evt.startDateTime || evt.StartDateTime).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})} - 
                      {new Date(evt.endDateTime || evt.EndDateTime).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                  <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    {evt.status || evt.Status || 'PLANNED'}
                  </div>
                </div>
              ))}
              {eventsList.filter(e => {
                const eDate = new Date(e.startDateTime || e.StartDateTime);
                const sDate = new Date(selectedDate);
                return eDate.getFullYear() === sDate.getFullYear() && eDate.getMonth() === sDate.getMonth() && eDate.getDate() === sDate.getDate();
              }).length === 0 && (
                <div className="text-center text-slate-500 py-10 font-medium italic">Aucun rendez-vous prévu pour cette date.</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;