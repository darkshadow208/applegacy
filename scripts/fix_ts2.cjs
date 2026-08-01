const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'user', 'StudyPlan.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove unused interfaces
content = content.replace(/interface CourseConfig \{[\s\S]*?\}/, '');
content = content.replace(/interface Goal \{[\s\S]*?\}/, '');
content = content.replace(/interface Task \{[\s\S]*?\}/, '');
content = content.replace(/interface Habit \{[\s\S]*?\}/, '');

// 2. Remove unused loadingPlan
content = content.replace(/loading: loadingPlan/, '');
content = content.replace(/,(\s*)\}/, '}'); // Clean up trailing comma if needed

// 3. Fix object literal multiple properties 'completed_today: completed_today, completed_today'
content = content.replace(/\{ \.\.\.h, completed_today: completed_today, completed_today, streak: newStreak/g, '{ ...h, completed_today, streak: newStreak');

// 4. Fix implicit 'any' on parameter 's' in subtasks
content = content.replace(/s =>/g, '(s: any) =>');
content = content.replace(/\(s\)/g, '(s: any)');
// Or simply replace .filter(s => with .filter((s: any) =>
// content = content.replace(/\.filter\(s =>/g, '.filter((s: any) =>');
// content = content.replace(/\.map\(s =>/g, '.map((s: any) =>');

// Actually let's use exact line replacement for the implicit 'any' since it's safer
content = content.replace(/\.filter\(s => s\.completed\)/g, '.filter((s: any) => s.completed)');
content = content.replace(/\.map\(s => s\.id === subTaskId/g, '.map((s: any) => s.id === subTaskId');
content = content.replace(/\.filter\(s => s\.id !== subTaskId\)/g, '.filter((s: any) => s.id !== subTaskId)');
content = content.replace(/subtasks\.map\(s => \(/g, 'subtasks.map((s: any) => (');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed StudyPlan.tsx TS errors');
