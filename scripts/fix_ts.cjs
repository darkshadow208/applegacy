const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'user', 'StudyPlan.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix setDailyTime, setSchedule, setRemindersEnabled by adding them back as state or wrapper functions
content = content.replace(
  /const dailyTime = studyProfile\.daily_time_goal \|\| 45;/g,
  `const dailyTime = studyProfile?.daily_time_goal || 45;
  const setDailyTime = (val: number) => setStudyProfile({...studyProfile, daily_time_goal: val});`
);

content = content.replace(
  /const schedule = studyProfile\.schedule_slots \|\| \[\];/g,
  `const schedule = studyProfile?.schedule_slots || [];
  const setSchedule = (val: string[]) => setStudyProfile({...studyProfile, schedule_slots: val});`
);

content = content.replace(
  /const remindersEnabled = studyProfile\.reminders_enabled \?\? true;/g,
  `const remindersEnabled = studyProfile?.reminders_enabled ?? true;
  const setRemindersEnabled = (val: boolean) => setStudyProfile({...studyProfile, reminders_enabled: val});`
);

// 2. Fix subtasks missing in StudyGoal - just cast to any or add it to interface in useStudyPlan.ts
// We'll replace g.subtasks with (g as any).subtasks
content = content.replace(/g\.subtasks/g, '(g as any).subtasks');
content = content.replace(/h\.completedToday/g, 'h.completed_today');
content = content.replace(/h\.completed_today \? <Flame/g, 'h.completed_today ? <Flame'); // it might be fine
content = content.replace(/completedToday/g, 'completed_today');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed StudyPlan.tsx TS errors');
