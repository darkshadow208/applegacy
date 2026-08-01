const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'user', 'StudyPlan.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add useStudyPlan import
content = content.replace(
  "import { notificationService } from '../../lib/notifications';",
  "import { notificationService } from '../../lib/notifications';\nimport { useStudyPlan } from '../../hooks/useStudyPlan';"
);

// 2. Replace the massive state declaration block
const stateRegex = /\/\/ Local storage backed state[\s\S]*?\/\/ Paginación para organizar cursos/m;
const newState = `// Backend backed state
  const {
    goals, setGoals,
    tasks, setTasks,
    habits, setHabits,
    profile: studyProfile, setProfile: setStudyProfile,
    courseConfigs, setCourseConfigs,
    loading: loadingPlan
  } = useStudyPlan(user?.id);

  const dailyTime = studyProfile.daily_time_goal || 45;
  const schedule = studyProfile.schedule_slots || [];
  const remindersEnabled = studyProfile.reminders_enabled ?? true;
  
  const [newGoalText, setNewGoalText] = useState('');
  const [newGoalPeriod, setNewGoalPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [newTaskText, setNewTaskText] = useState('');
  const [newHabitText, setNewHabitText] = useState('');
  const [reminderTimes, setReminderTimes] = useState<string[]>(['09:00', '18:00']);
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

  // Paginación para organizar cursos`;
content = content.replace(stateRegex, newState);

// 3. Remove the localStorage load effect
const loadEffectRegex = /\/\/ Cargar datos persistidos de Local Storage[\s\S]*?saveToStorage\(undefined, undefined, undefined, processedHabits\);\n      \}, 500\);\n    \}\n  \}, \[user\]\);/m;
content = content.replace(loadEffectRegex, '');

// 4. Replace saveToStorage function
const saveToStorageRegex = /\/\/ Guardar en Local Storage ante cualquier cambio[\s\S]*?\}\);\n  \};/m;
const newSaveToStorage = `// Dummy saveToStorage to prevent errors, actual saves happen per action
  const saveToStorage = () => {};`;
content = content.replace(saveToStorageRegex, newSaveToStorage);

// 5. Update Handlers to use Supabase
content = content.replace(
  /const handleAddCourseToPlan = \(courseId: string\) => \{[\s\S]*?setSelectedCourseToAdd\(''\);\n  \};/,
  `const handleAddCourseToPlan = async (courseId: string) => {
    if (!courseId) return;
    const newConfigs = { ...courseConfigs, [courseId]: { status: 'progress' as const, priority: 'medium' as const } };
    setCourseConfigs(newConfigs);
    setSelectedCourseToAdd('');
    if (user) {
      await supabase.from('course_student_configs').upsert({ user_id: user.id, course_id: courseId, status: 'progress', priority: 'medium' });
    }
  };`
);

content = content.replace(
  /const handleRemoveCourseFromPlan = \(courseId: string\) => \{[\s\S]*?\}\n  \};/,
  `const handleRemoveCourseFromPlan = async (courseId: string) => {
    const newConfigs = { ...courseConfigs };
    delete newConfigs[courseId];
    setCourseConfigs(newConfigs);
    const newTotalPages = Math.ceil(Object.keys(newConfigs).length / coursesPerPage);
    if (coursePage > newTotalPages) setCoursePage(Math.max(1, newTotalPages));
    if (user) {
      await supabase.from('course_student_configs').delete().eq('user_id', user.id).eq('course_id', courseId);
    }
  };`
);

content = content.replace(
  /const handleUpdateCourseStatus = \(courseId: string, status: 'pending' \| 'progress' \| 'completed'\) => \{[\s\S]*?saveToStorage\(newConfigs\);\n  \};/,
  `const handleUpdateCourseStatus = async (courseId: string, status: 'pending' | 'progress' | 'completed') => {
    const newConfigs = { ...courseConfigs, [courseId]: { ...(courseConfigs[courseId] || { priority: 'medium' }), status } };
    setCourseConfigs(newConfigs);
    if (user) {
      await supabase.from('course_student_configs').upsert({ user_id: user.id, course_id: courseId, status, priority: newConfigs[courseId].priority });
    }
  };`
);

content = content.replace(
  /const handleUpdateCoursePriority = \(courseId: string, priority: 'high' \| 'medium' \| 'low'\) => \{[\s\S]*?saveToStorage\(newConfigs\);\n  \};/,
  `const handleUpdateCoursePriority = async (courseId: string, priority: 'high' | 'medium' | 'low') => {
    const newConfigs = { ...courseConfigs, [courseId]: { ...(courseConfigs[courseId] || { status: 'pending' }), priority } };
    setCourseConfigs(newConfigs);
    if (user) {
      await supabase.from('course_student_configs').upsert({ user_id: user.id, course_id: courseId, status: newConfigs[courseId].status, priority });
    }
  };`
);

content = content.replace(
  /const handleAddGoal = \(e: React.FormEvent\) => \{[\s\S]*?saveToStorage\(courseConfigs, updated\);\n  \};/,
  `const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim() || !user) return;
    const newGoal = { id: Date.now().toString(), text: newGoalText.trim(), period: newGoalPeriod, completed: false, subtasks: [] };
    setGoals([...goals, newGoal as any]);
    setNewGoalText('');
    await supabase.from('study_goals').insert({ id: newGoal.id, user_id: user.id, text: newGoal.text, period: newGoal.period, completed: false, subtasks: [] });
  };`
);

content = content.replace(
  /const handleToggleGoal = \(id: string\) => \{[\s\S]*?saveToStorage\(courseConfigs, updated\);\n  \};/,
  `const handleToggleGoal = async (id: string) => {
    const goal = goals.find(g => g.id === id);
    if (!goal || !user) return;
    const updatedCompleted = !goal.completed;
    setGoals(goals.map(g => g.id === id ? { ...g, completed: updatedCompleted } : g));
    await supabase.from('study_goals').update({ completed: updatedCompleted }).eq('id', id);
    if (updatedCompleted) awardXP(100);
  };`
);

content = content.replace(
  /const handleDeleteGoal = \(id: string\) => \{[\s\S]*?saveToStorage\(courseConfigs, updated\);\n  \};/,
  `const handleDeleteGoal = async (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
    await supabase.from('study_goals').delete().eq('id', id);
  };`
);

content = content.replace(
  /const handleAddTask = \(e: React.FormEvent\) => \{[\s\S]*?saveToStorage\(courseConfigs, goals, updated\);\n  \};/,
  `const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim() || !user) return;
    const newTask = { id: Date.now().toString(), text: newTaskText.trim(), completed: false };
    setTasks([...tasks, newTask]);
    setNewTaskText('');
    await supabase.from('study_tasks').insert({ id: newTask.id, user_id: user.id, text: newTask.text, completed: false });
  };`
);

content = content.replace(
  /const handleToggleTask = \(id: string\) => \{[\s\S]*?saveToStorage\(courseConfigs, goals, updated\);\n  \};/,
  `const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const updatedCompleted = !task.completed;
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: updatedCompleted } : t));
    await supabase.from('study_tasks').update({ completed: updatedCompleted }).eq('id', id);
    if (updatedCompleted) awardXP(10);
  };`
);

content = content.replace(
  /const handleDeleteTask = \(id: string\) => \{[\s\S]*?saveToStorage\(courseConfigs, goals, updated\);\n  \};/,
  `const handleDeleteTask = async (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
    await supabase.from('study_tasks').delete().eq('id', id);
  };`
);

content = content.replace(
  /const handleAddHabit = \(e: React.FormEvent\) => \{[\s\S]*?saveToStorage\(courseConfigs, goals, tasks, updated\);\n  \};/,
  `const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitText.trim() || !user) return;
    const newHabit = { id: Date.now().toString(), name: newHabitText.trim(), streak: 0, completedToday: false };
    setHabits([...habits, newHabit as any]);
    setNewHabitText('');
    await supabase.from('study_habits').insert({ id: newHabit.id, user_id: user.id, name: newHabit.name, streak: 0, completed_today: false });
  };`
);

content = content.replace(
  /const handleToggleHabit = \(id: string\) => \{[\s\S]*?saveToStorage\(courseConfigs, goals, tasks, updated\);\n  \};/,
  `const handleToggleHabit = async (id: string) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    const today = new Date().toISOString().split('T')[0];
    const completedToday = !habit.completedToday && !habit.completed_today; // Handle both camelCase and snake_case from DB
    const newStreak = completedToday ? (habit.streak || 0) + 1 : Math.max(0, (habit.streak || 0) - 1);
    
    setHabits(habits.map(h => h.id === id ? { ...h, completed_today: completedToday, completedToday, streak: newStreak, last_completed_date: completedToday ? today : h.last_completed_date } : h));
    
    await supabase.from('study_habits').update({ completed_today: completedToday, streak: newStreak, last_completed_date: completedToday ? today : habit.last_completed_date }).eq('id', id);
    if (completedToday) awardXP(50);
  };`
);

content = content.replace(
  /const handleDeleteHabit = \(id: string\) => \{[\s\S]*?saveToStorage\(courseConfigs, goals, tasks, updated\);\n  \};/,
  `const handleDeleteHabit = async (id: string) => {
    setHabits(habits.filter(h => h.id !== id));
    await supabase.from('study_habits').delete().eq('id', id);
  };`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('StudyPlan updated successfully via regex refactor!');
