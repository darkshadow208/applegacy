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

interface CourseConfig {
  status: 'pending' | 'progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

interface Goal {
  id: string;
  text: string;
  period: 'weekly' | 'monthly';
  completed: boolean;
  subtasks?: SubTask[];
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

interface Habit {
  id: string;
  name: string;
  streak: number;
  completedToday: boolean;
  lastCompletedDate?: string;
}

const localMocks = [
  { id: '1', title: 'Masterclass en Estrategia Digital', description: 'Aprende a crear embudos.', image_url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800', course_categories: { name: 'Marketing Digital' } },
  { id: '2', title: 'Hábitos de Alta Productividad', description: 'Cómo organizar tu día.', image_url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800', course_categories: { name: 'Desarrollo Personal' } },
  { id: '3', title: 'De Cero a Criptoinversor', description: 'Entiende blockchain.', image_url: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?q=80&w=800', course_categories: { name: 'Inversiones' } },
  { id: '4', title: 'Gestión de Equipos Remotos', description: 'Lidera equipos a distancia.', image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800', course_categories: { name: 'Negocios' } },
  { id: '5', title: 'Psicología de Ventas', description: 'Vende más sin parecer vendedor.', image_url: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=800', course_categories: { name: 'Marketing' } },
  { id: '6', title: 'Bolsa de Valores para Novatos', description: 'Tu primera inversión.', image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=800', course_categories: { name: 'Inversiones' } }
];

export function StudyPlan() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'goals' | 'habits'>('dashboard');

  // Supabase courses - ¡CARGA INSTANTÁNEA (0ms) con mocks y sincronización en segundo plano!
  const [courses, setCourses] = useState<any[]>(localMocks);
  const [loadingCourses] = useState(false);

  // Local storage backed state
  const [courseConfigs, setCourseConfigs] = useState<Record<string, CourseConfig>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [dailyTime, setDailyTime] = useState<number>(45); // minutos
  const [schedule, setSchedule] = useState<string[]>(['Lunes 18:00', 'Miércoles 20:00', 'Viernes 18:00']);
  const [newGoalText, setNewGoalText] = useState('');
  const [newGoalPeriod, setNewGoalPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [newTaskText, setNewTaskText] = useState('');
  const [newHabitText, setNewHabitText] = useState('');

  // Notificaciones locales simulation state
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderTimes, setReminderTimes] = useState<string[]>(['09:00', '18:00']);
  const [newReminderTime, setNewReminderTime] = useState('18:00');
  const [selectedCourseToAdd, setSelectedCourseToAdd] = useState('');
  
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

  // Cargar datos persistidos de Local Storage
  useEffect(() => {
    if (!user) return;
    const storageKey = `study_plan_${user.id}`;
    const saved = localStorage.getItem(storageKey);
    let loadedHabits: Habit[] = [];
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.courseConfigs) setCourseConfigs(parsed.courseConfigs);
        if (parsed.goals) setGoals(parsed.goals);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.dailyTime) setDailyTime(parsed.dailyTime);
        if (parsed.schedule) setSchedule(parsed.schedule);
        if (parsed.remindersEnabled !== undefined) setRemindersEnabled(parsed.remindersEnabled);
        if (parsed.reminderTimes) setReminderTimes(parsed.reminderTimes);
        
        loadedHabits = parsed.habits || [];
      } catch (e) {
        console.error('Error parsing study plan storage:', e);
      }
    } else {
      // Semillas iniciales por defecto para mostrar algo hermoso al usuario
      setGoals([
        { id: 'g1', text: 'Completar el módulo 3 de Estrategia Digital', period: 'weekly', completed: false, subtasks: [{ id: 's1', text: 'Ver videos teóricos', completed: false }, { id: 's2', text: 'Resolver cuestionario', completed: true }] },
        { id: 'g2', text: 'Estudiar 5 horas de desarrollo personal', period: 'monthly', completed: true, subtasks: [] }
      ]);
      setTasks([
        { id: 't1', text: 'Revisar apuntes de Facebook Ads', completed: false },
        { id: 't2', text: 'Ver video introductorio de Cripto', completed: true }
      ]);
      const initialHabits: Habit[] = [
        { id: 'h1', name: 'Estudiar 30 min diarios', streak: 4, completedToday: false },
        { id: 'h2', name: 'Tomar notas activas', streak: 2, completedToday: true, lastCompletedDate: new Date().toISOString().split('T')[0] }
      ];
      loadedHabits = initialHabits;
      
      setReminderTimes(['09:00', '18:00']);
      // Configurar Masterclass y Hábitos como en curso por defecto para que no salga vacío
      setCourseConfigs({
        '1': { status: 'progress', priority: 'medium' },
        '2': { status: 'pending', priority: 'medium' },
        '3': { status: 'pending', priority: 'medium' }
      });
    }

    // Process habits for 24h reset
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterday = yesterdayDate.toISOString().split('T')[0];
    
    let habitsChanged = false;
    const processedHabits = loadedHabits.map((h: Habit) => {
      if (!h.lastCompletedDate) return h;
      
      // If it's a new day and it was completed previously, reset completedToday
      if (h.lastCompletedDate !== today && h.completedToday) {
        habitsChanged = true;
        // If last completed was older than yesterday, streak is broken
        const isOlderThanYesterday = h.lastCompletedDate < yesterday;
        return {
          ...h,
          completedToday: false,
          streak: isOlderThanYesterday ? 0 : h.streak
        };
      }

      // If it wasn't completed today, and the last time it was completed was before yesterday, streak is broken
      if (!h.completedToday && h.lastCompletedDate < yesterday && h.streak > 0) {
        habitsChanged = true;
        return { ...h, streak: 0 };
      }

      return h;
    });

    setHabits(processedHabits);

    // Initial save if we just created defaults or updated habits
    if (!saved || habitsChanged) {
      setTimeout(() => {
        saveToStorage(undefined, undefined, undefined, processedHabits);
      }, 500);
    }
  }, [user]);

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
  const handleAddCourseToPlan = (courseId: string) => {
    if (!courseId) return;
    const newConfigs = {
      ...courseConfigs,
      [courseId]: {
        status: 'progress' as const, // entra como En Progreso por defecto
        priority: 'medium' as const
      }
    };
    setCourseConfigs(newConfigs);
    saveToStorage(newConfigs);
    setSelectedCourseToAdd('');
  };

  const handleRemoveCourseFromPlan = (courseId: string) => {
    const newConfigs = { ...courseConfigs };
    delete newConfigs[courseId];
    setCourseConfigs(newConfigs);
    saveToStorage(newConfigs);
    
    // Ajustar página activa si queda vacía
    const newTotal = Object.keys(newConfigs).length;
    const newTotalPages = Math.ceil(newTotal / coursesPerPage);
    if (coursePage > newTotalPages) {
      setCoursePage(Math.max(1, newTotalPages));
    }
  };

  const handleUpdateCourseStatus = (courseId: string, status: 'pending' | 'progress' | 'completed') => {
    const newConfigs = {
      ...courseConfigs,
      [courseId]: {
        ...(courseConfigs[courseId] || { priority: 'medium' }),
        status
      }
    };
    setCourseConfigs(newConfigs);
    saveToStorage(newConfigs);
  };

  const handleUpdateCoursePriority = (courseId: string, priority: 'high' | 'medium' | 'low') => {
    const newConfigs = {
      ...courseConfigs,
      [courseId]: {
        ...(courseConfigs[courseId] || { status: 'pending' }),
        priority
      }
    };
    setCourseConfigs(newConfigs);
    saveToStorage(newConfigs);
  };

  // Handlers para Metas
  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    const newGoal: Goal = {
      id: Date.now().toString(),
      text: newGoalText.trim(),
      period: newGoalPeriod,
      completed: false,
      subtasks: []
    };
    const updated = [...goals, newGoal];
    setGoals(updated);
    setNewGoalText('');
    saveToStorage(courseConfigs, updated);
  };

  const handleToggleGoal = (id: string) => {
    const updated = goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
    setGoals(updated);
    saveToStorage(courseConfigs, updated);
  };

  const handleDeleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    saveToStorage(courseConfigs, updated);
  };

  // Handlers para Sub-tareas de Metas
  const handleAddSubTask = (goalId: string, text: string) => {
    if (!text.trim()) return;
    const updated = goals.map(g => {
      if (g.id === goalId) {
        const subtasks = g.subtasks || [];
        return {
          ...g,
          subtasks: [...subtasks, { id: Date.now().toString(), text: text.trim(), completed: false }]
        };
      }
      return g;
    });
    setGoals(updated);
    saveToStorage(courseConfigs, updated);
  };

  const handleToggleSubTask = (goalId: string, subTaskId: string) => {
    const updated = goals.map(g => {
      if (g.id === goalId) {
        const subtasks = (g.subtasks || []).map(s => s.id === subTaskId ? { ...s, completed: !s.completed } : s);
        return { ...g, subtasks };
      }
      return g;
    });
    setGoals(updated);
    saveToStorage(courseConfigs, updated);
  };

  const handleDeleteSubTask = (goalId: string, subTaskId: string) => {
    const updated = goals.map(g => {
      if (g.id === goalId) {
        const subtasks = (g.subtasks || []).filter(s => s.id !== subTaskId);
        return { ...g, subtasks };
      }
      return g;
    });
    setGoals(updated);
    saveToStorage(courseConfigs, updated);
  };

  // Handlers para Tareas
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      completed: false
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    setNewTaskText('');
    saveToStorage(courseConfigs, goals, updated);
  };

  const handleToggleTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(updated);
    saveToStorage(courseConfigs, goals, updated);
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    saveToStorage(courseConfigs, goals, updated);
  };

  // Handlers para Hábitos
  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitText.trim()) return;
    const newHabit: Habit = {
      id: Date.now().toString(),
      name: newHabitText.trim(),
      streak: 0,
      completedToday: false
    };
    const updated = [...habits, newHabit];
    setHabits(updated);
    setNewHabitText('');
    saveToStorage(courseConfigs, goals, tasks, updated);
  };

  const handleToggleHabit = (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = habits.map(h => {
      if (h.id === id) {
        const completedToday = !h.completedToday;
        return {
          ...h,
          completedToday,
          streak: completedToday ? h.streak + 1 : Math.max(0, h.streak - 1),
          lastCompletedDate: completedToday ? today : h.lastCompletedDate
        };
      }
      return h;
    });
    setHabits(updated);
    saveToStorage(courseConfigs, goals, tasks, updated);
  };

  const handleDeleteHabit = (id: string) => {
    const updated = habits.filter(h => h.id !== id);
    setHabits(updated);
    saveToStorage(courseConfigs, goals, tasks, updated);
  };

  const handleAddReminderTime = () => {
    if (!newReminderTime) return;
    if (reminderTimes.includes(newReminderTime)) {
      alert('Esta hora de aviso ya está programada.');
      return;
    }
    const updated = [...reminderTimes, newReminderTime].sort();
    setReminderTimes(updated);
    saveToStorage(courseConfigs, goals, tasks, habits, dailyTime, schedule, remindersEnabled, updated);
  };

  const handleDeleteReminderTime = (time: string) => {
    const updated = reminderTimes.filter(t => t !== time);
    setReminderTimes(updated);
    saveToStorage(courseConfigs, goals, tasks, habits, dailyTime, schedule, remindersEnabled, updated);
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
                  saveToStorage(courseConfigs, goals, tasks, habits, dailyTime, schedule, !remindersEnabled);
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
                const subtasks = g.subtasks || [];
                const completedSubCount = subtasks.filter(s => s.completed).length;
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
                      {subtasks.map(s => (
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
                          h.completedToday ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400 border border-gray-200'
                        }`}
                      >
                        {h.completedToday ? <Flame size={16} fill="currentColor" /> : <Flame size={16} />}
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
                        updated = schedule.filter(s => s !== slot);
                      } else {
                        updated = [...schedule, slot];
                      }
                      setSchedule(updated);
                      saveToStorage(courseConfigs, goals, tasks, habits, dailyTime, updated);
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
