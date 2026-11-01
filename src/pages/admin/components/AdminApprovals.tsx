import { useEffect, useState, useRef } from 'react';
import { signedReceiptUrl, receiptPath } from '../../../lib/receipts';
import { errorMessage } from '../../../lib/errors';
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
  const [receiptIsPdf, setReceiptIsPdf] = useState(false);

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
        .eq('purpose', 'renewal')
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

  const isFirstMount = useRef(true);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFirstMount.current) return;
    fetchPendingUsers(pageUsers);
  }, [pageUsers]);

  useEffect(() => {
    if (isFirstMount.current) return;
    fetchPendingPayments(pagePayments);
  }, [pagePayments]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    fetchPendingContributions(pageContributions);
  }, [pageContributions]);

  // --- ACTIONS ---
  const [processing, setProcessing] = useState(false);
  const openReceipt = async (path: string) => {
    try {
      const url = await signedReceiptUrl(path);
      setReceiptIsPdf(/\.pdf$/i.test(receiptPath(path)));
      setActiveReceiptModalUrl(url);
    }
    catch (error) { showToast(errorMessage(error), 'error'); }
  };

  const handleUpdateUserStatus = async (userId: string, newStatus: 'approved' | 'suspended') => {
    if (processing) return;
    setProcessing(true);
    try {
      await supabase.rpc('admin_set_user_status', { p_user_id: userId, p_status: newStatus }).throwOnError();
      showToast(newStatus === 'approved' ? 'Cuenta aprobada y membresía activada.' : 'Cuenta suspendida.', 'success');
      await loadAll();
    } catch (error) { showToast(errorMessage(error), 'error'); }
    finally { setProcessing(false); }
  };

  const handleReviewPayment = async (payId: string, _userId: string, newStatus: 'approved' | 'rejected') => {
    if (processing) return;
    setProcessing(true);
    try {
      await supabase.rpc('admin_review_payment', { p_payment_id: payId, p_status: newStatus }).throwOnError();
      showToast(newStatus === 'approved' ? 'Renovación aprobada.' : 'Comprobante rechazado.', 'success');
      await fetchPendingPayments(pagePayments);
    } catch (error) { showToast(errorMessage(error), 'error'); }
    finally { setProcessing(false); }
  };

  const handleReviewContribution = async (contId: string, _contUserId: string, _contTitle: string, newStatus: 'approved' | 'rejected') => {
    if (processing) return;
    setProcessing(true);
    try {
      await supabase.rpc('admin_review_contribution', { p_id: contId, p_status: newStatus }).throwOnError();
      showToast(newStatus === 'approved' ? 'Aporte aprobado.' : 'Aporte rechazado.', 'success');
      await fetchPendingContributions(pageContributions);
    } catch (error) { showToast(errorMessage(error), 'error'); }
    finally { setProcessing(false); }
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
                        onClick={() => openReceipt(user.payment_receipt_url)}
                        className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        <ImageIcon size={14} /> Ver Comprobante
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button 
                      disabled={processing} onClick={() => handleUpdateUserStatus(user.id, 'approved')}
                      className="bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-xl transition-transform hover:scale-105 shadow-sm cursor-pointer" title="Aprobar Ingreso"
                    >
                      <Check size={18} />
                    </button>
                    <button 
                      disabled={processing} onClick={() => handleUpdateUserStatus(user.id, 'suspended')}
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
                        onClick={() => openReceipt(payment.receipt_url)}
                        className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        <ImageIcon size={14} /> Ver Comprobante
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button 
                      disabled={processing} onClick={() => handleReviewPayment(payment.id, payment.user_id, 'approved')}
                      className="bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-xl shadow-sm cursor-pointer" title="Aprobar Pago"
                    >
                      <Check size={18} />
                    </button>
                    <button 
                      disabled={processing} onClick={() => handleReviewPayment(payment.id, payment.user_id, 'rejected')}
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
                    <button disabled={processing} onClick={() => handleReviewContribution(cont.id, cont.user_id, cont.title, 'approved')} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1 shadow-sm cursor-pointer">
                      <Check size={14} /> Aprobar
                    </button>
                    <button disabled={processing} onClick={() => handleReviewContribution(cont.id, cont.user_id, cont.title, 'rejected')} className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1 shadow-sm cursor-pointer">
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
              {receiptIsPdf ? <iframe title="Comprobante PDF" src={activeReceiptModalUrl} className="w-full h-[55vh]" /> : <img
                src={activeReceiptModalUrl} 
                alt="Comprobante" 
                className="max-w-full max-h-[55vh] object-contain rounded-xl"
              />}
            </div>
            <a href={activeReceiptModalUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline text-sm">Abrir comprobante en otra ventana</a>
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
