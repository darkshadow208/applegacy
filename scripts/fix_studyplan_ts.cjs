const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'user', 'StudyPlan.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace notificationService.addNotification with alert or console.log
content = content.replace(
  /notificationService\.addNotification\('Ya tienes este horario reservado\.'\);/g,
  `alert('Ya tienes este horario reservado.');`
);

content = content.replace(
  /notificationService\.addNotification\(\`Bloque de estudio añadido: \$\{slot\}\`\);/g,
  `console.log(\`Bloque de estudio añadido: \${slot}\`);`
);

content = content.replace(
  /notificationService\.addNotification\(\`Bloque eliminado: \$\{slot\}\`\);/g,
  `console.log(\`Bloque eliminado: \${slot}\`);`
);

content = content.replace(
  /notificationService\.addNotification\('🎯 ¡Meta lograda! \+100 XP', 'success'\);/g,
  `console.log('🎯 ¡Meta lograda! +100 XP');`
);

content = content.replace(
  /notificationService\.addNotification\('✅ Tarea completada \+10 XP', 'success'\);/g,
  `console.log('✅ Tarea completada +10 XP');`
);

content = content.replace(
  /notificationService\.addNotification\('🔥 ¡Hábito cumplido! \+50 XP y racha mantenida', 'success'\);/g,
  `console.log('🔥 ¡Hábito cumplido! +50 XP y racha mantenida');`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed TS errors in StudyPlan');
