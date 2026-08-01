import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { Loader2, TrendingUp, Users, CheckCircle } from 'lucide-react';

export function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalContributions: 0
  });
  
  const [userGrowth, setUserGrowth] = useState<any[]>([]);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        // Fetch users
        const { data: users, error: usersErr } = await supabase.from('users_profiles').select('created_at, status');
        if (!usersErr && users) {
          setStats(s => ({ ...s, totalUsers: users.length }));
          
          // Group by month for chart
          const growthMap: Record<string, number> = {};
          users.forEach(u => {
            const date = new Date(u.created_at);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            growthMap[monthYear] = (growthMap[monthYear] || 0) + 1;
          });
          
          const growthData = Object.entries(growthMap)
            .map(([month, count]) => ({ name: month, Nuevos: count }))
            .sort((a, b) => a.name.localeCompare(b.name));
            
          setUserGrowth(growthData);
        }

        // Fetch subscriptions
        const { data: subs, error: subsErr } = await supabase.from('subscriptions').select('status');
        if (!subsErr && subs) {
          const active = subs.filter(s => s.status === 'active').length;
          setStats(s => ({ ...s, activeSubscriptions: active }));
        }

        // Fetch contributions
        const { data: conts, error: contsErr } = await supabase.from('user_contributions').select('status');
        if (!contsErr && conts) {
          const approved = conts.filter(c => c.status === 'approved').length;
          setStats(s => ({ ...s, totalContributions: approved }));
        }
      } catch (err) {
        console.error('Error loading analytics', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-indigo-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-indigo-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Usuarios Totales</span>
            <Users size={18} />
          </div>
          <p className="text-3xl font-black text-gray-900 mt-2">{stats.totalUsers}</p>
        </div>
        
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-green-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-green-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Suscripciones Activas</span>
            <CheckCircle size={18} />
          </div>
          <p className="text-3xl font-black text-gray-900 mt-2">{stats.activeSubscriptions}</p>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-purple-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-purple-600">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Aportes Aprobados</span>
            <TrendingUp size={18} />
          </div>
          <p className="text-3xl font-black text-gray-900 mt-2">{stats.totalContributions}</p>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm">
        <h3 className="font-extrabold text-sm text-gray-900 mb-6">Crecimiento de Usuarios Nuevos</h3>
        <div className="h-64 w-full">
          {userGrowth.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="Nuevos" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-400 font-bold">Sin datos suficientes</div>
          )}
        </div>
      </div>
    </div>
  );
}
