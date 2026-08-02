import React, { useState, useEffect, useRef } from 'react';
import { CalendarDays, MessageSquare, TrendingUp, Clock, User as UserIcon, Calendar as CalendarIcon, Mail } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchWithAuth } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react'; // Ajoute Trash2


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
  const [weekDates, setWeekDates] = useState(getWeekDates(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const dateInputRef = useRef(null);
  // Gestion de la modale Historique des Rappels
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allReminders, setAllReminders] = useState([]);
  const navigate = useNavigate();

  const handleDeleteReminder = async (idReminder) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce rappel ?")) return;
    try {
      const res = await fetchWithAuth(`/api/Reminders/${idReminder}`, { method: 'DELETE' });
      if (res.ok) {
        setAllReminders(prev => prev.filter(r => r.idReminder !== idReminder));
        // Rafraîchir les stats du dashboard
        fetchDashboardInfo();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const date = new Date(selectedDate);
    const dates = getWeekDates(date);
    setWeekDates(dates);
    setSelectedDayIndex(date.getDay() === 0 ? 6 : date.getDay() - 1);
  }, [selectedDate]);

  const selectedDateLabel = weekDates[selectedDayIndex] ? `${weekDates[selectedDayIndex].getDate()} ${weekDates[selectedDayIndex].toLocaleString('fr-FR', { month: 'long' })}` : '';

  // État pour stocker les vraies données du backend
const [summaryData, setSummaryData] = useState({
    rdvDuJour: 0,
    smsEnvoyes: 0,
    tauxDelivrabilite: 0,
    prochainsSms: []
});
const [chartData, setChartData] = useState([]);

// Lancement de la requête au chargement de la page
useEffect(() => {
  const fetchDashboardInfo = async () => {
    try {
      // 1. Résumé (RDV du jour, SMS envoyés...)
      const summaryRes = await fetchWithAuth('/api/Dashboard');
      if (summaryRes.ok) {
        setSummaryData(await summaryRes.json());
      }

      // 2. Récupération des rappels pour construire le graphique
      const remindersRes = await fetchWithAuth('/api/Reminders'); 

      if (remindersRes.ok) {
        const fetchedReminders = await remindersRes.json();
        const today = new Date(); 
        
        // On calcule le nombre de SMS envoyés pour chaque jour de la semaine sélectionnée
        const newChartData = weekDates.map((d, idx) => {
        
        // ⚠️ On utilise fetchedReminders ici, pas allReminders !
        const count = fetchedReminders.filter(r => {
          const rDate = new Date(r.scheduledTime || r.ScheduledTime);
              const isSameDay = rDate.getFullYear() === d.getFullYear() &&
                                rDate.getMonth() === d.getMonth() &&
                                rDate.getDate() === d.getDate();
              
              // On vérifie le statut (tolérance majuscules/minuscules)
              const status = (r.status || r.Status || '').toUpperCase();
              return isSameDay && status === 'SENT';
        }).length;

        return {
          day: rangeLabels[idx],
          sms: count,
          isToday: d.getDate() === today.getDate() &&
                  d.getMonth() === today.getMonth() &&
                  d.getFullYear() === today.getFullYear()
        };
      });
        
        setChartData(newChartData);
      }
    } catch (error) {
      console.error("Erreur Dashboard :", error);
    }
  };
  fetchDashboardInfo();
  }, [weekDates]); // 👈 Recharge le graphique si on change de semaine // S'exécute une seule fois au chargement

  const handleOpenModal = async () => {
    setIsModalOpen(true);
    try {
      const res = await fetchWithAuth('/api/Reminders');
      if (res.ok) {
        const data = await res.json();
        setAllReminders(data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique :", error);
    }
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-10 bg-brand-bg">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 flex flex-col justify-between h-36 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(15,23,42,0.1)] cursor-pointer">
          <div className="flex justify-between items-start">
            <p className="text-slate-600 font-medium">Rendez-vous du jour</p>
            <button type="button" onClick={() => dateInputRef.current && dateInputRef.current.click()} className="text-slate-400 w-5 h-5 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </button>
          </div>
          <h3 className="text-7xl font-semibold text-brand-dark tracking-tight">{summaryData.rdvDuJour}</h3>

        </div>

        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 flex flex-col justify-between h-36 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(15,23,42,0.1)] cursor-pointer">
          <div className="flex justify-between items-start">
            <p className="text-slate-600 font-medium">Rappels SMS envoyés</p>
            <MessageSquare className="text-slate-400 w-5 h-5" />
          </div>
          <h3 className="text-7xl font-semibold text-brand-dark tracking-tight">{summaryData.smsEnvoyes}</h3>

        </div>

        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 flex flex-col justify-between h-36 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(15,23,42,0.1)] cursor-pointer">
          <div className="flex justify-between items-start">
            <p className="text-slate-600 font-medium">Taux de délivrabilité API</p>
            <TrendingUp className="text-green-500 w-5 h-5" />
          </div>
          <h3 className="text-7xl font-semibold text-brand-dark tracking-tight">{summaryData.tauxDelivrabilite}%</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[400px]">
         <div className="md:col-span-2 bg-white rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 ">
                
                <button
                    type="button"
                    onClick={() => dateInputRef.current?.showPicker()}
                    className="bg-brand-red text-white p-2 rounded-lg hover:bg-rose-700 transition-colors flex items-center justify-center"
                >
                    <CalendarIcon className="w-5 h-5" />
                </button>

                <h4 className="text-2xl font-extrabold" style={{ color: INK }}>
                    {weekDates[0] ? `Semaine du ${weekDates[0].getDate()} ${MOIS_FR[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}` : 'Semaine'}
                </h4>

                {/* <button
                    type="button"
                    onClick={() => dateInputRef.current?.showPicker()}
                    className="bg-brand-red text-white p-2 rounded-lg hover:bg-rose-700 transition-colors flex items-center justify-center"
                >
                    <CalendarIcon className="w-5 h-5" />
                </button> */}

                <input
                    ref={dateInputRef}
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="sr-only"
                />
            </div>

            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={(props) => {
                      const { x, y, payload } = props;
                      // On récupère l'info "isToday" depuis nos données
                      const isToday = chartData[payload.index]?.isToday;
                      
                      return (
                        <g transform={`translate(${x},${y})`}>
                          {/* La lettre du jour (L, M, M...) */}
                          <text x={0} y={0} dy={16} textAnchor="middle" fill={isToday ? '#E11D48' : '#0F172A'} fontSize={20} fontWeight="900">
                            {payload.value}
                          </text>
                          
                          {/* Le texte (aujourd'hui) affiché uniquement si c'est le bon jour */}
                          {isToday && (
                            <text x={0} y={0} dy={34} textAnchor="middle" fill="#E11D48" fontSize={12} fontWeight="bold">
                              (aujourd'hui)
                            </text>
                          )}
                        </g>
                      );
                    }} 
                  />
                  <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                  <Bar dataKey="sms" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === selectedDayIndex ? '#E11D48' : '#0F172A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(15,23,42,0.05)] border border-slate-100 p-6 flex flex-col min-h-0">
            <h4 className="font-bold text-brand-dark text-lg text-center border-b border-slate-100 pb-4 mb-4">Prochains SMS Programmés<br/><span className="text-sm font-normal text-slate-500">(cette Semaine)</span></h4>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {(!summaryData?.prochainsSms || summaryData.prochainsSms.length === 0) ? (<p className="text-center text-slate-500 mt-10">Aucun SMS programmé.</p>) : 
                (
                  summaryData.prochainsSms.map((sms, index) => {
                      // 🔍 Affiche la structure exacte du SMS dans la console F12
                      console.log("SMS item:", sms);

                      // Récupération de la date (s'adapte à tous les noms de clés possibles)
                      const rawDate = sms.scheduledTime || sms.scheduled_time || sms.date;
                      const dateObj = rawDate ? new Date(rawDate) : null;
                      
                      // Vérifie si la date est valide
                      const isValidDate = dateObj && !isNaN(dateObj.getTime());

                      const formattedTime = isValidDate 
                          ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) 
                          : (sms.time || '--:--');

                      const formattedDate = isValidDate 
                          ? dateObj.toLocaleDateString('fr-FR') 
                          : (sms.date || 'Date inconnue');

                      return (
                          <div key={sms.idReminder || sms.id || index} className="border-b border-slate-100 pb-4 last:border-0">
                              <div className="flex justify-between items-center mb-1">
                                  <div className="flex items-center text-brand-dark font-semibold">
                                      <div className="bg-slate-100 p-1.5 rounded-full mr-3">
                                          <UserIcon className="w-4 h-4 text-slate-600" />
                                      </div>
                                      {sms.clientName || "Client"}
                                  </div>
                                  <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                                      {sms.status || "PENDING"}
                                  </span>
                              </div>
                              <div className="flex items-center text-slate-500 text-sm ml-10">
                                  <Clock className="w-3.5 h-3.5 mr-1" />
                                  <span>{formattedTime} <span className="text-slate-400 mx-1">•</span> {formattedDate}</span>
                              </div>
                          </div>
                      );
                  })
              )}
            </div>

            <div className="mt-4 pt-4 flex justify-center">
              <button onClick={handleOpenModal} className="px-10 py-2 font-bold text-brand-dark text-lg border-b-4 border-brand-red rounded-xl hover:bg-slate-50 transition-colors">
                Voir Liste
              </button>
            </div>

         </div>
        
        {/* ================= MODALE : HISTORIQUE DES RAPPELS ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in zoom-in duration-200 overflow-hidden">
            
            {/* En-tête / Tableau */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 font-bold text-brand-dark rounded-tl-3xl">N°</th>
                    <th className="p-4 font-bold text-brand-dark">Événement</th>
                    <th className="p-4 font-bold text-brand-dark">Destinataire</th>
                    <th className="p-4 font-bold text-brand-dark">Message</th>
                    <th className="p-4 font-bold text-brand-dark">Date d'envoi</th>
                    <th className="p-4 font-bold text-brand-dark rounded-tr-3xl">Statut</th>
                    <th className="p-4 font-bold text-brand-dark rounded-tr-3xl text-right">Actions</th> 
                  </tr>
                </thead>
                <tbody>
                  {allReminders.map((rem, idx) => {
                    const dateObj = new Date(rem.scheduledTime);
                    const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'H');
                    
                    // On vérifie le statut pour la couleur (en s'assurant qu'on ne crashe pas si c'est null)
                    const statusText = (rem.status || '').toUpperCase();
                    const isSent = statusText === 'SENT';

                    return (
                      <tr key={rem.idReminder || idx} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-slate-800 font-medium">{idx + 1}</td>
                        <td className="p-4 text-brand-dark font-bold">
                          {/* 👈 LE LIEN POUR ÉDITER L'ÉVÉNEMENT */}
                          <span 
                            onClick={() => {
                                setIsModalOpen(false);
                                navigate('/nouveau-rdv', { state: { editEventId: rem.idEvent } });
                            }} 
                            className="cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                          >
                            {rem.eventTitle || 'Consultation'}
                          </span>
                        </td>
                        <td className="p-4 text-brand-dark font-bold">
                          <div className="flex items-center gap-2">
                            {/* 🧠 Affichage intelligent : Icône SMS (verte) ou Email (bleue) */}
                            {(rem.channel || rem.Channel || 'SMS').toUpperCase() === 'EMAIL' 
                              ? <Mail className="w-4 h-4 text-blue-500" title="Email" /> 
                              : <MessageSquare className="w-4 h-4 text-emerald-500" title="SMS" />}
                            {rem.clientName}
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 text-sm max-w-[200px] truncate" title={rem.messageText}>
                          {rem.messageText}
                        </td>
                        <td className="p-4 text-slate-600 leading-tight">
                          {dateStr}<br/>{timeStr}
                        </td>
                        <td className={`p-4 font-semibold ${isSent ? 'text-green-500' : 'text-slate-500'}`}>
                          {isSent ? 'Envoyer' : 'En Attente'}
                        </td>
                        <td className="p-4 text-right">
                          {/* 👈 LE BOUTON POUBELLE ! */}
                          <button 
                            onClick={() => handleDeleteReminder(rem.idReminder)}
                            className="p-2 text-slate-400 hover:text-brand-red hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer ce rappel"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {allReminders.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">
                        Aucun historique de rappel trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Footer de la modale */}
            <div className="bg-slate-50 p-4 px-8 flex justify-between items-center shrink-0">
              <span className="px-5 py-2 border border-slate-400 bg-transparent rounded-xl font-bold text-brand-dark">
                Liste des Rappels
              </span>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-8 py-2 font-bold text-brand-dark border-b-4 border-brand-red rounded-xl hover:bg-gray-300 transition-colors"
              >
                Quitter
              </button>
            </div>

          </div>
        </div>
      )}
      {/* ================= FIN MODALE ================= */}

      </div>
    </div>
  );
};

export default Dashboard;