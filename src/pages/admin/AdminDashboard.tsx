import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, 
  Check, 
  X, 
  ShieldAlert, 
  PlusCircle, 
  Search, 
  Loader2,
  Sparkles,
  Inbox,
  BellRing,
  BookOpen,
  FileText,
  AlertTriangle,
  FileEdit,
  Send, 
  AlertCircle, 
  Calendar, 
  LineChart as ChartIcon 
} from 'lucide-react';
import { AdminAnalytics } from './AdminAnalytics';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'approvals' | 'students' | 'content' | 'comms' | 'analytics'>('approvals');
  const [loading, setLoading] = useState(false);

  // --- CUSTOM PREMIUM TOAST NOTIFICATION SYSTEM ---
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  // --- MODELOS DE DATOS GENERALES ---
  const [usersList, setUsersList] = useState<any[]>([]);
  const [subscriptionsList, setSubscriptionsList] = useState<any[]>([]);
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [bonusesList, setBonusesList] = useState<any[]>([]);
  const [contributionsList, setContributionsList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);

  // --- FILTROS & BUSQUEDA ---
  const [searchQuery, setSearchQuery] = useState('');

  // --- CONSTANTE DE PAGINACIÓN ---
  const ITEMS_PER_PAGE = 5;

  // --- ESTADOS DE PAGINACIÓN ---
  const [pagePendingUsers, setPagePendingUsers] = useState(1);
  const [pageContributions, setPageContributions] = useState(1);
  const [pageStudents, setPageStudents] = useState(1);
  const [pageCourses, setPageCourses] = useState(1);
  const [pageBonuses, setPageBonuses] = useState(1);

  useEffect(() => {
    setPageStudents(1);
  }, [searchQuery]);

  // --- ESTADOS: GESTIÓN DE CURSOS ---
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseDriveUrl, setCourseDriveUrl] = useState('');
  const [courseImageUrl, setCourseImageUrl] = useState('');
  const [courseCategory, setCourseCategory] = useState('');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseDesc, setEditingCourseDesc] = useState('');
  const [editingCourseTitle, setEditingCourseTitle] = useState('');

  // --- ESTADOS: GESTIÓN DE BONOS ---
  const [bonusTitle, setBonusTitle] = useState('');
  const [bonusDesc, setBonusDesc] = useState('');
  const [bonusDriveUrl, setBonusDriveUrl] = useState('');
  const [bonusImageUrl, setBonusImageUrl] = useState('');
  const [bonusIsGlobal, setBonusIsGlobal] = useState(true);
  const [editingBonusId, setEditingBonusId] = useState<string | null>(null);
  const [editingBonusDesc, setEditingBonusDesc] = useState('');
  const [editingBonusTitle, setEditingBonusTitle] = useState('');

  // --- ESTADOS: NOTIFICACIONES DIRECTAS ---
  const [selectedUserForNotif, setSelectedUserForNotif] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // --- ESTADOS: BLOG Y COMUNICADOS ---
  const [blogTitle, setBlogTitle] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogImageUrl, setBlogImageUrl] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [savingBlog, setSavingBlog] = useState(false);

  // --- ESTADOS: EDICIÓN DE FECHAS DE SUSCRIPCIÓN ---
  const [editingSubUserId, setEditingSubUserId] = useState<string | null>(null);
  const [editingSubStartDate, setEditingSubStartDate] = useState<string>('');
  const [editingSubEndDate, setEditingSubEndDate] = useState<string>('');
  const [savingSubDates, setSavingSubDates] = useState<boolean>(false);

  // --- ESTADOS: GESTIÓN DE COMPROBANTES DE PAGO ---
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [pagePayments, setPagePayments] = useState(1);
  const [expandedUserPaymentsId, setExpandedUserPaymentsId] = useState<string | null>(null);
  const [userPaymentsHistory, setUserPaymentsHistory] = useState<any[]>([]);
  const [loadingUserPayments, setLoadingUserPayments] = useState(false);

  // --- ESTADOS: CATEGORÍAS ---
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // --- ESTADOS: VISUALIZADOR DE COMPROBANTES (MODAL) ---
  const [activeReceiptModalUrl, setActiveReceiptModalUrl] = useState<string | null>(null);

  // CARGAR DATOS GENERALES DESDE LA BASE DE DATOS (Optimizado en Paralelo)
  const loadAdminData = async () => {
    setLoading(true);

    try {
      const results = await Promise.allSettled([
        // 0: Perfiles de usuarios
        supabase.from('users_profiles').select('*').order('created_at', { ascending: false }).limit(1000),
        // 1: Suscripciones
        supabase.from('subscriptions').select('*').limit(1000),
        // 2: Cursos
        supabase.from('courses').select('*').order('created_at', { ascending: false }).limit(1000),
        // 3: Categorías
        supabase.from('course_categories').select('*'),
        // 4: Bonos
        supabase.from('bonuses').select('*').order('created_at', { ascending: false }).limit(1000),
        // 5: Aportes pendientes
        supabase.from('user_contributions').select(`*, users_profiles (email, full_name)`).eq('status', 'pending').order('created_at', { ascending: false }).limit(1000),
        // 6: Anuncios de Inicio (Múltiples)
        supabase.from('news_posts').select('*').eq('type', 'announcement').eq('is_active', true).order('created_at', { ascending: false }).limit(100),
        // 7: Pagos pendientes
        supabase.from('payments').select(`*, users_profiles (email, full_name)`).eq('status', 'pending').order('created_at', { ascending: false }).limit(1000)
      ]);

      // Procesar resultados de forma segura e independiente
      if (results[0].status === 'fulfilled') {
        const res = results[0].value;
        if (res.error) console.error('Error cargando usuarios:', res.error);
        else if (res.data) setUsersList(res.data);
      }

      if (results[1].status === 'fulfilled') {
        const res = results[1].value;
        if (res.error) console.error('Error cargando suscripciones:', res.error);
        else if (res.data) setSubscriptionsList(res.data);
      }

      if (results[2].status === 'fulfilled') {
        const res = results[2].value;
        if (res.error) console.error('Error cargando cursos:', res.error);
        else if (res.data) setCoursesList(res.data);
      }

      if (results[3].status === 'fulfilled') {
        const res = results[3].value;
        if (res.error) console.error('Error cargando categorías:', res.error);
        else if (res.data) setCategoriesList(res.data);
      }

      if (results[4].status === 'fulfilled') {
        const res = results[4].value;
        if (res.error) console.error('Error cargando bonos:', res.error);
        else if (res.data) setBonusesList(res.data);
      }

      if (results[5].status === 'fulfilled') {
        const res = results[5].value;
        if (res.error) console.error('Error cargando aportes:', res.error);
        else if (res.data) setContributionsList(res.data);
      }

      if (results[6].status === 'fulfilled') {
        const res = results[6].value;
        if (res.error) console.error('Error cargando anuncio:', res.error);
        else if (res.data) setAnnouncementsList(res.data);
      }

      if (results[7].status === 'fulfilled') {
        const res = results[7].value;
        if (res.error) console.error('Error cargando pagos pendientes:', res.error);
        else if (res.data) setPaymentsList(res.data);
      }

    } catch (generalErr) {
      console.warn('Sync general interrumpido o demorado:', generalErr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // --- AUXILIAR COMPONENTE PAGINACIÓN ---
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

  // --- ACCIONES A: APROBACIÓN DE USUARIOS & APORTES ---
  const handleUpdateUserStatus = async (userId: string, newStatus: 'approved' | 'suspended' | 'pending') => {
    // Si la acción es "suspender", el usuario pasa a estado 'pending' en su perfil para perder acceso inmediato y aparecer de nuevo en la pestaña de Aprobaciones
    const targetProfileStatus = newStatus === 'suspended' ? 'pending' : newStatus;
    // Actualizar estados locales optimistas
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, status: targetProfileStatus } : u));
    
    if (newStatus === 'approved') {
      const startDate = new Date().toISOString();
      const endAccessDateObj = new Date();
      endAccessDateObj.setDate(endAccessDateObj.getDate() + 30);
      const endAccessDate = endAccessDateObj.toISOString();
      setSubscriptionsList(prev => prev.map(s => s.user_id === userId ? { ...s, status: 'active', start_date: startDate, end_date: endAccessDate } : s));
      try {
        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'active', start_date: startDate, end_date: endAccessDate })
          .eq('user_id', userId);
        if (error) throw error;
        showToast('🎓 Estudiante aprobado. ¡Plan Básico Mensual activado por 30 días!');
      } catch (err: any) {
        showToast(`Error al activar membresía: ${err.message}`, 'error');
      }
    } else if (newStatus === 'suspended') {
      setSubscriptionsList(prev => prev.map(s => s.user_id === userId ? { ...s, status: 'suspended' } : s));
      try {
        const { error } = await supabase
          .from('subscriptions')
          .update({ status: 'suspended' })
          .eq('user_id', userId);
        if (error) throw error;
        showToast('⚠️ Estudiante suspendido. Su acceso fue revocado y regresó a estado Pendiente.', 'info');
      } catch (err: any) {
        showToast(`Error al suspender membresía: ${err.message}`, 'error');
      }
    }

    try {
      const { error } = await supabase
        .from('users_profiles')
        .update({ status: targetProfileStatus })
        .eq('id', userId);
      if (error) throw error;

      // Enviar notificación al alumno
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: targetProfileStatus === 'approved' ? '🎓 Acceso Aprobado' : '⚠️ Cuenta Suspendida',
          message: targetProfileStatus === 'approved'
            ? '¡Tu cuenta ha sido aprobada! Ya tienes acceso completo a la academia.'
            : 'Tu cuenta ha sido suspendida. Si crees que es un error, por favor contacta a soporte.',
          is_read: false
        });

      showToast('✅ Estado de usuario actualizado.');
    } catch (err: any) {
      showToast(`Error de perfil en DB: ${err.message}`, 'error');
    }
  };

  const handleUpdateSubscriptionDates = async (userId: string) => {
    if (!editingSubStartDate || !editingSubEndDate) {
      showToast('⚠️ Debes ingresar ambas fechas.', 'error');
      return;
    }
    
    setSavingSubDates(true);
    
    const startDateISO = new Date(editingSubStartDate + 'T12:00:00').toISOString();
    const endDateISO = new Date(editingSubEndDate + 'T12:00:00').toISOString();

    // Actualizar estado local
    setSubscriptionsList(prev => prev.map(s => s.user_id === userId ? { ...s, start_date: startDateISO, end_date: endDateISO } : s));
    setEditingSubUserId(null);

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          start_date: startDateISO,
          end_date: endDateISO
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Enviar notificación al usuario sobre el cambio de fechas
      await supabase.from('notifications').insert({
        user_id: userId,
        title: '📅 Actualización de Membresía',
        message: `Las fechas de tu membresía han sido actualizadas. Nueva fecha de vencimiento: ${new Date(endDateISO).toLocaleDateString()}`,
        is_read: false
      });

      // Si le faltan 3 días o menos, enviarle la alerta de expiración de inmediato
      const diffTime = new Date(endDateISO).getTime() - new Date().getTime();
      const calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (calculatedDays > 0 && calculatedDays <= 3) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: '⚠️ Suscripción por Expirar',
          message: `Tu membresía termina en ${calculatedDays} día(s). Renueva pronto para no perder el acceso a la academia.`,
          is_read: false
        });
      }

      showToast('📅 Fechas de membresía actualizadas con éxito.');
    } catch (err: any) {
      console.error(err);
      showToast(`Error al guardar fechas: ${err.message}`, 'error');
    } finally {
      setSavingSubDates(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      const { data, error } = await supabase
        .from('course_categories')
        .insert({ name: newCategoryName })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setCategoriesList([...categoriesList, data]);
        showToast('✅ Categoría creada correctamente.');
        setNewCategoryName('');
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Error al crear categoría: ${err.message}`, 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const { error } = await supabase
        .from('course_categories')
        .delete()
        .eq('id', categoryId);
      if (error) throw error;
      setCategoriesList(prev => prev.filter(c => c.id !== categoryId));
      showToast('🗑️ Categoría eliminada correctamente.');
    } catch (err: any) {
      console.error(err);
      showToast(`Error al eliminar categoría: ${err.message}`, 'error');
    }
  };

  const handleApprovePayment = async (payment: any) => {
    try {
      const now = new Date();
      const endAccessDateObj = new Date();
      endAccessDateObj.setDate(endAccessDateObj.getDate() + 30);
      const endAccessDate = endAccessDateObj.toISOString();

      // 1. Aprobar pago
      const { error: payErr } = await supabase
        .from('payments')
        .update({ status: 'approved' })
        .eq('id', payment.id);
      if (payErr) throw payErr;

      // 2. Activar suscripción por 30 días
      const { error: subErr } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          start_date: now.toISOString(),
          end_date: endAccessDate
        })
        .eq('user_id', payment.user_id);
      if (subErr) throw subErr;

      // 3. Activar perfil de usuario
      const { error: userErr } = await supabase
        .from('users_profiles')
        .update({ status: 'approved' })
        .eq('id', payment.user_id);
      if (userErr) throw userErr;

      // 4. Enviar notificación al alumno
      await supabase
        .from('notifications')
        .insert({
          user_id: payment.user_id,
          title: '✅ ¡Membresía Aprobada!',
          message: 'Tu pago ha sido verificado. Tu plan premium ha sido activado por 30 días.',
          is_read: false
        });

      // Actualizar estados locales de forma optimista
      setPaymentsList(prev => prev.filter(p => p.id !== payment.id));
      setSubscriptionsList(prev => prev.map(s => s.user_id === payment.user_id ? { ...s, status: 'active', start_date: now.toISOString(), end_date: endAccessDate } : s));
      setUsersList(prev => prev.map(u => u.id === payment.user_id ? { ...u, status: 'approved' } : u));

      showToast('💸 Pago aprobado. Suscripción y cuenta activadas por 30 días.');
    } catch (err: any) {
      console.error(err);
      showToast(`Error al aprobar pago: ${err.message}`, 'error');
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'rejected' })
        .eq('id', paymentId);
      if (error) throw error;

      setPaymentsList(prev => prev.filter(p => p.id !== paymentId));
      showToast('❌ Comprobante de pago rechazado.', 'info');
    } catch (err: any) {
      console.error(err);
      showToast(`Error al rechazar pago: ${err.message}`, 'error');
    }
  };

  const handleLoadUserPayments = async (userId: string) => {
    if (expandedUserPaymentsId === userId) {
      setExpandedUserPaymentsId(null);
      return;
    }
    
    setExpandedUserPaymentsId(userId);
    setLoadingUserPayments(true);
    setUserPaymentsHistory([]);

    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setUserPaymentsHistory(data);
    } catch (err) {
      console.error('Error cargando historial de pagos del usuario:', err);
    } finally {
      setLoadingUserPayments(false);
    }
  };

  const handleReviewContribution = async (contId: string, newStatus: 'approved' | 'rejected') => {
    setContributionsList(prev => prev.filter(c => c.id !== contId));
    try {
      const { error } = await supabase.from('user_contributions').update({ status: newStatus }).eq('id', contId);
      if (error) throw error;
      if (newStatus === 'approved') {
        showToast('💡 Aporte aprobado y publicado en comunidad.');
      } else {
        showToast('❌ Aporte rechazado correctamente.', 'info');
      }
    } catch (err: any) {
      showToast(`Error al moderar aporte: ${err.message || 'Verifica RLS'}`, 'error');
    }
  };

  // --- ACCIONES B: CONTROL DE ESTUDIANTES & NOTIFICACIONES ---
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForNotif || !notifTitle.trim() || !notifMessage.trim()) return;
    setSendingNotif(true);

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedUserForNotif,
          title: notifTitle,
          message: notifMessage,
          is_read: false
        });

      if (error) throw error;

      showToast('🔔 Notificación individual enviada al buzón del alumno.');
      setNotifTitle('');
      setNotifMessage('');
      setSelectedUserForNotif('');
    } catch (err: any) {
      console.error(err);
      showToast(`Error al enviar mensaje: ${err.message || 'Sin permisos'}`, 'error');
    } finally {
      setSendingNotif(false);
    }
  };

  // --- ACCIONES C: CURSOS & BONOS ---
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim() || !courseDriveUrl.trim()) return;

    const newCourseObj = {
      title: courseTitle,
      description: courseDesc,
      drive_url: courseDriveUrl,
      image_url: courseImageUrl || 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800',
      is_active: true,
      category_id: courseCategory || null
    };

    try {
      const { data, error } = await supabase
        .from('courses')
        .insert(newCourseObj)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCoursesList([data, ...coursesList]);
        
        // Notificación global de nuevo curso
        await supabase
          .from('notifications')
          .insert({
            user_id: null,
            title: '📚 ¡Nuevo curso publicado!',
            message: `Ya está disponible el curso: "${newCourseObj.title}". ¡Empieza a aprender hoy!`,
            is_read: false
          });

        showToast('📚 ¡Nuevo curso publicado con éxito!');
        setCourseTitle('');
        setCourseDesc('');
        setCourseDriveUrl('');
        setCourseImageUrl('');
        setCourseCategory('');
      }
    } catch (err: any) {
      console.error('Error insertando curso:', err);
      showToast(`Error al publicar curso: ${err.message || 'Verifica políticas RLS'}`, 'error');
    }
  };

  const handleUpdateCourseDetails = async (courseId: string) => {
    if (!editingCourseTitle.trim()) return;
    
    setCoursesList(prev => prev.map(c => c.id === courseId ? { ...c, title: editingCourseTitle, description: editingCourseDesc } : c));
    setEditingCourseId(null);

    try {
      const { error } = await supabase
        .from('courses')
        .update({ title: editingCourseTitle, description: editingCourseDesc })
        .eq('id', courseId);
      if (error) throw error;
      showToast('✅ Curso actualizado de forma persistente.');
    } catch (err: any) {
      console.error(err);
      showToast(`Error al editar curso: ${err.message}`, 'error');
    }
  };

  const handleCreateBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusTitle.trim()) return;

    const newBonusObj = {
      title: bonusTitle,
      description: bonusDesc,
      drive_url: bonusDriveUrl || '#',
      image_url: bonusImageUrl || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800',
      is_global: bonusIsGlobal,
      is_active: true
    };

    try {
      const { data, error } = await supabase
        .from('bonuses')
        .insert(newBonusObj)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setBonusesList([data, ...bonusesList]);
        
        // Notificación global de nuevo bono
        await supabase.from('notifications').insert({
          user_id: null,
          title: '🎁 ¡Nuevo Bono VIP!',
          message: `Hemos añadido un nuevo recurso a la bóveda: "${newBonusObj.title}". ¡Disfrútalo!`,
          is_read: false
        });

        showToast('🎁 ¡Bono publicado en el catálogo!');
        setBonusTitle('');
        setBonusDesc('');
        setBonusDriveUrl('');
        setBonusImageUrl('');
      }
    } catch (err: any) {
      console.error('Error insertando bono:', err);
      showToast(`Error al subir bono: ${err.message || 'Verifica RLS'}`, 'error');
    }
  };

  const handleUpdateBonusDetails = async (bonusId: string) => {
    if (!editingBonusTitle.trim()) return;

    setBonusesList(prev => prev.map(b => b.id === bonusId ? { ...b, title: editingBonusTitle, description: editingBonusDesc } : b));
    setEditingBonusId(null);

    try {
      const { error } = await supabase
        .from('bonuses')
        .update({ title: editingBonusTitle, description: editingBonusDesc })
        .eq('id', bonusId);
      if (error) throw error;
      showToast('✅ Detalles de bono editados correctamente.');
    } catch (err: any) {
      console.error(err);
      showToast(`Error al editar bono: ${err.message}`, 'error');
    }
  };

  const handleToggleCourseActive = async (courseId: string, currentActive: boolean) => {
    setCoursesList(prev => prev.map(c => c.id === courseId ? { ...c, is_active: !currentActive } : c));
    try {
      const { error } = await supabase.from('courses').update({ is_active: !currentActive }).eq('id', courseId);
      if (error) throw error;
      showToast(currentActive ? '⏸️ Curso pausado de la academia.' : '▶️ Curso activado en catálogo.');
    } catch (err: any) {
      showToast(`Error de RLS: ${err.message}`, 'error');
    }
  };

  const handleToggleBonusActive = async (bonusId: string, currentActive: boolean) => {
    setBonusesList(prev => prev.map(b => b.id === bonusId ? { ...b, is_active: !currentActive } : b));
    try {
      const { error } = await supabase.from('bonuses').update({ is_active: !currentActive }).eq('id', bonusId);
      if (error) throw error;
      showToast(currentActive ? '⏸️ Bono pausado de la academia.' : '▶️ Bono activado en catálogo.');
    } catch (err: any) {
      showToast(`Error de RLS: ${err.message}`, 'error');
    }
  };

  // --- ACCIONES D: BLOG Y AVISOS GLOBALES ---
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    setSavingAnnouncement(true);

    try {
      const { data, error } = await supabase
        .from('news_posts')
        .insert({
          title: 'Aviso Global de la Academia',
          content: announcementText,
          type: 'announcement',
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setAnnouncementsList([data, ...announcementsList]);
        setAnnouncementText('');

        // Notificación global de aviso
        await supabase
          .from('notifications')
          .insert({
            user_id: null,
            title: '📢 Nuevo aviso de la academia',
            message: announcementText,
            is_read: false
          });

        showToast('📢 Nuevo aviso publicado con éxito.');
      }
    } catch (err: any) {
      console.error('Error actualizando aviso:', err);
      showToast(`Error al crear aviso: ${err.message || 'Verifica RLS'}`, 'error');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleRemoveAnnouncement = async (annId: string) => {
    // Optimistic update
    setAnnouncementsList(prev => prev.filter(a => a.id !== annId));

    try {
      const { error } = await supabase
        .from('news_posts')
        .update({ is_active: false })
        .eq('id', annId);

      if (error) throw error;
      showToast('🗑️ Aviso removido con éxito.');
    } catch (err: any) {
      console.error(err);
      showToast(`Error al remover aviso: ${err.message}`, 'error');
      loadAdminData();
    }
  };

  const handleCreateBlogPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blogTitle.trim() || !blogContent.trim()) return;
    setSavingBlog(true);

    try {
      const { error } = await supabase
        .from('news_posts')
        .insert({
          title: blogTitle,
          content: blogContent,
          image_url: blogImageUrl || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800',
          type: 'blog',
          is_active: true
        });

      if (error) throw error;

      // Notificación global de blog
      await supabase
        .from('notifications')
        .insert({
          user_id: null,
          title: '✍️ Nuevo artículo en el Blog',
          message: `Se ha publicado: "${blogTitle}". ¡Léelo ahora!`,
          is_read: false
        });

      showToast('✍️ ¡Artículo de blog publicado con éxito!');
      setBlogTitle('');
      setBlogContent('');
      setBlogImageUrl('');
    } catch (err: any) {
      console.error('Error creando post blog:', err);
      showToast(`Error al publicar: ${err.message || 'Verifica RLS'}`, 'error');
    } finally {
      setSavingBlog(false);
    }
  };

  // --- FILTROS DE ESTUDIANTES & DÍAS RESTANTES ---
  const studentsWithDays = usersList
    .filter(u => u.role !== 'admin')
    .map(user => {
      const sub = subscriptionsList.find(s => s.user_id === user.id);
      let daysLeft = null;
      let status = sub ? sub.status : 'pending';

      if (sub && sub.end_date) {
        const diffTime = new Date(sub.end_date).getTime() - new Date().getTime();
        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) {
          daysLeft = 0;
          status = 'expired';
        }
      }
      return { 
        ...user, 
        daysLeft, 
        subStatus: status, 
        subStartDate: sub?.start_date, 
        subEndDate: sub?.end_date 
      };
    });

  const filteredStudents = studentsWithDays.filter(u => {
    const q = searchQuery.toLowerCase();
    const emailMatch = u.email ? u.email.toLowerCase().includes(q) : false;
    const nameMatch = u.full_name ? u.full_name.toLowerCase().includes(q) : false;
    return emailMatch || nameMatch;
  });

  const pendingUsers = usersList.filter(u => u.status === 'pending' && u.role !== 'admin');

  // --- REBANADAS DE PAGINACIÓN (5 por página) ---
  const paginatedPendingUsers = pendingUsers.slice(
    (pagePendingUsers - 1) * ITEMS_PER_PAGE,
    pagePendingUsers * ITEMS_PER_PAGE
  );

  const paginatedContributions = contributionsList.slice(
    (pageContributions - 1) * ITEMS_PER_PAGE,
    pageContributions * ITEMS_PER_PAGE
  );

  const paginatedStudents = filteredStudents.slice(
    (pageStudents - 1) * ITEMS_PER_PAGE,
    pageStudents * ITEMS_PER_PAGE
  );

  const paginatedCourses = coursesList.slice(
    (pageCourses - 1) * ITEMS_PER_PAGE,
    pageCourses * ITEMS_PER_PAGE
  );

  const paginatedBonuses = bonusesList.slice(
    (pageBonuses - 1) * ITEMS_PER_PAGE,
    pageBonuses * ITEMS_PER_PAGE
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-20 relative">
      
      {/* Premium Toast Notification Popup */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 animate-fade-in flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all ${
          toastMessage.type === 'success' 
            ? 'bg-green-650/95 text-white border-green-500/50 shadow-green-550/20' 
            : toastMessage.type === 'error'
            ? 'bg-red-650/95 text-white border-red-500/50 shadow-red-550/20'
            : 'bg-indigo-650/95 text-white border-indigo-500/50 shadow-indigo-550/20'
        }`}>
          {toastMessage.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
          <span className="text-xs font-extrabold uppercase tracking-wider">{toastMessage.text}</span>
        </div>
      )}

      {/* Cabecera con Sync Status Inline */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-1.5 bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full border border-yellow-200 animate-pulse">
              <Loader2 className="animate-spin text-yellow-600" size={12} />
              <span className="text-[9px] font-extrabold uppercase tracking-wider">Sincronizando base de datos...</span>
            </div>
          )}
        </div>
      </div>

      {/* Selector de Pestañas Premium */}
      <div className="flex bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-white/80 shadow-sm w-full gap-1 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all ${
            activeTab === 'approvals' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <ShieldAlert size={16} />
          <span>Aprobaciones</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all ${
            activeTab === 'students' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <Users size={16} />
          <span>Alumnos & Suscripción</span>
        </button>

        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all ${
            activeTab === 'content' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <BookOpen size={16} />
          <span>Cursos & Bonos</span>
        </button>

        <button
          onClick={() => setActiveTab('comms')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all ${
            activeTab === 'comms' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <FileText size={16} />
          <span>Comunicados & Blog</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide shrink-0 transition-all ${
            activeTab === 'analytics' ? 'bg-gray-950 text-white shadow-md' : 'text-gray-500 hover:bg-white/40'
          }`}
        >
          <ChartIcon size={16} />
          <span>Analíticas</span>
        </button>
      </div>

      <div className="animate-fade-in">
        
        {/* TAB 0: ANALÍTICAS */}
        {activeTab === 'analytics' && <AdminAnalytics />}

        {/* TAB 1: APROBACIONES & MODERACIÓN */}
        {activeTab === 'approvals' && (
          <div className="flex flex-col gap-6">
            
            {/* Cuentas Pendientes */}
            <div className="flex flex-col gap-3">
              <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Validación de Nuevos Alumnos</h3>
              {pendingUsers.length > 0 ? (
                <div>
                  <div className="flex flex-col gap-3">
                    {paginatedPendingUsers.map(user => (
                      <div key={user.id} className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-yellow-250 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-gray-900">{user.full_name || 'Nuevo Estudiante'}</h4>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 uppercase tracking-wider">Pendiente</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateUserStatus(user.id, 'approved')}
                            className="bg-green-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-green-700 transition-colors flex items-center gap-1.5 shadow cursor-pointer"
                          >
                            <Check size={14} /> Aprobar Cuenta
                          </button>
                          <button
                            onClick={() => handleUpdateUserStatus(user.id, 'suspended')}
                            className="bg-red-50 text-red-600 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <X size={14} /> Suspender
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderPagination(pagePendingUsers, pendingUsers.length, setPagePendingUsers)}
                </div>
              ) : (
                <div className="text-center py-10 bg-white/60 backdrop-blur-md rounded-3xl border border-dashed border-gray-250 flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 bg-green-50 text-green-500 rounded-full flex items-center justify-center"><Sparkles size={18} /></div>
                  <p className="text-gray-800 text-xs font-extrabold">🎉 ¡Cuentas al día!</p>
                </div>
              )}
            </div>

            {/* Aportes de Comunidad Pendientes */}
            <div className="flex flex-col gap-3">
              <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Moderación de Aportes Comunidad</h3>
              {contributionsList.length > 0 ? (
                <div>
                  <div className="flex flex-col gap-3">
                    {paginatedContributions.map(cont => (
                      <div key={cont.id} className="bg-white/85 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-4">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="text-[9px] font-extrabold uppercase text-blue-600 tracking-wider bg-blue-50 px-2 py-0.5 rounded">
                              {cont.contribution_type === 'tip' ? '💡 Tip' : cont.contribution_type === 'book' ? '📘 Libro' : '🔗 Enlace'}
                            </span>
                            <h4 className="font-extrabold text-sm text-gray-900 mt-1">{cont.title}</h4>
                            <p className="text-[10px] text-gray-400 mt-1">Por: {cont.users_profiles?.full_name || cont.users_profiles?.email}</p>
                          </div>
                        </div>
                        <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-150 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                          {cont.description}
                          {cont.link_url && (
                            <a href={cont.link_url} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline block mt-2">🔗 Ver Archivo/Link</a>
                          )}
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleReviewContribution(cont.id, 'approved')}
                            className="bg-green-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-green-700 transition-colors flex items-center gap-1 shadow cursor-pointer"
                          >
                            <Check size={14} /> Aprobar aporte
                          </button>
                          <button
                            onClick={() => handleReviewContribution(cont.id, 'rejected')}
                            className="bg-red-50 text-red-600 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition-colors cursor-pointer"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderPagination(pageContributions, contributionsList.length, setPageContributions)}
                </div>
              ) : (
                <div className="text-center py-10 bg-white/60 backdrop-blur-md rounded-3xl border border-dashed border-gray-250 flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center"><Inbox size={18} /></div>
                  <p className="text-gray-800 text-xs font-extrabold">📬 ¡Bandeja de aportes limpia!</p>
                </div>
              )}
            </div>

            {/* Validación de Comprobantes de Pago Pendientes */}
            <div className="flex flex-col gap-3">
              <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Comprobantes de Pago Pendientes</h3>
              {paymentsList.length > 0 ? (
                <div>
                  <div className="flex flex-col gap-3">
                    {paymentsList.slice((pagePayments - 1) * ITEMS_PER_PAGE, pagePayments * ITEMS_PER_PAGE).map(pay => (
                      <div key={pay.id} className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-indigo-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-gray-900">{pay.users_profiles?.full_name || 'Estudiante'}</h4>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wider font-extrabold">Monto: ${pay.amount} USD</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{pay.users_profiles?.email}</p>
                          <p className="text-xs text-gray-600 mt-2 font-semibold">
                            <span className="font-extrabold text-gray-700">Fecha Pago:</span> {pay.payment_date ? new Date(pay.payment_date + 'T12:00:00').toLocaleDateString() : 'N/A'}
                          </p>
                          {pay.notes && (
                            <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2.5 rounded-xl border border-gray-150">
                              <span className="font-bold text-gray-600">Nota:</span> {pay.notes}
                            </p>
                          )}
                          {pay.receipt_url && (
                            <button
                              type="button"
                              onClick={() => setActiveReceiptModalUrl(pay.receipt_url)}
                              className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 mt-2.5 w-max cursor-pointer bg-transparent border-none p-0"
                            >
                              📂 Ver Imagen / Comprobante de Pago
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleApprovePayment(pay)}
                            className="bg-green-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-green-700 transition-colors flex items-center gap-1.5 shadow cursor-pointer"
                          >
                            <Check size={14} /> Aprobar Pago
                          </button>
                          <button
                            onClick={() => handleRejectPayment(pay.id)}
                            className="bg-red-50 text-red-600 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <X size={14} /> Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderPagination(pagePayments, paymentsList.length, setPagePayments)}
                </div>
              ) : (
                <div className="text-center py-10 bg-white/60 backdrop-blur-md rounded-3xl border border-dashed border-gray-250 flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center"><Sparkles size={18} /></div>
                  <p className="text-gray-800 text-xs font-extrabold">🎉 ¡Todos los comprobantes están al día!</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: ALUMNOS & SUSCRIPCIÓN */}
        {activeTab === 'students' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Listado con vencimientos */}
            <div className="md:col-span-2 flex flex-col gap-4">
              <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Auditoría de Membresías</h3>
              
              {/* Buscador */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar estudiante..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3.5 bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl text-xs font-semibold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
                />
              </div>

              <div>
                <div className="flex flex-col gap-3">
                  {paginatedStudents.map(student => {
                    const isExpiring = student.daysLeft !== null && student.daysLeft <= 7;
                    const isExpired = student.subStatus === 'expired' || (student.daysLeft !== null && student.daysLeft === 0);

                    return (
                      <div key={student.id} className={`bg-white/95 rounded-3xl p-5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isExpired 
                          ? 'border-red-300' 
                          : isExpiring 
                          ? 'border-orange-355 bg-orange-50/10' 
                          : 'border-white/85'
                      }`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-gray-900">{student.full_name || 'Sin Nombre'}</h4>
                            <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              isExpired 
                                ? 'bg-red-100 text-red-700' 
                                : isExpiring 
                                ? 'bg-orange-100 text-orange-700 animate-pulse' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {isExpired ? 'Expirado' : isExpiring ? 'Vence pronto' : student.subStatus}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{student.email}</p>
                           {/* Mostrar fechas de inicio y vencimiento real */}
                           <div className="mt-2 text-[10px] text-gray-500 flex flex-col gap-0.5 bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                             <div>
                               <span className="font-extrabold text-gray-700">Inicio:</span> {student.subStartDate ? new Date(student.subStartDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'No registrado'}
                             </div>
                             <div>
                               <span className="font-extrabold text-gray-700">Vencimiento:</span> {student.subEndDate ? new Date(student.subEndDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'No registrado'}
                             </div>
                           </div>
                          
                          <p className="text-xs font-semibold text-gray-600 mt-2 flex items-center gap-1.5">
                            {isExpired ? (
                              <span className="text-red-650 font-bold flex items-center gap-1"><AlertTriangle size={14} /> ¡Suscripción Vencida!</span>
                            ) : student.daysLeft !== null ? (
                              <span className={isExpiring ? 'text-orange-600 font-bold' : 'text-gray-500'}>
                                ⏰ Quedan {student.daysLeft} {student.daysLeft === 1 ? 'día' : 'días'} de acceso
                              </span>
                            ) : (
                              <span className="text-gray-400">Sin fecha de expiración</span>
                            )}
                          </p>

                          {/* Formulario/Botón de edición de fechas inline */}
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
                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] font-extrabold uppercase text-gray-455 mb-0.5">Vencimiento</label>
                                  <input 
                                    type="date"
                                    value={editingSubEndDate}
                                    onChange={e => setEditingSubEndDate(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold outline-none"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-1.5 justify-end mt-1">
                                <button
                                  onClick={() => setEditingSubUserId(null)}
                                  className="bg-gray-200 hover:bg-gray-250 text-gray-700 text-[9px] font-extrabold px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => handleUpdateSubscriptionDates(student.id)}
                                  disabled={savingSubDates}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-md transition-colors flex items-center gap-0.5 cursor-pointer"
                                >
                                  {savingSubDates ? <Loader2 className="animate-spin w-2.5 h-2.5" /> : 'Guardar'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                onClick={() => {
                                  setEditingSubUserId(student.id);
                                  setEditingSubStartDate(student.subStartDate ? student.subStartDate.split('T')[0] : '');
                                  setEditingSubEndDate(student.subEndDate ? student.subEndDate.split('T')[0] : '');
                                }}
                                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[9px] font-extrabold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer w-max"
                              >
                                <Calendar size={12} /> Cambiar Fechas
                              </button>

                              <button
                                onClick={() => handleLoadUserPayments(student.id)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[9px] font-extrabold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer w-max"
                              >
                                <FileText size={12} className="text-gray-500" /> Historial Pagos
                              </button>
                            </div>
                          )}

                          {/* Historial de Pagos Expandible de este usuario específico */}
                          {expandedUserPaymentsId === student.id && (
                            <div className="mt-3 bg-gray-50 border border-gray-200 p-3 rounded-2xl flex flex-col gap-2 max-w-[280px]">
                              <h5 className="text-[9px] font-black uppercase text-indigo-700 tracking-wider">Historial de Pagos</h5>
                              {loadingUserPayments ? (
                                <div className="flex justify-center py-3"><Loader2 className="animate-spin w-4 h-4 text-indigo-600" /></div>
                              ) : userPaymentsHistory.length === 0 ? (
                                <p className="text-[10px] text-gray-500 py-2">No hay pagos registrados para este usuario.</p>
                              ) : (
                                <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                                  {userPaymentsHistory.map(p => (
                                    <div key={p.id} className="bg-white p-2 rounded-xl border border-gray-150 flex flex-col gap-1">
                                      <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-extrabold text-gray-900">${p.amount} USD</span>
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                          p.status === 'approved' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>{p.status === 'approved' ? 'Aprobado' : p.status === 'rejected' ? 'Rechazado' : 'Pendiente'}</span>
                                      </div>
                                      <p className="text-[9px] text-gray-500">{p.payment_date ? new Date(p.payment_date + 'T12:00:00').toLocaleDateString() : 'N/A'}</p>
                                      {p.receipt_url && (
                                        <button
                                          type="button"
                                          onClick={() => setActiveReceiptModalUrl(p.receipt_url)}
                                          className="text-[9px] font-extrabold text-indigo-650 hover:underline block mt-0.5 cursor-pointer bg-transparent border-none p-0 text-left"
                                        >
                                          📂 Ver Comprobante
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateUserStatus(student.id, 'approved')}
                            className="bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-black transition-colors cursor-pointer"
                          >
                            Renovar 30D
                          </button>
                          <button
                            onClick={() => handleUpdateUserStatus(student.id, 'suspended')}
                            className="bg-red-50 text-red-600 text-xs font-bold px-3 py-2.5 rounded-xl hover:bg-red-100 transition-colors cursor-pointer"
                          >
                            Suspender
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {renderPagination(pageStudents, filteredStudents.length, setPageStudents)}
              </div>
            </div>

            {/* Envío de notificaciones individuales (Rediseño compacto y scrollable anti-recortes) */}
            <div 
              className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-3 h-max sticky top-24 max-h-[calc(100vh-140px)] overflow-y-auto hide-scrollbar"
              style={{ scrollbarWidth: 'none' }}
            >
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <BellRing className="text-yellow-600" size={18} />
                <span>Enviar Notificación Directa</span>
              </h3>

              <form onSubmit={handleSendNotification} className="flex flex-col gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Seleccionar Alumno</label>
                  <select
                    required
                    value={selectedUserForNotif}
                    onChange={e => setSelectedUserForNotif(e.target.value)}
                    className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none"
                  >
                    <option value="">-- Seleccionar Estudiante --</option>
                    {usersList.filter(u => u.role !== 'admin').map(u => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Asunto / Título</label>
                  <input 
                    type="text" 
                    required
                    value={notifTitle}
                    onChange={e => setNotifTitle(e.target.value)}
                    placeholder="Ej: Revisa tu plan de estudio"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Mensaje del Aviso</label>
                  <textarea 
                    required
                    value={notifMessage}
                    onChange={e => setNotifMessage(e.target.value)}
                    placeholder="Escribe el cuerpo del mensaje..."
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingNotif}
                  className="w-full py-3 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50 mt-1 cursor-pointer"
                  style={{ backgroundColor: '#4f46e5' }}
                >
                  {sendingNotif ? <Loader2 className="animate-spin" size={14} /> : <><Send size={12} /> Enviar Mensaje Directo</>}
                </button>
              </form>
            </div>

          </div>
        )}

        {/* TAB 3: CURSOS & BONOS */}
        {activeTab === 'content' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
            
            {/* Panel de Cursos */}
            <div className="flex flex-col gap-6">
              
              {/* Formulario Creador de Cursos */}
              <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm flex flex-col gap-4">
                <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                  <PlusCircle className="text-blue-600" size={18} />
                  <span>Subir Nuevo Curso</span>
                </h3>
                
                <form onSubmit={handleCreateCourse} className="flex flex-col gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Título del Curso</label>
                    <input 
                      type="text" 
                      required
                      value={courseTitle}
                      onChange={e => setCourseTitle(e.target.value)}
                      placeholder="Ej: Introducción a embudos digitales"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Descripción</label>
                    <textarea 
                      required
                      value={courseDesc}
                      onChange={e => setCourseDesc(e.target.value)}
                      placeholder="De qué trata el curso..."
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">URL de Drive / Material</label>
                      <input 
                        type="text" 
                        required
                        value={courseDriveUrl}
                        onChange={e => setCourseDriveUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Categoría</label>
                      <select
                        value={courseCategory}
                        onChange={e => setCourseCategory(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-xs font-semibold text-gray-700"
                      >
                        <option value="">General</option>
                        {categoriesList.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">URL Portada de Imagen</label>
                    <input 
                      type="url" 
                      value={courseImageUrl}
                      onChange={e => setCourseImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 text-white rounded-xl text-xs font-bold shadow hover:opacity-90 transition-all cursor-pointer"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    Publicar Nuevo Curso
                  </button>
                </form>
              </div>

              {/* Listado y editor inline de Cursos con Paginación */}
              <div className="flex flex-col gap-3">
                <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Cursos Existentes (Edición)</h3>
                <div>
                  <div className="flex flex-col gap-3">
                    {paginatedCourses.map(course => (
                      <div key={course.id} className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-3">
                        {editingCourseId === course.id ? (
                          <div className="flex flex-col gap-3">
                            <input 
                              type="text"
                              value={editingCourseTitle}
                              onChange={e => setEditingCourseTitle(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                            />
                            <textarea 
                              value={editingCourseDesc}
                              onChange={e => setEditingCourseDesc(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => handleUpdateCourseDetails(course.id)} className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">Guardar</button>
                              <button onClick={() => setEditingCourseId(null)} className="bg-gray-150 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="font-extrabold text-sm text-gray-900">{course.title}</h4>
                              <div className="flex gap-1.5">
                                <button 
                                  onClick={() => {
                                    setEditingCourseId(course.id);
                                    setEditingCourseTitle(course.title);
                                    setEditingCourseDesc(course.description || '');
                                  }} 
                                  className="text-gray-455 hover:text-blue-600 p-1.5 rounded-lg cursor-pointer"
                                >
                                  <FileEdit size={16} />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{course.description || 'Sin descripción'}</p>
                            <div className="flex justify-between items-center border-t border-gray-55 pt-3 mt-3">
                              <span className={`text-[9px] font-extrabold uppercase ${course.is_active ? 'text-green-600' : 'text-red-500'}`}>
                                {course.is_active ? 'Activo en Academia' : 'Pausado'}
                              </span>
                              <button
                                onClick={() => handleToggleCourseActive(course.id, course.is_active)}
                                className={`text-[10px] font-bold px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                                  course.is_active ? 'border-red-250 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'
                                }`}
                              >
                                {course.is_active ? 'Pausar' : 'Activar'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {renderPagination(pageCourses, coursesList.length, setPageCourses)}
                </div>
              </div>

              {/* Sección Gestión de Categorías de Cursos */}
              <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm flex flex-col gap-4">
                <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                  <Sparkles className="text-indigo-600" size={18} />
                  <span>Gestión de Categorías de Cursos</span>
                </h3>
                
                <form onSubmit={handleCreateCategory} className="flex gap-2">
                  <input 
                    type="text" 
                    required
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="Ej: Inversiones, Mindset..."
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={savingCategory}
                    className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0"
                  >
                    {savingCategory ? <Loader2 className="animate-spin w-4 h-4" /> : 'Añadir'}
                  </button>
                </form>

                <div className="flex flex-wrap gap-2 mt-1">
                  {categoriesList.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin categorías personalizadas.</p>
                  ) : (
                    categoriesList.map(cat => (
                      <span 
                        key={cat.id} 
                        className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-xl"
                      >
                        {cat.name}
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="text-red-500 hover:text-red-700 font-extrabold cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
                          title="Eliminar categoría"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Panel de Bonos */}
            <div className="flex flex-col gap-6">
              
              {/* Formulario Creador de Bonos */}
              <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm flex flex-col gap-4">
                <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
                  <PlusCircle className="text-purple-600" size={18} />
                  <span>Subir Nuevo Bono Premium</span>
                </h3>
                
                <form onSubmit={handleCreateBonus} className="flex flex-col gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Título del Bono</label>
                    <input 
                      type="text" 
                      required
                      value={bonusTitle}
                      onChange={e => setBonusTitle(e.target.value)}
                      placeholder="Ej: Plantilla de Copywriting Avanzado"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Descripción</label>
                    <textarea 
                      required
                      value={bonusDesc}
                      onChange={e => setBonusDesc(e.target.value)}
                      placeholder="Qué recursos contiene..."
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Enlace de Descarga</label>
                      <input 
                        type="url" 
                        value={bonusDriveUrl}
                        onChange={e => setBonusDriveUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Público</label>
                      <select
                        value={bonusIsGlobal ? 'true' : 'false'}
                        onChange={e => setBonusIsGlobal(e.target.value === 'true')}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-xs font-semibold text-gray-700"
                      >
                        <option value="true">Global (Para Todos)</option>
                        <option value="false">Privado (Solo Asignado)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 text-white rounded-xl text-xs font-bold shadow hover:opacity-90 transition-all cursor-pointer"
                    style={{ backgroundColor: '#7c3aed' }}
                  >
                    Publicar Nuevo Bono
                  </button>
                </form>
              </div>

              {/* Listado y editor inline de Bonos con Paginación */}
              <div className="flex flex-col gap-3">
                <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider px-1">Bonos Existentes (Edición)</h3>
                <div>
                  <div className="flex flex-col gap-3">
                    {paginatedBonuses.map(bonus => (
                      <div key={bonus.id} className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-3">
                        {editingBonusId === bonus.id ? (
                          <div className="flex flex-col gap-3">
                            <input 
                              type="text"
                              value={editingBonusTitle}
                              onChange={e => setEditingBonusTitle(e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
                            />
                            <textarea 
                              value={editingBonusDesc}
                              onChange={e => setEditingBonusDesc(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => handleUpdateBonusDetails(bonus.id)} className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">Guardar</button>
                              <button onClick={() => setEditingBonusId(null)} className="bg-gray-150 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-extrabold text-sm text-gray-900">{bonus.title}</h4>
                                <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${
                                  bonus.is_global ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'
                                }`}>
                                  {bonus.is_global ? 'Global' : 'Privado'}
                                </span>
                              </div>
                              <button 
                                onClick={() => {
                                  setEditingBonusId(bonus.id);
                                  setEditingBonusTitle(bonus.title);
                                  setEditingBonusDesc(bonus.description || '');
                                }} 
                                className="text-gray-455 hover:text-blue-600 p-1.5 rounded-lg cursor-pointer"
                              >
                                <FileEdit size={16} />
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 leading-relaxed">{bonus.description}</p>
                            <div className="flex justify-between items-center border-t border-gray-55 pt-3 mt-3">
                              <span className={`text-[9px] font-extrabold uppercase ${bonus.is_active ? 'text-green-600' : 'text-red-500'}`}>
                                {bonus.is_active ? 'Activo' : 'Pausado'}
                              </span>
                              <button
                                onClick={() => handleToggleBonusActive(bonus.id, bonus.is_active)}
                                className={`text-[10px] font-bold px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                                  bonus.is_active ? 'border-red-250 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'
                                }`}
                              >
                                {bonus.is_active ? 'Pausar' : 'Activar'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {renderPagination(pageBonuses, bonusesList.length, setPageBonuses)}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 4: BLOG & AVISOS GLOBALES */}
        {activeTab === 'comms' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
            
            {/* Formulario de Anuncio de Inicio */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm flex flex-col gap-4 h-max">
              <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                <AlertCircle className="text-yellow-600" size={18} />
                <span>Aviso de Inicio (Estudiantes)</span>
              </h3>
              <p className="text-[11px] text-gray-500">Este mensaje aparecerá destacado en color amarillo en la cabecera de la pantalla de inicio de todos los alumnos activos.</p>
              
              <form onSubmit={handleCreateAnnouncement} className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Nuevo Mensaje de Alerta</label>
                  <textarea 
                    required
                    value={announcementText}
                    onChange={e => setAnnouncementText(e.target.value)}
                    placeholder="Ej: Este miércoles tendremos mentoría privada a las 8:00 PM..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingAnnouncement}
                  className="w-full py-3.5 bg-yellow-600 hover:bg-yellow-750 text-white rounded-xl text-xs font-bold shadow-md shadow-yellow-250 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {savingAnnouncement ? <Loader2 className="animate-spin" size={16} /> : 'Publicar Nuevo Aviso'}
                </button>
              </form>

              {/* Listado de avisos activos */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-extrabold text-gray-950">Avisos Activos Actualmente ({announcementsList.length})</h4>
                {announcementsList.length === 0 ? (
                  <p className="text-[11px] text-gray-500 italic bg-gray-50/50 p-4 rounded-2xl text-center">No hay avisos activos en la academia.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {announcementsList.map((ann) => (
                      <div key={ann.id} className="bg-yellow-50/50 border border-yellow-200/50 rounded-2xl p-3.5 flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <p className="text-[11px] font-bold text-yellow-800 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                          <span className="text-[9px] text-gray-400 block mt-1">{new Date(ann.created_at).toLocaleDateString()}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveAnnouncement(ann.id)}
                          type="button"
                          className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                          title="Remover aviso"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Formulario Creador de Blog */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm flex flex-col gap-4">
              <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
                <PlusCircle className="text-pink-600" size={18} />
                <span>Crear Entrada para el Blog</span>
              </h3>
              
              <form onSubmit={handleCreateBlogPost} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Título del Post</label>
                  <input 
                    type="text" 
                    required
                    value={blogTitle}
                    onChange={e => setBlogTitle(e.target.value)}
                    placeholder="Ej: 5 Consejos para duplicar conversiones"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Contenido del Artículo</label>
                  <textarea 
                    required
                    value={blogContent}
                    onChange={e => setBlogContent(e.target.value)}
                    placeholder="Escribe el cuerpo del artículo..."
                    rows={6}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">URL de Imagen Ilustrativa</label>
                  <input 
                    type="url" 
                    value={blogImageUrl}
                    onChange={e => setBlogImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingBlog}
                  className="w-full py-3.5 bg-pink-600 hover:bg-pink-705 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {savingBlog ? <Loader2 className="animate-spin" size={16} /> : 'Publicar en el Blog'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modal para visualizar comprobantes de pago en grande */}
      {activeReceiptModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-2xl max-w-lg w-full flex flex-col gap-4 relative animate-scale-up">
            <button 
              onClick={() => setActiveReceiptModalUrl(null)}
              className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full transition-colors cursor-pointer flex items-center justify-center"
              title="Cerrar"
            >
              <X size={16} />
            </button>
            <h4 className="font-extrabold text-sm text-gray-900 pr-8">Comprobante de Pago Recibido</h4>
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
                Cerrar Vista
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
