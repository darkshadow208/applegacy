const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer archivo .env.local manualmente
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

let supabaseUrl = '';
let supabaseAnonKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    supabaseAnonKey = line.split('=')[1].trim();
  }
});

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Eliminando todos los aportes (user_contributions)...');
  const { error } = await supabase
    .from('user_contributions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('Error al eliminar aportes:', error);
  } else {
    console.log('¡Todos los aportes de prueba han sido eliminados con éxito!');
  }
}

run();
