import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Check, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface AdminApprovalsProps {
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const ITEMS_PER_PAGE = 5;

export function AdminApprovals({ showToast }: AdminApprovalsProps) {
  // --- STATES ---
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [pageUsers, setPageUsers] = useState(1);

  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [pagePayments, setPagePayments] = useState(1);

  const [pendingContributions, setPendingContributions] = useState<any[]>([]);
  const [pendingContributionsCount, setPendingContributionsCount] = useState(0);
  const [pageContributions, setPageContributions] = useState(1);

  const [loading, setLoading] = useState(true);
  const [activeReceiptModalUrl, setActiveReceiptModalUrl] = useState<string | null>(null);

  // --- FETCHERS ---
  const fetchPendingUsers = async (page: number) => {
    try {
      const { data, count, error } = await supabase
        .from('users_profiles')
        .select('*', { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      setPendingUsers(data || []);
      setPendingUsersCount(count || 0);
    } catch (err) {
      console.error('Error fetching pending users:', err);
    }
  };

  const fetchPendingPayments = async (page: number) => {
    try {
      const { data, count, error } = await supabase
        .from('payments')
        .select(`*, users_profiles(email, full_name)`, { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      setPendingPayments(data || []);
      setPendingPaymentsCount(count || 0);
    } catch (err) {
      console.error('Error fetching pending payments:', err);
    }
  };

  const fetchPendingContributions = async (page: number) => {
    try {
      const { data, count, error } = await supabase
        .from('user_contributions')
        .select(`*, users_profiles(email, full_name)`, { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (error) throw error;
      setPendingContributions(data || []);
      setPendingContributionsCount(count || 0);
    } catch (err) {
      console.error('Error fetching pending contributions:', err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchPendingUsers(pageUsers),
      fetchPendingPayments(pagePayments),
      fetchPendingContributions(pageContributions)
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPendingUsers(pageUsers);
  }, [pageUsers]);

  useEffect(() => {
    fetchPendingPayments(pagePayments);
  }, [pagePayments]);

  useEffect(() => {
    fetchPendingContributions(pageContributions);
  }, [pageContributions]);

  // --- ACTIONS ---
  const handleUpdateUserStatus = async (userId: string, newStatus: 'approved' | 'suspended') => {
    try {
      const { error } = await supabase.from('users_profiles').update({ status: newStatus }).eq('id', userId);
      if (error) throw error;

      if (newStatus === 'approved') {
        const startDate = new Date().toISOString();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

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
        
        await supabase.from('notifications').insert({
          user_id: userId,
          title: '🎉 ¡Cuenta Aprobada!',
          message: 'Bienvenido a Legacy Academy. Ya tienes acceso a todos los cursos VIP.',
          is_read: false
        });
      }

      showToast(`Usuario ${newStatus === 'approved' ? 'Aprobado' : 'Rechazado'} exitosamente.`, 'success');
      fetchPendingUsers(pageUsers);
    } catch (err: any) {
      console.error(err);
      showToast('Error al actualizar usuario.', 'error');
    }
  };

  const handleReviewPayment = async (payId: string, userId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.from('payments').update({ status: newStatus }).eq('id', payId);
      if (error) throw error;

      if (newStatus === 'approved') {
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        await supabase.from('subscriptions').update({
          status: 'active',
          end_date: endDate.toISOString()
        }).eq('user_id', userId);

        await supabase.from('notifications').insert({
          user_id: userId,
          title: '✅ Pago Aprobado',
          message: 'Tu renovación ha sido aprobada. ¡Sigues siendo VIP!',
          is_read: false
        });
      } else if (newStatus === 'rejected') {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: '❌ Pago Rechazado',
          message: 'Tu comprobante de pago ha sido rechazado. Por favor, verifica la imagen y vuelve a enviarla.',
          is_read: false
        });
      }

      showToast(`Pago ${newStatus === 'approved' ? 'aprobado' : 'rechazado'}.`, 'success');
      fetchPendingPayments(pagePayments);
    } catch (err) {
      console.error(err);
      showToast('Error al procesar el pago.', 'error');
    }
  };

  const handleReviewContribution = async (contId: string, contUserId: string, contTitle: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.from('user_contributions').update({ status: newStatus }).eq('id', contId);
      if (error) throw error;

      if (newStatus === 'approved') {
        await supabase.from('notifications').insert({
          user_id: null,
          title: '🌟 Nuevo Aporte en la Comunidad',
          message: `Se ha publicado un nuevo aporte: "${contTitle}". ¡Ve a revisarlo!`,
          is_read: false
        });
        
        await supabase.from('notifications').insert({
          user_id: contUserId,
          title: '✅ Aporte Aprobado',
          message: `Tu aporte "${contTitle}" ha sido aprobado y ya es público para toda la comunidad. ¡Gracias!`,
          is_read: false
        });
      } else if (newStatus === 'rejected') {
        await supabase.from('notifications').insert({
          user_id: contUserId,
          title: '❌ Aporte Rechazado',
          message: `Lo sentimos, tu aporte "${contTitle}" no cumple con los lineamientos y ha sido rechazado.`,
          is_read: false
        });
      }

      showToast(`Aporte ${newStatus === 'approved' ? 'aprobado' : 'rechazado'}.`, 'success');
      fetchPendingContributions(pageContributions);
    } catch (err: any) {
      console.error(err);
      showToast('Error al revisar el aporte.', 'error');
    }
  };

  // --- PAGINATION COMPONENT ---
  const renderPagination = (currentPage: number, totalItems: number, setPage: (p: number) => void) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-1.5 mt-4">
        <button
          disabled={currentPage === 1}
          onClick={() => setPage(currentPage - 1)}
          className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
        >
          Anterior
        </button>
        <span className="text-[10px] font-extrabold text-gray-500 px-3 uppercase tracking-wider">
          {currentPage} / {totalPages}
        </span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setPage(currentPage + 1)}
          className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
        >
          Siguiente
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* CUENTAS PENDIENTES */}
      <div className="flex flex-col gap-3">
        <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Validación de Nuevos Alumnos</h3>
        {pendingUsers.length > 0 ? (
          <div>
            <div className="flex flex-col gap-3">
              {pendingUsers.map(user => (
                <div key={user.id} className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-yellow-250 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-gray-900">{user.full_name || 'Nuevo Estudiante'}</h4>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 uppercase tracking-wider">Pendiente</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                    {user.phone && <div className="text-xs text-gray-400 mt-1">📱 {user.phone}</div>}
                    {user.telegram && <div className="text-xs text-gray-400">✈️ {user.telegram}</div>}
                  </div>
                  
                  {user.payment_receipt_url && (
                    <div className="flex-shrink-0">
                      <button 
                        onClick={() => setActiveReceiptModalUrl(user.payment_receipt_url)}
                        className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        <ImageIcon size={14} /> Ver Comprobante
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleUpdateUserStatus(user.id, 'approved')}
                      className="bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-xl transition-transform hover:scale-105 shadow-sm cursor-pointer" title="Aprobar Ingreso"
                    >
                      <Check size={18} />
                    </button>
                    <button 
                      onClick={() => handleUpdateUserStatus(user.id, 'suspended')}
                      className="bg-red-50 hover:bg-red-100 text-red-600 p-2.5 rounded-xl transition-transform hover:scale-105 shadow-sm cursor-pointer" title="Rechazar y Suspender"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {renderPagination(pageUsers, pendingUsersCount, setPageUsers)}
          </div>
        ) : (
          <div className="text-center py-10 bg-white/60 backdrop-blur-md rounded-3xl border border-dashed border-gray-250">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">No hay cuentas pendientes</p>
          </div>
        )}
      </div>

      {/* PAGOS DE RENOVACIÓN */}
      <div className="flex flex-col gap-3 mt-6">
        <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Pagos de Renovación Pendientes</h3>
        {pendingPayments.length > 0 ? (
          <div>
            <div className="flex flex-col gap-3">
              {pendingPayments.map(payment => (
                <div key={payment.id} className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-indigo-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-sm text-gray-900">{payment.users_profiles?.full_name || payment.users_profiles?.email}</h4>
                    <p className="text-xs text-gray-500 mt-1">Monto: <span className="font-bold text-green-600">${payment.amount}</span></p>
                    <p className="text-[10px] text-gray-400 uppercase mt-0.5">Ref: {payment.reference_number || 'N/A'}</p>
                  </div>
                  
                  {payment.receipt_url && (
                    <div className="flex-shrink-0">
                      <button 
                        onClick={() => setActiveReceiptModalUrl(payment.receipt_url)}
                        className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        <ImageIcon size={14} /> Ver Comprobante
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleReviewPayment(payment.id, payment.user_id, 'approved')}
                      className="bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-xl shadow-sm cursor-pointer" title="Aprobar Pago"
                    >
                      <Check size={18} />
                    </button>
                    <button 
                      onClick={() => handleReviewPayment(payment.id, payment.user_id, 'rejected')}
                      className="bg-red-50 hover:bg-red-100 text-red-600 p-2.5 rounded-xl shadow-sm cursor-pointer" title="Rechazar Pago"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {renderPagination(pagePayments, pendingPaymentsCount, setPagePayments)}
          </div>
        ) : (
          <div className="text-center py-10 bg-white/60 backdrop-blur-md rounded-3xl border border-dashed border-gray-250">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">No hay pagos de renovación pendientes</p>
          </div>
        )}
      </div>

      {/* APORTES COMUNIDAD PENDIENTES */}
      <div className="flex flex-col gap-3 mt-6">
        <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Moderación de Comunidad</h3>
        {pendingContributions.length > 0 ? (
          <div>
            <div className="flex flex-col gap-3">
              {pendingContributions.map(cont => (
                <div key={cont.id} className="bg-white/85 backdrop-blur-md rounded-3xl p-5 border border-purple-200 shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[9px] font-extrabold uppercase text-purple-600 tracking-wider bg-purple-50 px-2 py-0.5 rounded">
                        {cont.contribution_type === 'tip' ? '💡 Tip' : cont.contribution_type === 'book' ? '📘 Libro' : '🔗 Enlace'}
                      </span>
                      <h4 className="font-extrabold text-sm text-gray-900 mt-2">{cont.title}</h4>
                      <p className="text-[10px] text-gray-400 mt-1">Por: {cont.users_profiles?.full_name || cont.users_profiles?.email}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-150 text-xs text-gray-600">
                    {cont.description}
                    {cont.link_url && (
                      <a href={cont.link_url} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline block mt-2">🔗 Ver Link</a>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => handleReviewContribution(cont.id, cont.user_id, cont.title, 'approved')} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1 shadow-sm cursor-pointer">
                      <Check size={14} /> Aprobar
                    </button>
                    <button onClick={() => handleReviewContribution(cont.id, cont.user_id, cont.title, 'rejected')} className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1 shadow-sm cursor-pointer">
                      <X size={14} /> Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {renderPagination(pageContributions, pendingContributionsCount, setPageContributions)}
          </div>
        ) : (
          <div className="text-center py-10 bg-white/60 backdrop-blur-md rounded-3xl border border-dashed border-gray-250">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">La comunidad está limpia</p>
          </div>
        )}
      </div>

      {/* Modal para Recibos */}
      {activeReceiptModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-2xl max-w-lg w-full flex flex-col gap-4 relative">
            <button 
              onClick={() => setActiveReceiptModalUrl(null)}
              className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
            <h4 className="font-extrabold text-sm text-gray-900 pr-8">Comprobante de Pago</h4>
            <div className="bg-gray-55 rounded-2xl border border-gray-150 p-2 overflow-hidden flex items-center justify-center max-h-[60vh]">
              <img 
                src={activeReceiptModalUrl} 
                alt="Comprobante" 
                className="max-w-full max-h-[55vh] object-contain rounded-xl"
              />
            </div>
            <div className="flex justify-end mt-1">
              <button 
                onClick={() => setActiveReceiptModalUrl(null)}
                className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
