import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Calendar, Upload, CheckCircle, Clock, XCircle, FileText, Loader2 } from 'lucide-react';

export function Subscription() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'status' | 'payments'>('status');
  
  // Datos
  const [subscription, setSubscription] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario pago
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        // Fetch subscription
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (subData) setSubscription(subData);

        // Fetch payments
        const { data: payData } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (payData) setPayments(payData);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file || !amount || !paymentDate) return;
    
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Date.now()}.${fileExt}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('payment_receipts')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('payment_receipts').getPublicUrl(filePath);

      // Save to database
      const { data: newPayment, error: dbError } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          amount: parseFloat(amount),
          payment_date: paymentDate,
          receipt_url: publicUrl,
          notes,
          status: 'pending'
        })
        .select()
        .single();
      
      if (dbError) throw dbError;

      // Guardar también el comprobante en la suscripción y cambiar estado a pending_renewal si estaba expirada
      await supabase
        .from('subscriptions')
        .update({ 
          status: 'pending_renewal', 
          payment_receipt_url: publicUrl 
        })
        .eq('user_id', user.id);

      // Update UI
      setSubscription({ ...subscription, status: 'pending_renewal', payment_receipt_url: publicUrl });
      setPayments([newPayment, ...payments]);
      setShowForm(false);
      setSuccessMsg('Comprobante enviado con éxito. Un administrador lo revisará pronto.');
      setTimeout(() => setSuccessMsg(''), 5000);
      
      // Reset form
      setAmount(''); setPaymentDate(''); setNotes(''); setFile(null);
    } catch (err: any) {
      alert('Error al subir comprobante. ¿Ejecutaste el script SQL de buckets? Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'approved':
        return <span className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"><CheckCircle size={12}/> {status === 'active' ? 'Activa' : 'Aprobado'}</span>;
      case 'pending':
        return <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"><Clock size={12}/> Pendiente</span>;
      case 'rejected':
      case 'expired':
      case 'suspended':
        return <span className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"><XCircle size={12}/> {status === 'rejected' ? 'Rechazado' : 'Inactiva'}</span>;
      case 'pending_renewal':
        return <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"><Clock size={12}/> Renovación Pendiente</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20">
      
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Mi Membresía</h2>
        <p className="text-gray-500 text-sm">Gestiona tu suscripción y pagos.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-200/50 p-1 rounded-2xl w-max shadow-inner">
        <button 
          onClick={() => setActiveTab('status')}
          className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'status' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Estado
        </button>
        <button 
          onClick={() => setActiveTab('payments')}
          className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'payments' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Pagos
        </button>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-2xl text-sm">
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
      ) : activeTab === 'status' ? (
        /* ESTADO TAB */
        <div className="flex flex-col gap-4">
          <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-white/80 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="relative z-10">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Estado actual</p>
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-bold text-gray-900 capitalize">
                  {subscription?.status === 'active' ? 'Plan Premium' : subscription?.status === 'pending_renewal' ? 'Renovación en Proceso' : 'Plan Básico'}
                </h3>
                {getStatusBadge(subscription?.status || 'pending')}
              </div>
              
              <div className="mt-6 flex flex-col gap-3">
                <div className="flex items-center gap-3 text-gray-600 bg-white/50 p-3 rounded-2xl">
                  <Calendar size={18} className="text-blue-500" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Fecha de Inicio</p>
                    <p className="font-semibold text-gray-900">{subscription?.start_date ? new Date(subscription.start_date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-600 bg-white/50 p-3 rounded-2xl">
                  <Clock size={18} className="text-orange-500" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Próximo vencimiento</p>
                    <p className="font-semibold text-gray-900">{subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* PAGOS TAB */
        <div className="flex flex-col gap-6">
          
          <button 
            onClick={() => setShowForm(!showForm)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform"
          >
            <Upload size={20} />
            {showForm ? 'Cancelar Subida' : 'Subir nuevo comprobante'}
          </button>

          {showForm && (
            <form onSubmit={handlePaymentSubmit} className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-blue-100 shadow-sm flex flex-col gap-4 animate-fade-in">
              <h3 className="font-bold text-gray-900">Detalles del pago</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Monto (USD)</label>
                  <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fecha</label>
                  <input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Comprobante (Imagen/PDF)</label>
                <input type="file" required accept="image/*,.pdf" ref={fileInputRef} onChange={e => setFile(e.target.files ? e.target.files[0] : null)} className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nota adicional (Opcional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Referencia de transferencia..."></textarea>
              </div>

              <button type="submit" disabled={uploading} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold flex justify-center items-center gap-2">
                {uploading ? <Loader2 className="animate-spin" size={18} /> : 'Enviar para revisión'}
              </button>
            </form>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-gray-900 mt-2">Historial</h3>
            {payments.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center bg-white/40 rounded-2xl border border-white">No hay pagos registrados.</p>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-sm flex items-center justify-between gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-gray-900">${p.amount}</p>
                      {getStatusBadge(p.status)}
                    </div>
                    <p className="text-xs text-gray-500">{new Date(p.payment_date).toLocaleDateString()}</p>
                    {p.notes && <p className="text-xs text-gray-400 mt-1 truncate max-w-[200px]">{p.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
