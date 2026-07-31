import { Outlet, NavLink, Link } from 'react-router-dom';
import { Home, BookOpen, Users, Bell, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

export function UserLayout() {
  const { profile } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  return (
    <div className="h-screen max-h-screen bg-[#f0f4f8] text-[#1e293b] font-sans relative overflow-hidden flex flex-col items-center justify-between">
      
      {/* Soft Pastel Gradient Background Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-200/50 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-blue-200/50 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[60%] bg-pink-100/50 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Content Area */}
      <main className="w-full max-w-md flex-1 overflow-y-auto pt-8 pb-4 px-6 relative z-10 hide-scrollbar">
        {/* Top Header / Logo area */}
        <div className="flex justify-between items-center mb-8">
           <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
             Legacy Academy
           </h1>
           <Link to="/profile" className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center p-0.5 hover:scale-105 transition-transform overflow-hidden relative group">
             {profile?.avatar_url ? (
               <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-full" />
             ) : (
               <div className="w-full h-full bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                 {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
               </div>
             )}
           </Link>
        </div>

        <Outlet />
      </main>

      {/* Docked Bottom Navigation Bar */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl border-t border-gray-200/80 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-6 py-2 flex justify-between items-center relative z-50 pb-safe">
        <nav className="flex justify-between items-center w-full">
          <NavItem to="/dashboard" icon={<Home size={22} />} />
          <NavItem to="/courses" icon={<BookOpen size={22} />} />
          
          {/* Main Action Button (e.g. Comunidad) */}
          <NavLink to="/community" className={({isActive}) => `
            relative -top-5 w-14 h-14 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center text-white hover:scale-105 transition-transform shrink-0
            ${isActive ? 'ring-4 ring-blue-100' : ''}
          `}>
            <Users size={24} />
          </NavLink>
          
          
          <NavItem to="/notifications" icon={
            <div className="relative">
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center border-2 border-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          } />
          <NavItem to="/profile" icon={<User size={22} />} />
        </nav>
      </div>
    </div>
  );
}

function NavItem({ to, icon }: { to: string, icon: React.ReactNode }) {
  return (
    <NavLink 
      to={to} 
      className={({isActive}) => `
        flex flex-col items-center justify-center p-2 rounded-2xl transition-all
        ${isActive ? 'text-blue-600 bg-blue-50/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'}
      `}
    >
      {icon}
    </NavLink>
  );
}
