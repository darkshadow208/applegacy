import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface StudyGoal {
  id: string;
  text: string;
  period: 'weekly' | 'monthly';
  completed: boolean;
}

export interface StudyTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface StudyHabit {
  id: string;
  name: string;
  streak: number;
  completed_today: boolean;
  last_completed_date?: string;
}

export interface StudyProfile {
  daily_time_goal: number;
  schedule_slots: string[];
  reminders_enabled: boolean;
  reminder_times: string[];
}

export function useStudyPlan(userId: string | undefined) {
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [habits, setHabits] = useState<StudyHabit[]>([]);
  const [profile, setProfile] = useState<StudyProfile>({
    daily_time_goal: 45,
    schedule_slots: ['Lunes 18:00', 'Miércoles 20:00', 'Viernes 18:00'],
    reminders_enabled: true,
    reminder_times: ['09:00', '18:00']
  });
  const [courseConfigs, setCourseConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function loadData() {
      setLoading(true);
      try {
        const [goalsRes, tasksRes, habitsRes, profileRes, configsRes] = await Promise.all([
          supabase.from('study_goals').select('*').eq('user_id', userId),
          supabase.from('study_tasks').select('*').eq('user_id', userId),
          supabase.from('study_habits').select('*').eq('user_id', userId),
          supabase.from('student_study_profile').select('*').eq('user_id', userId).maybeSingle(),
          supabase.from('course_student_configs').select('*').eq('user_id', userId)
        ]);

        if (goalsRes.data) setGoals(goalsRes.data);
        if (tasksRes.data) setTasks(tasksRes.data);
        if (habitsRes.data) {
          // Process habits for 24h reset
          const today = new Date().toISOString().split('T')[0];
          const yesterdayDate = new Date(Date.now() - 86400000);
          const yesterday = yesterdayDate.toISOString().split('T')[0];

          let habitsChanged = false;
          const processedHabits = habitsRes.data.map((h: any) => {
            if (!h.last_completed_date) return h;
            
            if (h.last_completed_date !== today && h.completed_today) {
              habitsChanged = true;
              const isOlderThanYesterday = h.last_completed_date < yesterday;
              return { ...h, completed_today: false, streak: isOlderThanYesterday ? 0 : h.streak };
            }

            if (!h.completed_today && h.last_completed_date < yesterday && h.streak > 0) {
              habitsChanged = true;
              return { ...h, streak: 0 };
            }

            return h;
          });

          setHabits(processedHabits);

          // If changed, update db silently
          if (habitsChanged) {
            processedHabits.forEach((h: any) => {
              supabase.from('study_habits').update({ 
                completed_today: h.completed_today, 
                streak: h.streak 
              }).eq('id', h.id).then();
            });
          }
        }
        
        if (profileRes.data) {
          setProfile(profileRes.data);
        } else {
          // Create default profile
          await supabase.from('student_study_profile').insert({ user_id: userId });
        }

        if (configsRes.data) {
          const confMap: Record<string, any> = {};
          configsRes.data.forEach(c => { confMap[c.course_id] = { status: c.status, priority: c.priority }; });
          setCourseConfigs(confMap);
        }

      } catch (err) {
        console.error('Error loading study plan:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userId]);

  return {
    goals, setGoals,
    tasks, setTasks,
    habits, setHabits,
    profile, setProfile,
    courseConfigs, setCourseConfigs,
    loading
  };
}
