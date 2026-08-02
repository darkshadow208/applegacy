import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Search, 
  Calendar, 
  FileText, 
  Loader2, 
  AlertTriangle, 
  BellRing, 
  Send 
} from 'lucide-react';

interface AdminUsersProps {
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const ITEMS_PER_PAGE = 5;

export function AdminUsers({ showToast }: AdminUsersProps) {
  // --- STATES ---
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  // Edición de Suscripción
  const [editingSubUserId, setEditingSubUserId] = useState<string | null>(null);
  const [editingSubStartDate, setEditingSubStartDate] = useState<string>('');
  const [editingSubEndDate, setEditingSubEndDate] = useState<string>('');
  const [savingSubDates, setSavingSubDates] = useState(false);

  // Historial de Pagos
  const [expandedUserPaymentsId, setExpandedUserPaymentsId] = useState<string | null>(null);
  const [userPaymentsHistory, setUserPaymentsHistory] = useState<any[]>([]);
  const [loadingUserPayments, setLoadingUserPayments] = useState(false);

  // Notificaciones directas
  const [selectedUserForNotif, setSelectedUserForNotif] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // --- DATA FETCHING ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('users_profiles')
        .select(`*, subscriptions(*)`, { count: 'exact' })
        .neq('role', 'admin') // No listar admins aquí usualmente
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      // Pagination
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      // Calcular daysLeft
      const processedUsers = (data || []).map(u => {
        const sub = u.subscriptions && u.subscriptions.length > 0 ? u.subscriptions[0] : null;
        let daysLeft = null;
        if (sub && sub.end_date) {
          const end = new Date(sub.end_date);
          const now = new Date();
          const diffTime = end.getTime() - now.getTime();
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (daysLeft < 0) daysLeft = 0;
        }
        return {
          ...u,
          subStatus: sub ? sub.status : 'inactive',
          subStartDate: sub ? sub.start_date : null,
          subEndDate: sub ? sub.end_date : null,
          daysLeft
        };
      });

      setUsers(processedUsers);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      showToast('Error al cargar estudiantes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // --- ACTIONS ---
  const handleUpdateUserStatus = async (userId: string, newStatus: 'approved' | 'suspended') => {
    try {
      const { error } = await supabase.from('users_profiles').update({ status: newStatus }).eq('id', userId);
      if (error) throw error;
      
      if (newStatus === 'approved') {
        const startDate = new Date().toISOString();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        let subError;
        if (existingSub) {
          const { error } = await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              plan_name: 'Mensual VIP',
              start_date: startDate,
              end_date: endDate.toISOString()
            })
            .eq('id', existingSub.id);
          subError = error;
        } else {
          const { error } = await supabase
            .from('subscriptions')
            .insert({
              user_id: userId,
              status: 'active',
              plan_name: 'Mensual VIP',
              start_date: startDate,
              end_date: endDate.toISOString()
            });
          subError = error;
        }

        if (subError) throw subError;

        // Mandar notificación push al aprobar la cuenta
        await supabase.from('notifications').insert({
          user_id: userId,
          title: '🎉 ¡Cuenta Aprobada!',
          message: 'Bienvenido a Legacy Academy. Ya tienes acceso a todos los cursos VIP.',
          is_read: false
        });
      }

      showToast(`Usuario actualizado a ${newStatus}`, 'success');
      fetchUsers();
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar usuario', 'error');
    }
  };

  const handleUpdateSubscriptionDates = async (userId: string) => {
    if (!editingSubStartDate || !editingSubEndDate) {
      showToast('Por favor selecciona ambas fechas', 'error');
      return;
    }
    setSavingSubDates(true);
    try {
      const { error } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        status: new Date(editingSubEndDate) > new Date() ? 'active' : 'expired',
        start_date: new Date(editingSubStartDate).toISOString(),
        end_date: new Date(editingSubEndDate).toISOString(),
        plan_name: 'Mensual VIP'
      });
      
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: userId,
        title: '👑 Suscripción Actualizada',
        message: `El administrador ha modificado las fechas de tu membresía VIP. Tienes acceso hasta el ${new Date(editingSubEndDate).toLocaleDateString()}.`,
        is_read: false
      });

      showToast('Fechas de suscripción actualizadas', 'success');
      setEditingSubUserId(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar fechas', 'error');
    } finally {
      setSavingSubDates(false);
    }
  };

  const handleLoadUserPayments = async (userId: string) => {
    if (expandedUserPaymentsId === userId) {
      setExpandedUserPaymentsId(null);
      return;
    }
    setExpandedUserPaymentsId(userId);
    setLoadingUserPayments(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUserPaymentsHistory(data || []);
    } catch (err) {
      console.error(err);
      showToast('Error cargando historial de pagos', 'error');
    } finally {
      setLoadingUserPayments(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForNotif || !notifTitle || !notifMessage) return;
    setSendingNotif(true);
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: selectedUserForNotif,
        title: notifTitle,
        message: notifMessage,
        is_read: false
      });
      if (error) throw error;
      
      showToast('Notificación enviada con éxito', 'success');
      setNotifTitle('');
      setNotifMessage('');
      setSelectedUserForNotif('');
    } catch (err) {
      console.error(err);
      showToast('Error al enviar la notificación', 'error');
    } finally {
      setSendingNotif(false);
    }
  };

  // --- RENDER PAGINATION ---
  const renderPagination = () => {
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-1.5 mt-4">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
        >
          Anterior
        </button>
        <span className="text-[10px] font-extrabold text-gray-500 px-3 uppercase tracking-wider">
          {page} / {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
          className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
        >
          Siguiente
        </button>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
      
      {/* Listado de Estudiantes */}
      <div className="md:col-span-2 flex flex-col gap-4">
        <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Auditoría de Membresías</h3>
        
        {/* Buscador */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Buscar estudiante por nombre o email..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-3.5 bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl text-xs font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-10 bg-white/60 backdrop-blur-md rounded-3xl border border-dashed border-gray-250">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">No se encontraron estudiantes</p>
          </div>
        ) : (
          <div>
            <div className="flex flex-col gap-3">
              {users.map(student => {
                const isExpiring = student.daysLeft !== null && student.daysLeft <= 7 && student.daysLeft > 0;
                const isExpired = student.subStatus === 'expired' || (student.daysLeft !== null && student.daysLeft === 0);

                return (
                  <div key={student.id} className={`bg-white/95 rounded-3xl p-5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isExpired ? 'border-red-300' : isExpiring ? 'border-orange-300 bg-orange-50/10' : 'border-white/85'
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-gray-900">{student.full_name || 'Sin Nombre'}</h4>
                         <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                           student.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                           student.status === 'suspended' ? 'bg-red-100 text-red-700' :
                           isExpired ? 'bg-red-100 text-red-700' : 
                           isExpiring ? 'bg-orange-100 text-orange-700' : 
                           'bg-green-100 text-green-700'
                         }`}>
                           {student.status === 'pending' ? 'Pendiente' :
                            student.status === 'suspended' ? 'Suspendido' :
                            isExpired ? 'Expirado' : 
                            isExpiring ? 'Vence pronto' : 
                            'Activo'}
                         </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{student.email}</p>
                      
                      <div className="mt-2 text-[10px] text-gray-500 flex flex-col gap-0.5 bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                        <div>
                          <span className="font-extrabold text-gray-700">Inicio:</span> {student.subStartDate ? new Date(student.subStartDate).toLocaleDateString() : 'No registrado'}
                        </div>
                        <div>
                          <span className="font-extrabold text-gray-700">Vencimiento:</span> {student.subEndDate ? new Date(student.subEndDate).toLocaleDateString() : 'No registrado'}
                        </div>
                      </div>
                      
                      <p className="text-xs font-semibold text-gray-600 mt-2 flex items-center gap-1.5">
                        {isExpired ? (
                          <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={14} /> ¡Suscripción Vencida!</span>
                        ) : student.daysLeft !== null ? (
                          <span className={isExpiring ? 'text-orange-600 font-bold' : 'text-gray-500'}>
                            ⏰ Quedan {student.daysLeft} días de acceso
                          </span>
                        ) : (
                          <span className="text-gray-400">Sin fecha de expiración</span>
                        )}
                      </p>

                      {/* Edición de Fechas */}
                      {editingSubUserId === student.id ? (
                        <div className="mt-3 bg-gray-100/80 border border-gray-200 p-3 rounded-2xl flex flex-col gap-2 max-w-[280px]">
                          <h5 className="text-[9px] font-black uppercase text-indigo-700 tracking-wider">Ajustar Fechas</h5>
                          <div className="flex flex-col gap-1.5">
                            <div>
                              <label className="block text-[8px] font-extrabold uppercase text-gray-400 mb-0.5">Inicio</label>
                              <input 
                                type="date"
                                value={editingSubStartDate}
                                onChange={e => setEditingSubStartDate(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-extrabold uppercase text-gray-400 mb-0.5">Vencimiento</label>
                              <input 
                                type="date"
                                value={editingSubEndDate}
                                onChange={e => setEditingSubEndDate(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold"
                              />
                            </div>
                          </div>
                          <div className="flex gap-1.5 justify-end mt-1">
                            <button onClick={() => setEditingSubUserId(null)} className="bg-gray-200 text-gray-700 text-[9px] font-extrabold px-2.5 py-1 rounded-md cursor-pointer">Cancelar</button>
                            <button onClick={() => handleUpdateSubscriptionDates(student.id)} disabled={savingSubDates} className="bg-indigo-600 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-md flex items-center cursor-pointer">
                              {savingSubDates ? <Loader2 className="animate-spin w-2.5 h-2.5" /> : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => {
                              setEditingSubUserId(student.id);
                              setEditingSubStartDate(student.subStartDate ? student.subStartDate.split('T')[0] : '');
                              setEditingSubEndDate(student.subEndDate ? student.subEndDate.split('T')[0] : '');
                            }}
                            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[9px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <Calendar size={12} /> Cambiar Fechas
                          </button>
                          <button
                            onClick={() => handleLoadUserPayments(student.id)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[9px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileText size={12} /> Historial Pagos
                          </button>
                        </div>
                      )}

                      {/* Historial Expandible */}
                      {expandedUserPaymentsId === student.id && (
                        <div className="mt-3 bg-gray-50 border border-gray-200 p-3 rounded-2xl flex flex-col gap-2 max-w-[280px]">
                          <h5 className="text-[9px] font-black uppercase text-indigo-700 tracking-wider">Historial de Pagos</h5>
                          {loadingUserPayments ? (
                            <div className="flex justify-center py-3"><Loader2 className="animate-spin w-4 h-4 text-indigo-600" /></div>
                          ) : userPaymentsHistory.length === 0 ? (
                            <p className="text-[10px] text-gray-500 py-2">No hay pagos registrados.</p>
                          ) : (
                            <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
                              {userPaymentsHistory.map(p => (
                                <div key={p.id} className="bg-white p-2.5 rounded-xl border border-gray-150 flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-extrabold text-gray-900">
                                      {p.payment_date ? new Date(p.payment_date + 'T12:00:00').toLocaleDateString() : 'N/A'}
                                    </span>
                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full w-max ${
                                      p.status === 'approved' ? 'bg-green-50 text-green-700' : p.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                                    }`}>
                                      {p.status === 'approved' ? 'Aprobado' : p.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-gray-950">${p.amount} USD</span>
                                    {p.receipt_url && (
                                      <a 
                                        href={p.receipt_url} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="text-indigo-600 hover:text-indigo-800 p-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                        title="Ver Comprobante"
                                      >
                                        <FileText size={12} />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                       {student.status === 'pending' ? (
                         <button 
                           onClick={() => handleUpdateUserStatus(student.id, 'approved')} 
                           className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                         >
                           Aprobar Registro
                         </button>
                       ) : student.status === 'suspended' ? (
                         <button 
                           onClick={() => handleUpdateUserStatus(student.id, 'approved')} 
                           className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                         >
                           Reactivar Cuenta
                         </button>
                       ) : (
                         <button 
                           onClick={() => handleUpdateUserStatus(student.id, 'approved')} 
                           className="bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-black transition-colors cursor-pointer shadow-sm"
                         >
                           Renovar 30D
                         </button>
                       )}

                       {student.status !== 'suspended' && (
                         <button 
                           onClick={() => handleUpdateUserStatus(student.id, 'suspended')} 
                           className="bg-red-50 text-red-600 text-xs font-bold px-3 py-2.5 rounded-xl hover:bg-red-100 transition-colors cursor-pointer shadow-sm"
                         >
                           Suspender
                         </button>
                       )}
                     </div>
                  </div>
                );
              })}
            </div>
            {renderPagination()}
          </div>
        )}
      </div>

      {/* Panel Lateral: Notificaciones y más */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-3 h-max sticky top-24">
        <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
          <BellRing className="text-indigo-600" size={18} />
          <span>Enviar Notificación Directa</span>
        </h3>

        <form onSubmit={handleSendNotification} className="flex flex-col gap-3">
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Seleccionar Alumno</label>
            <select
              required
              value={selectedUserForNotif}
              onChange={e => setSelectedUserForNotif(e.target.value)}
              className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700"
            >
              <option value="">-- Seleccionar --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Asunto / Título</label>
            <input 
              type="text" required
              value={notifTitle} onChange={e => setNotifTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Mensaje</label>
            <textarea 
              required rows={2}
              value={notifMessage} onChange={e => setNotifMessage(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={sendingNotif}
            className="w-full py-3 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50 mt-1 cursor-pointer"
            style={{ backgroundColor: '#4f46e5' }}
          >
            {sendingNotif ? <Loader2 className="animate-spin" size={14} /> : <><Send size={12} /> Enviar Mensaje</>}
          </button>
        </form>
      </div>

    </div>
  );
}
