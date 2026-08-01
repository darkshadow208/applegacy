const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'user', 'StudyPlan.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove all saveToStorage calls
content = content.replace(/saveToStorage\([^)]*\);/g, '');

// 2. Replace Date.now().toString() with crypto.randomUUID() for new items
content = content.replace(/Date\.now\(\)\.toString\(\)/g, 'crypto.randomUUID()');

// 3. For subtasks in study_goals, since the column doesn't exist in Supabase and the user didn't mention it, 
// let's just make sure it doesn't crash. (Subtasks aren't saved to DB currently, but removing saveToStorage stops the crash).
// However, the insert for goals has `subtasks: []`. Supabase might reject the insert if the column doesn't exist!
content = content.replace(/subtasks: \[\]/g, '');
content = content.replace(/,  \}/g, ' }'); // clean up trailing commas in goal insert

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed StudyPlan.tsx ID generation and removed saveToStorage');
