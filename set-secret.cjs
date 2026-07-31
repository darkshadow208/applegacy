const { execSync } = require('child_process');
const fs = require('fs');

// Leer el JSON
const jsonData = fs.readFileSync('legacyacademyt-firebase-adminsdk-fbsvc-03ba7ae48a.json', 'utf8');

// Crear un archivo .env temporal con el JSON en una sola línea (para evitar problemas de formato)
const singleLineJson = JSON.stringify(JSON.parse(jsonData));
const envContent = `FIREBASE_SERVICE_ACCOUNT='${singleLineJson}'\n`;

fs.writeFileSync('.env.temp.secret', envContent);

try {
  // Configurar el secreto usando el archivo .env temporal
  console.log('Subiendo el secreto a Supabase...');
  execSync('npx supabase secrets set --env-file .env.temp.secret', { stdio: 'inherit' });
  console.log('¡Secreto subido con éxito!');
} catch (e) {
  console.error('Error subiendo el secreto:', e.message);
} finally {
  // Limpiar
  fs.unlinkSync('.env.temp.secret');
}
