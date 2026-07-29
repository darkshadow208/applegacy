import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthLayout } from './layouts/AuthLayout';
import { UserLayout } from './layouts/UserLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { PendingApproval } from './pages/auth/PendingApproval';
import { Dashboard } from './pages/user/Dashboard';
import { Courses } from './pages/user/Courses';
import { CourseDetail } from './pages/user/CourseDetail';
import { Profile } from './pages/user/Profile';
import { Bonuses } from './pages/user/Bonuses';
import { Notifications } from './pages/user/Notifications';
import { Subscription } from './pages/user/Subscription';
import { Community } from './pages/user/Community';
import { Contribute } from './pages/user/Contribute';
import { Support } from './pages/user/Support';
import { Favorites } from './pages/user/Favorites';
import { StudyPlan } from './pages/user/StudyPlan';
import { Blog } from './pages/user/Blog';
import { useAuthStore } from './store/authStore';
import { notificationService } from './lib/notifications';
import { supabase } from './lib/supabase';
import logoImg from './assets/logo.png';

// Route protector wrapper
// ... ProtectedRoute logic ...
// (This is just for context, targetContent covers from line 23 to 81)
function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { session, profile, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 animate-fade-in">
        {/* Contenedor del Logo con animación de respiración/pulso y brillo premium */}
        <div className="relative">
          <div className="absolute -inset-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur-2xl opacity-60 animate-pulse"></div>
          <div className="relative bg-slate-900 p-6 rounded-full border border-white/10 shadow-2xl flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28">
            <img 
              src={logoImg} 
              alt="Legacy Academy Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain animate-pulse duration-1000"
            />
          </div>
        </div>

        {/* Spinner animado y texto premium */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-4 py-2.5 rounded-full backdrop-blur-md shadow-sm">
            <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">
              Cargando Legacy Academy
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (profile?.status === 'pending' && location.pathname !== '/auth/pending') {
    return <Navigate to="/auth/pending" replace />;
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { initialize, session, profile } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (session?.user && profile) {
      // 1. Check expiration notifications
      notificationService.checkAndScheduleExpirationNotifications(session.user.id, profile.role);

      // 2. Fetch unread notifications from DB and show them as local notifications if they haven't been notified yet
      const syncDbNotificationsToMobile = async () => {
        try {
          const { data: unreadNotifications, error } = await supabase
            .from('notifications')
            .select('*')
            .or(`user_id.eq.${session.user.id},user_id.is.null`)
            .eq('is_read', false);

          if (error) throw error;

          if (unreadNotifications && unreadNotifications.length > 0) {
            const notifiedIdsKey = `notified_notification_ids_${session.user.id}`;
            const notifiedIdsSaved = localStorage.getItem(notifiedIdsKey) || '[]';
            const notifiedIds: string[] = JSON.parse(notifiedIdsSaved);
            const newNotifiedIds = [...notifiedIds];
            let changed = false;

            for (const notif of unreadNotifications) {
              if (!notifiedIds.includes(notif.id)) {
                // Schedule local notification immediately on the phone
                await notificationService.schedule(
                  notif.title, 
                  notif.message, 
                  new Date(notif.created_at).getTime() % 1000000
                );
                newNotifiedIds.push(notif.id);
                changed = true;
              }
            }

            if (changed) {
              localStorage.setItem(notifiedIdsKey, JSON.stringify(newNotifiedIds));
            }
          }
        } catch (err) {
          console.error('Error syncing db notifications to mobile:', err);
        }
      };

      syncDbNotificationsToMobile();

      // 3. Realtime subscription for new notifications
      const channel = supabase
        .channel(`notifications-realtime-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications'
          },
          async (payload) => {
            const newNotif = payload.new;
            // Filter if it's for this user or global
            if (newNotif && (newNotif.user_id === null || newNotif.user_id === session.user.id)) {
              const notifiedIdsKey = `notified_notification_ids_${session.user.id}`;
              const notifiedIdsSaved = localStorage.getItem(notifiedIdsKey) || '[]';
              const notifiedIds: string[] = JSON.parse(notifiedIdsSaved);

              if (!notifiedIds.includes(newNotif.id)) {
                // Schedule local notification immediately
                await notificationService.schedule(newNotif.title, newNotif.message);
                
                // Add to notified local storage
                notifiedIds.push(newNotif.id);
                localStorage.setItem(notifiedIdsKey, JSON.stringify(notifiedIds));
              }
            }
          }
        )
        .subscribe();

      // Clean up subscription on unmount or session change
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session, profile]);

  return (
    <Router>
      <div className="min-h-screen font-sans">
        <Routes>
          <Route path="/auth" element={<AuthLayout />}>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="pending" element={<PendingApproval />} />
            <Route index element={<Navigate to="/auth/login" replace />} />
          </Route>

          <Route path="/" element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="courses" element={<Courses />} />
            <Route path="courses/:id" element={<CourseDetail />} />
            <Route path="community" element={<Community />} />
            <Route path="contribute" element={<Contribute />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="subscription" element={<Subscription />} />
            <Route path="support" element={<Support />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="study-plan" element={<StudyPlan />} />
            <Route path="bonuses" element={<Bonuses />} />
             <Route path="blog" element={<Blog />} />
            <Route index element={<Navigate to="/dashboard" replace />} />
          </Route>

          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
