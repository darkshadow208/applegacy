const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'user', 'StudyPlan.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The file currently has:
// const reminderTimes = studyProfile?.reminder_times || ['09:00', '18:00'];
// const setReminderTimes = (val: string[]) => setStudyProfile({...studyProfile, reminder_times: val});
// Wait, in previous step I did not add reminder_times to StudyProfile! 
// Oh, the user's code previously had:
// const [reminderTimes, setReminderTimes] = useState<string[]>(['09:00', '18:00']);

content = content.replace(
  /const \[reminderTimes, setReminderTimes\] = useState<string\[\]>\(\['09:00', '18:00'\]\);/g,
  `const reminderTimes = studyProfile?.reminder_times || ['09:00', '18:00'];
  const setReminderTimes = (val: string[]) => setStudyProfile({...studyProfile, reminder_times: val} as any);`
);

// Replace saveToStorage calls with Supabase update for the profile
content = content.replace(
  /const setDailyTime = \(val: number\) => setStudyProfile\(\{\.\.\.studyProfile, daily_time_goal: val\}\);/g,
  `const setDailyTime = async (val: number) => {
    setStudyProfile({...studyProfile, daily_time_goal: val} as any);
    if (user) await supabase.from('student_study_profile').update({ daily_time_goal: val }).eq('user_id', user.id);
  };`
);

content = content.replace(
  /const setSchedule = \(val: string\[\]\) => setStudyProfile\(\{\.\.\.studyProfile, schedule_slots: val\}\);/g,
  `const setSchedule = async (val: string[]) => {
    setStudyProfile({...studyProfile, schedule_slots: val} as any);
    if (user) await supabase.from('student_study_profile').update({ schedule_slots: val }).eq('user_id', user.id);
  };`
);

content = content.replace(
  /const setRemindersEnabled = \(val: boolean\) => setStudyProfile\(\{\.\.\.studyProfile, reminders_enabled: val\}\);/g,
  `const setRemindersEnabled = async (val: boolean) => {
    setStudyProfile({...studyProfile, reminders_enabled: val} as any);
    if (user) await supabase.from('student_study_profile').update({ reminders_enabled: val }).eq('user_id', user.id);
  };`
);

// We need to fix where handleAddReminderTime / handleDeleteReminderTime calls saveToStorage
content = content.replace(
  /const handleAddReminderTime = \(\) => \{[\s\S]*?saveToStorage\([\s\S]*?\);\n  \};/m,
  `const handleAddReminderTime = async () => {
    if (!newReminderTime) return;
    if (reminderTimes.includes(newReminderTime)) {
      alert('Esta hora de aviso ya está programada.');
      return;
    }
    const updated = [...reminderTimes, newReminderTime].sort();
    setStudyProfile({...studyProfile, reminder_times: updated} as any);
    if (user) await supabase.from('student_study_profile').update({ reminder_times: updated }).eq('user_id', user.id);
  };`
);

content = content.replace(
  /const handleDeleteReminderTime = \(time: string\) => \{[\s\S]*?saveToStorage\([\s\S]*?\);\n  \};/m,
  `const handleDeleteReminderTime = async (time: string) => {
    const updated = reminderTimes.filter(t => t !== time);
    setStudyProfile({...studyProfile, reminder_times: updated} as any);
    if (user) await supabase.from('student_study_profile').update({ reminder_times: updated }).eq('user_id', user.id);
  };`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed profile updates in StudyPlan.tsx');
