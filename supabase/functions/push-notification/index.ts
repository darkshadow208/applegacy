import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { JWT } from 'npm:google-auth-library@9.4.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  try {
    // 1. Obtener la información del evento (inserción en tabla notifications)
    const payload = await req.json();
    const notification = payload.record; // La nueva fila en la base de datos

    // Si la notificación no tiene usuario asignado (global) o no tiene título, abortar
    if (!notification || !notification.title) {
      return new Response('Not a valid notification payload', { status: 400 });
    }

    // 2. Conectar a Supabase para buscar el fcm_token del usuario
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let tokens: string[] = [];

    if (notification.user_id) {
      // Notificación directa a un usuario
      const { data, error } = await supabase
        .from('users_profiles')
        .select('fcm_token')
        .eq('id', notification.user_id)
        .single();
      
      if (data?.fcm_token) {
        tokens.push(data.fcm_token);
      }
    } else {
      // Notificación global a todos los usuarios con token
      const { data, error } = await supabase
        .from('users_profiles')
        .select('fcm_token')
        .not('fcm_token', 'is', null);
      
      if (data) {
        tokens = data.map(p => p.fcm_token);
      }
    }

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No devices to notify' }), { status: 200 });
    }

    // 3. Autenticarse con Firebase usando la cuenta de servicio
    // El JSON de la cuenta de servicio debe estar guardado en los Secrets de Supabase
    const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountStr) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT secret not found');
    }
    
    const serviceAccount = JSON.parse(serviceAccountStr);

    const jwtClient = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
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
          }
        }
      };

      const fcmResponse = await fetch(fcmUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      });

      if (!fcmResponse.ok) {
        console.error('FCM Send Error:', await fcmResponse.text());
      }
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true, notified: tokens.length }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
