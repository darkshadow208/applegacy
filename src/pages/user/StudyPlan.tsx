import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Target, Calendar, CheckSquare, Flame, Clock, 
  TrendingUp, Play, Plus, Trash2, CheckCircle2, Bookmark,
  Award, Bell, Loader2
} from 'lucide-react';
import { notificationService } from '../../lib/notifications';
import { useStudyPlan } from '../../hooks/useStudyPlan';











const localMocks = [
  { id: '1', title: 'Masterclass en Estrategia Digital', description: 'Aprende a crear embudos.', image_url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800', course_categories: { name: 'Marketing Digital' } },
  { id: '2', title: 'Hábitos de Alta Productividad', description: 'Cómo organizar tu día.', image_url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800', course_categories: { name: 'Desarrollo Personal' } },
  { id: '3', title: 'De Cero a Criptoinversor', description: 'Entiende blockchain.', image_url: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?q=80&w=800', course_categories: { name: 'Inversiones' } },
  { id: '4', title: 'Gestión de Equipos Remotos', description: 'Lidera equipos a distancia.', image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800', course_categories: { name: 'Negocios' } },
  { id: '5', title: 'Psicología de Ventas', description: 'Vende más sin parecer vendedor.', image_url: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=800', course_categories: { name: 'Marketing' } },
  { id: '6', title: 'Bolsa de Valores para Novatos', description: 'Tu primera inversión.', image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800', course_categories: { name: 'Inversiones' } }
];

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export function StudyPlan() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'goals' | 'habits'>('dashboard');

  // Supabase courses - ¡CARGA INSTANTÁNEA (0ms) con mocks y sincronización en segundo plano!
  const [courses, setCourses] = useState<any[]>(localMocks);
  const [loadingCourses] = useState(false);

  // Backend backed state
  const {
    goals, setGoals,
    tasks, setTasks,
    habits, setHabits,
    profile: studyProfile, setProfile: setStudyProfile,
    courseConfigs, setCourseConfigs} = useStudyPlan(user?.id);

  const dailyTime = studyProfile?.daily_time_goal || 45;
  const setDailyTime = async (val: number) => {
    setStudyProfile({...studyProfile, daily_time_goal: val} as any);
    if (user) await supabase.from('student_study_profile').update({ daily_time_goal: val }).eq('user_id', user.id);
  };
  const schedule = studyProfile?.schedule_slots || [];
  const setSchedule = async (val: string[]) => {
    setStudyProfile({...studyProfile, schedule_slots: val} as any);
    if (user) await supabase.from('student_study_profile').update({ schedule_slots: val }).eq('user_id', user.id);
  };
  const remindersEnabled = studyProfile?.reminders_enabled ?? true;
  const setRemindersEnabled = async (val: boolean) => {
    setStudyProfile({...studyProfile, reminders_enabled: val} as any);
    if (user) await supabase.from('student_study_profile').update({ reminders_enabled: val }).eq('user_id', user.id);
  };
  
  const [newGoalText, setNewGoalText] = useState('');
  const [newGoalPeriod, setNewGoalPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [newTaskText, setNewTaskText] = useState('');
  const [newHabitText, setNewHabitText] = useState('');
  const reminderTimes = studyProfile?.reminder_times || ['09:00', '18:00'];
  const [newReminderTime, setNewReminderTime] = useState('18:00');
  const [selectedCourseToAdd, setSelectedCourseToAdd] = useState('');

  const awardXP = async (amount: number) => {
    if (!user) return;
    try {
      await supabase.rpc('add_user_xp', { p_user_id: user.id, p_amount: amount });
      const currentProfile = useAuthStore.getState().profile;
      if (currentProfile) {
        useAuthStore.setState({ profile: { ...currentProfile, xp: (currentProfile.xp || 0) + amount } });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Paginación para organizar cursos
  const [coursePage, setCoursePage] = useState(1);
  const coursesPerPage = 3;

  // Cargar cursos reales de Supabase en segundo plano (Background Sync) para evitar demoras
  useEffect(() => {
    async function fetchCourses() {
      try {
        const fetchPromise = supabase
          .from('courses')
          .select('id, title, description, image_url, course_categories(name)')
          .eq('is_active', true);

        // Limitar la espera a máximo 2.5 segundos para no colgar la UI si la red está lenta
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500));
        
        const { data } = await Promise.race([fetchPromise, timeoutPromise]) as any;

        if (data && data.length > 0) {
          // Fusionar cursos de la base de datos con los locales mock sin duplicados
          const merged = [...data];
          localMocks.forEach(m => {
            if (!merged.find(x => String(x.id) === String(m.id))) {
              merged.push(m);
            }
          });
          setCourses(merged);
        }
      } catch (err) {
        // En caso de lentitud o error, el usuario sigue teniendo la lista mock local instantánea
        console.warn('Sincronización de cursos en segundo plano pausada o en timeout. Usando caché local.');
      }
    }
    fetchCourses();
  }, []);

  

  // Guardar en Local Storage ante cualquier cambio
  const saveToStorage = (
    updatedConfigs = courseConfigs, 
    updatedGoals = goals, 
    updatedTasks = tasks, 
    updatedHabits = habits, 
    updatedTime = dailyTime, 
    updatedSchedule = schedule, 
    updatedReminders = remindersEnabled,
    updatedReminderTimes = reminderTimes
  ) => {
    if (!user) return;
    const storageKey = `study_plan_${user.id}`;
    localStorage.setItem(storageKey, JSON.stringify({
      courseConfigs: updatedConfigs,
      goals: updatedGoals,
      tasks: updatedTasks,
      habits: updatedHabits,
      dailyTime: updatedTime,
      schedule: updatedSchedule,
      remindersEnabled: updatedReminders,
      reminderTimes: updatedReminderTimes
    }));
  };

  // Real Local Reminders using Capacitor LocalNotifications
  useEffect(() => {
    if (remindersEnabled) {
      notificationService.scheduleDailyReminders(reminderTimes);
    } else {
      notificationService.scheduleDailyReminders([]);
    }
  }, [remindersEnabled, reminderTimes]);

  // Handlers para Cursos de Interés
  const handleAddCourseToPlan = async (courseId: string) => {
    if (!courseId) return;
    const newConfigs = { ...courseConfigs, [courseId]: { status: 'progress' as const, priority: 'medium' as const } };
    setCourseConfigs(newConfigs);
    setSelectedCourseToAdd('');
    if (user) {
      await supabase.from('course_student_configs').upsert({ user_id: user.id, course_id: courseId, status: 'progress', priority: 'medium' });
    }
  };

  const handleRemoveCourseFromPlan = async (courseId: string) => {
    const newConfigs = { ...courseConfigs };
    delete newConfigs[courseId];
    setCourseConfigs(newConfigs);
    const newTotalPages = Math.ceil(Object.keys(newConfigs).length / coursesPerPage);
    if (coursePage > newTotalPages) setCoursePage(Math.max(1, newTotalPages));
    if (user) {
      await supabase.from('course_student_configs').delete().eq('user_id', user.id).eq('course_id', courseId);
    }
  };

  const handleUpdateCourseStatus = async (courseId: string, status: 'pending' | 'progress' | 'completed') => {
    const newConfigs = { ...courseConfigs, [courseId]: { ...(courseConfigs[courseId] || { priority: 'medium' }), status } };
    setCourseConfigs(newConfigs);
    if (user) {
      await supabase.from('course_student_configs').upsert({ user_id: user.id, course_id: courseId, status, priority: newConfigs[courseId].priority });
    }
  };

  const handleUpdateCoursePriority = async (courseId: string, priority: 'high' | 'medium' | 'low') => {
    const newConfigs = { ...courseConfigs, [courseId]: { ...(courseConfigs[courseId] || { status: 'pending' }), priority } };
    setCourseConfigs(newConfigs);
    if (user) {
      await supabase.from('course_student_configs').upsert({ user_id: user.id, course_id: courseId, status: newConfigs[courseId].status, priority });
    }
  };

  // Handlers para Metas
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim() || !user) return;
    const newGoal = { id: generateId(), text: newGoalText.trim(), period: newGoalPeriod, completed: false };
    setGoals([...goals, newGoal as any]);
    setNewGoalText('');
    await supabase.from('study_goals').insert({ id: newGoal.id, user_id: user.id, text: newGoal.text, period: newGoal.period, completed: false });
  };

  const handleToggleGoal = async (id: string) => {
    const goal = goals.find(g => g.id === id);
    if (!goal || !user) return;
    const updatedCompleted = !goal.completed;
    setGoals(goals.map(g => g.id === id ? { ...g, completed: updatedCompleted } : g));
    await supabase.from('study_goals').update({ completed: updatedCompleted }).eq('id', id);
    if (updatedCompleted) awardXP(100);
  };

  const handleDeleteGoal = async (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
    await supabase.from('study_goals').delete().eq('id', id);
  };

  // Handlers para Sub-tareas de Metas
  const handleAddSubTask = (goalId: string, text: string) => {
    if (!text.trim()) return;
    const updated = goals.map(g => {
      if (g.id === goalId) {
        const subtasks = (g as any).subtasks || [];
        return {
          ...g,
          subtasks: [...subtasks, { id: generateId(), text: text.trim(), completed: false }]
        };
      }
      return g;
    });
    setGoals(updated);
    
  };

  const handleToggleSubTask = (goalId: string, subTaskId: string) => {
    const updated = goals.map(g => {
      if (g.id === goalId) {
        const subtasks = ((g as any).subtasks || []).map((s: any) => s.id === subTaskId ? { ...s, completed: !s.completed } : s);
        return { ...g, subtasks };
      }
      return g;
    });
    setGoals(updated);
    
  };

  const handleDeleteSubTask = (goalId: string, subTaskId: string) => {
    const updated = goals.map(g => {
      if (g.id === goalId) {
        const subtasks = ((g as any).subtasks || []).filter((s: any) => s.id !== subTaskId);
        return { ...g, subtasks };
      }
      return g;
    });
    setGoals(updated);
    
  };

  // Handlers para Tareas
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim() || !user) return;
    const newTask = { id: generateId(), text: newTaskText.trim(), completed: false };
    setTasks([...tasks, newTask]);
    setNewTaskText('');
    await supabase.from('study_tasks').insert({ id: newTask.id, user_id: user.id, text: newTask.text, completed: false });
  };

  const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const updatedCompleted = !task.completed;
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: updatedCompleted } : t));
    await supabase.from('study_tasks').update({ completed: updatedCompleted }).eq('id', id);
    if (updatedCompleted) awardXP(10);
  };

  const handleDeleteTask = async (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    await supabase.from('study_tasks').delete().eq('id', id);
  };

  // Handlers para Hábitos
  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitText.trim() || !user) return;
    const newHabit = { id: generateId(), name: newHabitText.trim(), streak: 0, completed_today: false };
    setHabits([...habits, newHabit as any]);
    setNewHabitText('');
    await supabase.from('study_habits').insert({ id: newHabit.id, user_id: user.id, name: newHabit.name, streak: 0, completed_today: false });
  };

  const handleToggleHabit = async (id: string) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    const today = new Date().toISOString().split('T')[0];
    const completed_today = !habit.completed_today && !habit.completed_today; // Handle both camelCase and snake_case from DB
    const newStreak = completed_today ? (habit.streak || 0) + 1 : Math.max(0, (habit.streak || 0) - 1);
    
    setHabits(habits.map(h => h.id === id ? { ...h, completed_today, streak: newStreak, last_completed_date: completed_today ? today : h.last_completed_date } : h));
    
    await supabase.from('study_habits').update({ completed_today: completed_today, streak: newStreak, last_completed_date: completed_today ? today : habit.last_completed_date }).eq('id', id);
    if (completed_today) awardXP(50);
  };

  const handleDeleteHabit = async (id: string) => {
    setHabits(habits.filter(h => h.id !== id));
    await supabase.from('study_habits').delete().eq('id', id);
  };

  const handleAddReminderTime = async () => {
    if (!newReminderTime) return;
    if (reminderTimes.includes(newReminderTime)) {
      alert('Esta hora de aviso ya está programada.');
      return;
    }
    const updated = [...reminderTimes, newReminderTime].sort();
    setStudyProfile({...studyProfile, reminder_times: updated} as any);
    if (user) await supabase.from('student_study_profile').update({ reminder_times: updated }).eq('user_id', user.id);
  };

  const handleDeleteReminderTime = async (time: string) => {
    const updated = reminderTimes.filter(t => t !== time);
    setStudyProfile({...studyProfile, reminder_times: updated} as any);
    if (user) await supabase.from('student_study_profile').update({ reminder_times: updated }).eq('user_id', user.id);
  };

  // Estadísticas calculadas basadas en cursos DE INTERÉS (tracked)
  const trackedCourses = courses.filter(c => courseConfigs[c.id] !== undefined);
  const totalCourses = trackedCourses.length;
  const inProgressCourses = Object.values(courseConfigs).filter(c => c.status === 'progress').length;
  const completedCourses = Object.values(courseConfigs).filter(c => c.status === 'completed').length;
  const completionRate = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

  // Cálculos de Paginación de cursos
  const totalCoursePages = Math.ceil(totalCourses / coursesPerPage);
  const currentCoursePage = Math.min(coursePage, Math.max(1, totalCoursePages));
  const startIndex = (currentCoursePage - 1) * coursesPerPage;
  const paginatedTrackedCourses = trackedCourses.slice(startIndex, startIndex + coursesPerPage);

  // Cursos filtrados
  const continueWatching = trackedCourses.filter(c => courseConfigs[c.id]?.status === 'progress');

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-24 text-gray-800">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 bg-white/60 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 hover:bg-white shadow-sm transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Plan de Estudio</h2>
            <p className="text-xs text-gray-500">Organización, Metas y Disciplina.</p>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas tipo Glassmorphism */}
      <div className="bg-white/50 backdrop-blur-md p-1 rounded-2xl flex border border-white/80 shadow-sm">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'dashboard' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <TrendingUp size={14} /> Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('goals')} 
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'goals' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Target size={14} /> Metas y Tareas
        </button>
        <button 
          onClick={() => setActiveTab('habits')} 
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'habits' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Flame size={14} /> Hábitos y Horario
        </button>
      </div>

      {/* PESTAÑA 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          
          {/* Panel de Estadísticas Visual */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-3xl p-5 text-white shadow-md flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">Progreso General</span>
                <Award size={18} />
              </div>
              <div>
                <h3 className="text-3xl font-extrabold">{completionRate}%</h3>
                <p className="text-[10px] text-blue-100 mt-1">Cursos finalizados con éxito</p>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Estudio Diario</span>
                <Clock className="text-indigo-500" size={18} />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-gray-900">{dailyTime}</span>
                  <span className="text-xs font-semibold text-gray-500">min</span>
                </div>
                <input 
                  type="range" 
                  min="15" 
                  max="180" 
                  step="15"
                  value={dailyTime} 
                  onChange={(e) => {
                    setDailyTime(Number(e.target.value));
                    saveToStorage(courseConfigs, goals, tasks, habits, Number(e.target.value));
                  }} 
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2" 
                />
              </div>
            </div>
          </div>

          {/* Estadísticas de Contadores */}
          <div className="grid grid-cols-3 gap-2 bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/80 shadow-sm text-center">
            <div>
              <p className="text-lg font-extrabold text-gray-900">{totalCourses}</p>
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Total Cursos</p>
            </div>
            <div className="border-x border-gray-100">
              <p className="text-lg font-extrabold text-blue-600">{inProgressCourses}</p>
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">En Curso</p>
            </div>
            <div>
              <p className="text-lg font-extrabold text-green-600">{completedCourses}</p>
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">Terminados</p>
            </div>
          </div>

          {/* Sección Continuar Viendo */}
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Continuar viendo</h3>
            {continueWatching.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm text-center flex flex-col items-center gap-2">
                <Bookmark size={24} className="text-gray-300" />
                <p className="text-xs text-gray-500">No tienes ningún curso en progreso activo.</p>
                <button onClick={() => navigate('/courses')} className="text-xs font-bold text-blue-600 hover:underline">Ir al catálogo →</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {continueWatching.map((course) => (
                  <div key={course.id} className="bg-white/85 backdrop-blur-md rounded-2xl p-3.5 border border-white/80 shadow-sm flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img src={course.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800'} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{course.title}</h4>
                        <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full mt-1 inline-block">En Progreso</span>
                      </div>
                    </div>
                    <button onClick={() => navigate(`/courses/${course.id}`)} className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow hover:bg-blue-700 transition-colors">
                      <Play size={14} fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configuración y Priorización de Cursos de Interés */}
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Organizar Cursos de Mi Interés</h3>
            
            {/* Selector Premium para Agregar Nuevo Curso al Plan */}
            <div className="bg-white/60 backdrop-blur-md rounded-3xl p-4 border border-white/80 shadow-sm mb-4">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">➕ Agregar Curso a Mi Plan de Estudio</label>
              <div className="flex gap-2">
                <select
                  value={selectedCourseToAdd}
                  onChange={(e) => setSelectedCourseToAdd(e.target.value)}
                  className="flex-1 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 text-gray-700 focus:outline-none"
                >
                  <option value="">-- Seleccionar curso para agregar --</option>
                  {courses
                    .filter(c => courseConfigs[c.id] === undefined)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                </select>
                <button
                  onClick={() => handleAddCourseToPlan(selectedCourseToAdd)}
                  disabled={!selectedCourseToAdd}
                  className="bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-black transition-colors disabled:opacity-50 shrink-0"
                >
                  Agregar
                </button>
              </div>
            </div>

            {loadingCourses ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : trackedCourses.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-sm text-center flex flex-col items-center gap-2">
                <Bookmark className="text-gray-300 animate-pulse" size={24} />
                <p className="text-xs text-gray-500">Aún no has agregado ningún curso de interés. Elige uno arriba para comenzar a organizarlo.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {paginatedTrackedCourses.map((course) => {
                  const config = courseConfigs[course.id] || { status: 'pending', priority: 'medium' };
                  return (
                    <div key={course.id} className="bg-white/60 backdrop-blur-md rounded-3xl p-4 border border-white/80 shadow-sm flex flex-col gap-3 transition-all hover:shadow-md">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{course.title}</h4>
                          <span className="text-[10px] text-gray-500">{course.course_categories?.name || 'Academia'}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveCourseFromPlan(course.id)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0"
                          title="Quitar de mi plan de estudio"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {/* Estado */}
                        <div>
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Estado</label>
                          <select 
                            value={config.status} 
                            onChange={(e) => handleUpdateCourseStatus(course.id, e.target.value as any)}
                            className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-700 focus:outline-none"
                          >
                            <option value="pending">Pendiente</option>
                            <option value="progress">En Progreso</option>
                            <option value="completed">Completado</option>
                          </select>
                        </div>

                        {/* Prioridad */}
                        <div>
                          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Prioridad</label>
                          <select 
                            value={config.priority} 
                            onChange={(e) => handleUpdateCoursePriority(course.id, e.target.value as any)}
                            className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-700 focus:outline-none"
                          >
                            <option value="low">Baja</option>
                            <option value="medium">Media</option>
                            <option value="high">Alta</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Controles de Paginación Premium */}
                {totalCoursePages > 1 && (
                  <div className="flex items-center justify-between bg-white/40 backdrop-blur-md rounded-2xl p-2 border border-white/60 shadow-sm mt-1">
                    <button
                      onClick={() => setCoursePage(prev => Math.max(1, prev - 1))}
                      disabled={currentCoursePage === 1}
                      className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-700 bg-white/80 border border-gray-150 hover:bg-white transition-colors disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span className="text-[11px] font-bold text-gray-500">
                      Página {currentCoursePage} de {totalCoursePages}
                    </span>
                    <button
                      onClick={() => setCoursePage(prev => Math.min(totalCoursePages, prev + 1))}
                      disabled={currentCoursePage === totalCoursePages}
                      className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-700 bg-white/80 border border-gray-150 hover:bg-white transition-colors disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recordatorios y Programación de Horas de Aviso */}
          <div className="bg-white/60 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Bell size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Recordatorios de Estudio</h4>
                  <p className="text-xs text-gray-500">Notificaciones de escritorio y audio</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setRemindersEnabled(!remindersEnabled);
                  
                }}
                className={`w-12 h-6 rounded-full p-1 transition-colors relative flex items-center ${
                  remindersEnabled ? 'bg-green-500 justify-end' : 'bg-gray-300 justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
              </button>
            </div>

            {remindersEnabled && (
              <div className="border-t border-gray-100 pt-3 flex flex-col gap-3">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">⏰ Programar Horas de Aviso</label>
                
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-gray-700"
                  />
                  <button
                    onClick={handleAddReminderTime}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0"
                  >
                    Añadir Hora
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-1">
                  {reminderTimes.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No hay horas programadas. ¡Añade una!</p>
                  ) : (
                    reminderTimes.map((time) => (
                      <span key={time} className="flex items-center gap-1.5 text-xs font-bold bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1 rounded-full">
                        {time}
                        <button
                          onClick={() => handleDeleteReminderTime(time)}
                          className="hover:text-red-500 transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* PESTAÑA 2: METAS Y OBJETIVOS */}
      {activeTab === 'goals' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          
          {/* Metas de Estudio */}
          <div className="flex flex-col gap-4 bg-white/60 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wider text-gray-500">
              <Target size={16} className="text-blue-600" /> Objetivos de Estudio
            </h3>
            
            <form onSubmit={handleAddGoal} className="flex gap-2">
              <input 
                type="text" 
                value={newGoalText}
                onChange={e => setNewGoalText(e.target.value)}
                placeholder="Ej: Terminar módulo 2..."
                className="flex-1 text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <select 
                value={newGoalPeriod} 
                onChange={e => setNewGoalPeriod(e.target.value as any)}
                className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-2 text-gray-700"
              >
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
              <button type="submit" className="bg-gray-900 text-white p-2 rounded-xl hover:bg-black transition-colors shrink-0">
                <Plus size={16} />
              </button>
            </form>

            <div className="flex flex-col gap-3 mt-2">
              {goals.map(g => {
                const subtasks = (g as any).subtasks || [];
                const completedSubCount = subtasks.filter((s: any) => s.completed).length;
                const totalSubCount = subtasks.length;
                
                return (
                  <div key={g.id} className="flex flex-col gap-3.5 p-4 bg-gray-50/50 border border-gray-100 rounded-3xl hover:bg-white transition-all shadow-sm">
                    {/* Fila Principal de la Meta */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button onClick={() => handleToggleGoal(g.id)} className="text-gray-400 hover:text-blue-600 shrink-0">
                          {g.completed ? <CheckCircle2 size={18} className="text-blue-600 font-bold" /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300"></div>}
                        </button>
                        <span className={`text-xs font-bold text-gray-800 truncate ${g.completed ? 'line-through text-gray-400' : ''}`}>
                          {g.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          g.period === 'weekly' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {g.period === 'weekly' ? 'Semanal' : 'Mensual'}
                        </span>
                        <button onClick={() => handleDeleteGoal(g.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Sección de Sub-tareas de esta Meta */}
                    <div className="pl-6 border-l-2 border-gray-100 flex flex-col gap-2.5">
                      {/* Título de Subtareas e Indicador de Progreso */}
                      {totalSubCount > 0 && (
                        <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold">
                          <span>SUB-TAREAS ({completedSubCount}/{totalSubCount})</span>
                          <span className="text-blue-500">{Math.round((completedSubCount / totalSubCount) * 100)}%</span>
                        </div>
                      )}

                      {/* Lista de Subtareas */}
                      {subtasks.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <button onClick={() => handleToggleSubTask(g.id, s.id)} className="text-gray-400 hover:text-blue-500 shrink-0">
                              {s.completed ? <CheckSquare size={15} className="text-blue-500" /> : <div className="w-[14px] h-[14px] rounded border border-gray-300"></div>}
                            </button>
                            <span className={`text-xs text-gray-600 truncate ${s.completed ? 'line-through text-gray-400' : ''}`}>
                              {s.text}
                            </span>
                          </div>
                          <button onClick={() => handleDeleteSubTask(g.id, s.id)} className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors shrink-0">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}

                      {/* Inline Form para agregar sub-tarea */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const input = (e.target as any).elements.subTaskText;
                          handleAddSubTask(g.id, input.value);
                          input.value = '';
                        }}
                        className="flex gap-1.5 mt-1"
                      >
                        <input
                          name="subTaskText"
                          type="text"
                          placeholder="➕ Añadir sub-tarea..."
                          className="flex-1 text-[11px] px-2.5 py-1 bg-gray-50/50 border border-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/30 text-gray-700"
                        />
                        <button type="submit" className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors">
                          Añadir
                        </button>
                      </form>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Lista de Tareas Pendientes */}
          <div className="flex flex-col gap-4 bg-white/60 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wider text-gray-500">
              <CheckSquare size={16} className="text-indigo-600" /> Lista de Tareas de Hoy
            </h3>
            
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input 
                type="text" 
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                placeholder="Nueva tarea de estudio..."
                className="flex-1 text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button type="submit" className="bg-gray-900 text-white p-2 rounded-xl hover:bg-black transition-colors shrink-0">
                <Plus size={16} />
              </button>
            </form>

            <div className="flex flex-col gap-2 mt-2">
              {tasks.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No tienes tareas para hoy. ¡Añade una!</p>
              ) : (
                tasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50/50 border border-gray-100 rounded-xl hover:bg-white transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button onClick={() => handleToggleTask(t.id)} className="text-gray-400 hover:text-indigo-600 shrink-0">
                        {t.completed ? <CheckCircle2 size={18} className="text-indigo-600" /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300"></div>}
                      </button>
                      <span className={`text-xs text-gray-800 truncate ${t.completed ? 'line-through text-gray-400' : ''}`}>
                        {t.text}
                      </span>
                    </div>
                    <button onClick={() => handleDeleteTask(t.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-lg shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* PESTAÑA 3: HÁBITOS Y CALENDARIO */}
      {activeTab === 'habits' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          
          {/* Sistema de Disciplina y Hábitos */}
          <div className="flex flex-col gap-4 bg-white/60 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wider text-gray-500">
                <Flame size={16} className="text-orange-500" /> Sistema de Disciplina
              </h3>
            </div>
            
            <form onSubmit={handleAddHabit} className="flex gap-2">
              <input 
                type="text" 
                value={newHabitText}
                onChange={e => setNewHabitText(e.target.value)}
                placeholder="Crear hábito (Ej: Leer 10 pág)..."
                className="flex-1 text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <button type="submit" className="bg-gray-900 text-white p-2 rounded-xl hover:bg-black transition-colors shrink-0">
                <Plus size={16} />
              </button>
            </form>

            <div className="flex flex-col gap-3 mt-2">
              {habits.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No hay hábitos creados. ¡Empieza tu racha!</p>
              ) : (
                habits.map(h => (
                  <div key={h.id} className="bg-gray-50/50 border border-gray-100 rounded-xl p-3 flex justify-between items-center hover:bg-white transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button 
                        onClick={() => handleToggleHabit(h.id)} 
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          h.completed_today ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400 border border-gray-200'
                        }`}
                      >
                        {h.completed_today ? <Flame size={16} fill="currentColor" /> : <Flame size={16} />}
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{h.name}</p>
                        <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5"><Flame size={10} className="text-orange-500" /> Racha de {h.streak} días</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteHabit(h.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-lg shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Calendario / Horarios de Estudio */}
          <div className="flex flex-col gap-4 bg-white/60 backdrop-blur-md rounded-3xl p-5 border border-white/80 shadow-sm">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm uppercase tracking-wider text-gray-500">
              <Calendar size={16} className="text-purple-600" /> Horarios de Estudio
            </h3>

            <p className="text-xs text-gray-500 leading-relaxed">
              Elige tus bloques fijos para forjar consistencia semanal.
            </p>

            <div className="flex flex-col gap-2 mt-1">
              {['Lunes 18:00', 'Miércoles 20:00', 'Viernes 18:00', 'Sábado 10:00'].map((slot) => {
                const isSelected = schedule.includes(slot);
                return (
                  <button
                    key={slot}
                    onClick={() => {
                      let updated;
                      if (isSelected) {
                        updated = schedule.filter((s: any) => s !== slot);
                      } else {
                        updated = [...schedule, slot];
                      }
                      setSchedule(updated);
                      
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all ${
                      isSelected 
                        ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm' 
                        : 'border-gray-100 bg-gray-50/50 text-gray-500 hover:bg-white'
                    }`}
                  >
                    <span>{slot}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider">{isSelected ? 'Bloque de estudio' : 'Reservar'}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
