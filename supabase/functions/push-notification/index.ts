// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { JWT } from 'npm:google-auth-library@9.4.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Obtener la información del evento (compatible con Database Webhook y llamada directa HTTP)
    const payload = await req.json();
    const notification = payload.record || payload; // Soporta tanto Webhook de Supabase como invocación directa

    // Si la notificación no tiene título o datos válidos, abortar con mensaje claro
    if (!notification || !notification.title) {
      return new Response(
        JSON.stringify({ error: 'Payload de notificación no válido. Se requiere el campo "title".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Conectar a Supabase para buscar el fcm_token del usuario
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let tokens: string[] = [];

    if (notification.user_id) {
      // Notificación directa a un usuario (consultar perfil y dispositivos)
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('fcm_token')
        .eq('id', notification.user_id)
        .maybeSingle();
      
      if (profile?.fcm_token) {
        tokens.push(profile.fcm_token);
      }

      // Si existe la tabla de múltiples dispositivos, consultar también
      try {
        const { data: devices } = await supabase
          .from('user_push_devices')
          .select('fcm_token')
          .eq('user_id', notification.user_id);

        if (devices) {
          devices.forEach((d: { fcm_token: string }) => {
            if (d.fcm_token && !tokens.includes(d.fcm_token)) tokens.push(d.fcm_token);
          });
        }
      } catch {
        // Ignorar si la tabla no ha sido creada aún
      }
    } else {
      // Notificación global a todos los usuarios con token
      const { data: profiles } = await supabase
        .from('users_profiles')
        .select('fcm_token')
        .not('fcm_token', 'is', null);
      
      if (profiles) {
        tokens = profiles.map((p: { fcm_token: string }) => p.fcm_token).filter(Boolean);
      }

      try {
        const { data: devices } = await supabase
          .from('user_push_devices')
          .select('fcm_token');

        if (devices) {
          devices.forEach((d: { fcm_token: string }) => {
            if (d.fcm_token && !tokens.includes(d.fcm_token)) tokens.push(d.fcm_token);
          });
        }
      } catch {
        // Ignorar si la tabla no ha sido creada aún
      }
    }

    // Filtrar tokens duplicados
    tokens = Array.from(new Set(tokens.filter(Boolean)));

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No hay dispositivos registrados para notificar', notified: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Autenticarse con Firebase usando la cuenta de servicio
    const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountStr) {
      throw new Error('El secreto FIREBASE_SERVICE_ACCOUNT no está configurado en Supabase.');
    }
    
    const serviceAccount = JSON.parse(serviceAccountStr);

    // Corregir posibles saltos de línea escapados en la clave privada (muy común en variables de entorno)
    const privateKey = serviceAccount.private_key
      ? serviceAccount.private_key.replace(/\\n/g, '\n')
      : '';

    const jwtClient = new JWT({
      email: serviceAccount.client_email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const tokensAuth = await jwtClient.getAccessToken();
    const accessToken = tokensAuth.token;

    // 4. Enviar las notificaciones push usando la API v1 de FCM
    const projectId = serviceAccount.project_id;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const sendPromises = tokens.map(async (token) => {
      const fcmPayload = {
        message: {
          token: token,
          notification: {
            title: notification.title,
            body: notification.message || '',
          },
          android: {
            notification: {
              channel_id: 'default',
              click_action: 'OPEN_APP_ACTION'
            }
          },
          webpush: {
            notification: {
              title: notification.title,
              body: notification.message || '',
              icon: '/logo.png'
            }
          }
        }
      };

      try {
        const fcmResponse = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmPayload),
        });

        if (!fcmResponse.ok) {
          console.error(`Error enviando FCM al token ${token.substring(0, 10)}...:`, await fcmResponse.text());
        }
      } catch (err) {
        console.error('Error de red al conectar con FCM:', err);
      }
    });

    await Promise.all(sendPromises);

    return new Response(
      JSON.stringify({ success: true, notified: tokens.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Function error:', errorMsg);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
