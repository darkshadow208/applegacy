import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';

export const notificationService = {
  async requestPermissions() {
    try {
      const { display } = await LocalNotifications.requestPermissions();
      return display === 'granted';
    } catch (err) {
      console.warn('LocalNotifications requesting permissions not supported in this environment:', err);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') return true;
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return false;
    }
  },

  async registerPushNotifications(userId: string) {
    // --- NATIVE PLATFORM (ANDROID / IOS) ---
    if (Capacitor.isNativePlatform()) {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          throw new Error('Push permissions not granted');
        }

        // Registers with Apple/Google
        await PushNotifications.register();

        // Listen for registration success
        PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token:', token.value);
          // Save the FCM token to Supabase
          await supabase
            .from('users_profiles')
            .update({ fcm_token: token.value })
            .eq('id', userId);
        });

        // Listen for registration error
        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Push registration error:', error);
        });

        // Listen for push notifications received
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received: ', notification);
        });

        // Listen for push notification click
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push action performed: ', notification);
          const data = notification.notification.data;
          if (data && data.url) {
            // Despachar evento global para que UserLayout navegue
            window.dispatchEvent(new CustomEvent('push-navigate', { detail: data.url }));
          }
        });

      } catch (err) {
        console.warn('PushNotifications not supported in this native environment:', err);
      }
    } 
    // --- WEB / PWA PLATFORM (DESKTOP & SAFARI IOS 16.4+) ---
    else {
      try {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
          console.warn('Push notifications not supported on this browser.');
          return;
        }

        // Solicitar permisos al navegador
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Permisos de notificación web denegados.');
          return;
        }

        // Obtener variables de Firebase
        const firebaseConfig = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID
        };

        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

        if (!firebaseConfig.apiKey || !firebaseConfig.messagingSenderId || !vapidKey) {
          console.warn('Configuración de Firebase Web o VAPID Key faltante en variables de entorno. Omitiendo Web Push.');
          return;
        }

        // Registrar Service Worker con credenciales dinámicas en la URL
        const swParams = new URLSearchParams(firebaseConfig).toString();
        const swUrl = `/firebase-messaging-sw.js?${swParams}`;
        const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });

        // Cargar SDK dinámicamente para no pesar en el bundle inicial
        const { initializeApp } = await import('firebase/app');
        const { getMessaging, getToken } = await import('firebase/messaging');

        const app = initializeApp(firebaseConfig);
        const messaging = getMessaging(app);

        // Obtener token de FCM para Web
        const token = await getToken(messaging, {
          serviceWorkerRegistration: registration,
          vapidKey: vapidKey
        });

        if (token) {
          console.log('Web Push FCM token obtenido con éxito:', token);
          // Guardar el token en Supabase
          await supabase
            .from('users_profiles')
            .update({ fcm_token: token })
            .eq('id', userId);
        } else {
          console.warn('No se pudo obtener el token Web Push de FCM.');
        }

      } catch (err) {
        console.warn('Error al registrar Web Push:', err);
      }
    }
  },

  async schedule(title: string, body: string, id: number = new Date().getTime(), scheduleAt?: Date) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id,
            schedule: scheduleAt ? { at: scheduleAt } : undefined,
            actionTypeId: '',
            extra: null
          }
        ]
      });
    } catch (err) {
      console.warn('LocalNotifications schedule failed:', err);
    }
  },

  async scheduleDailyReminders(times: string[]) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      // Web Fallback for Desktop Notifications
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if ((window as any).webReminderInterval) clearInterval((window as any).webReminderInterval);
        
        if (times.length > 0) {
          (window as any).webReminderInterval = setInterval(() => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            const lastNotified = localStorage.getItem('last_study_reminder');
            if (times.includes(currentTime) && lastNotified !== currentTime) {
               localStorage.setItem('last_study_reminder', currentTime);
               if (Notification.permission === 'granted') {
                 new Notification('📚 ¡Hora de Estudiar!', {
                   body: 'Es momento de avanzar en tus metas del plan de estudio. ¡Tu disciplina creará tu éxito! 🚀'
                 });
                 // Audio beep
                 try {
                   const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                   const osc = ctx.createOscillator();
                   const gain = ctx.createGain();
                   osc.connect(gain);
                   gain.connect(ctx.destination);
                   osc.type = 'sine';
                   osc.frequency.setValueAtTime(880, ctx.currentTime);
                   gain.gain.setValueAtTime(0.1, ctx.currentTime);
                   gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                   osc.start(ctx.currentTime);
                   osc.stop(ctx.currentTime + 0.5);
                 } catch(e) {}
               }
            }
          }, 15000); // Check every 15 seconds
        }
      }

      const pending = await LocalNotifications.getPending();
      const studyReminders = pending.notifications.filter(n => n.id >= 2000 && n.id <= 2999);
      if (studyReminders.length > 0) {
        await LocalNotifications.cancel({ notifications: studyReminders });
      }

      if (times.length === 0) return;

      const notifications = times.map((time, index) => {
        const [hour, minute] = time.split(':').map(Number);
        return {
          title: '📚 ¡Hora de Estudiar!',
          body: 'Es momento de avanzar en tus metas del plan de estudio en Legacy Academy. ¡Tu disciplina creará tu éxito! 🚀',
          id: 2000 + index,
          schedule: { on: { hour, minute } },
        };
      });

      await LocalNotifications.schedule({ notifications });
    } catch (err) {
      console.warn('LocalNotifications scheduleDailyReminders failed:', err);
    }
  },

  async clearAll() {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
    } catch (err) {
      console.warn('LocalNotifications clearAll failed:', err);
    }
  },

  async insertDbNotificationIfNotExists(userId: string | null, title: string, message: string) {
    try {
      let query = supabase.from('notifications').select('id').eq('title', title);
      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.is('user_id', null);
      }
      
      const { data, error } = await query.limit(1);
      if (error) throw error;

      if (!data || data.length === 0) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title,
          message,
          is_read: false
        });
      }
    } catch (err) {
      console.error('Error inserting db notification:', err);
    }
  },

  async checkAndScheduleExpirationNotifications(userId: string, role: 'user' | 'admin') {
    const now = new Date();
    
    if (role === 'admin') {
      // 1. Fetch active subscriptions expiring in the next 3 days
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      try {
        const { data: expiringSubs, error } = await supabase
          .from('subscriptions')
          .select('id, end_date, users_profiles(full_name)')
          .eq('status', 'active')
          .lte('end_date', threeDaysFromNow.toISOString())
          .gt('end_date', now.toISOString());

        if (error) {
          console.error('Error fetching expiring subscriptions for admin:', error);
          return;
        }

        if (expiringSubs && expiringSubs.length > 0) {
          // Clear previous admin notifications to avoid clutter
          await this.clearAll();
          
          for (const sub of expiringSubs) {
            const studentName = (sub.users_profiles as any)?.full_name || 'Un estudiante';
            const endDate = new Date(sub.end_date);
            const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            await this.schedule(
              '⚠️ Vencimiento de Membresía',
              `La membresía de ${studentName} vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}.`,
              new Date(sub.end_date).getTime() % 1000000
            );
          }
        }
      } catch (err) {
        console.error('Error handling admin expiration notifications:', err);
      }
    } else {
      // 2. Fetch current student's subscription
      // Use a lock to prevent strict mode from running this twice concurrently
      if ((window as any)._hasCheckedExpirations) return;
      (window as any)._hasCheckedExpirations = true;
      
      try {
        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching subscription for student notifications:', error);
          return;
        }

        if (!subscription || subscription.status !== 'active' || !subscription.end_date) {
          return;
        }

        await this.clearAll();

        const endDate = new Date(subscription.end_date);
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysLeft > 3) {
          // Schedule 3 days before
          const threeDaysBefore = new Date(endDate);
          threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
          await this.schedule(
            'Tu membresía va a expirar',
            'Faltan 3 días para el vencimiento de tu plan. Envía tu comprobante para renovar.',
            1001,
            threeDaysBefore
          );
        } else if (daysLeft > 1 && daysLeft <= 3) {
           await this.insertDbNotificationIfNotExists(
            userId,
            '⏳ Tu membresía vence pronto',
            'Faltan menos de 3 días para el vencimiento de tu plan. Envía tu comprobante para renovar.'
          );
          
          // Schedule 1 day before
          const oneDayBefore = new Date(endDate);
          oneDayBefore.setDate(oneDayBefore.getDate() - 1);
          if (oneDayBefore > now) {
            await this.schedule(
              'Membresía por expirar mañana',
              'Tu acceso premium expira mañana. ¡Sube un nuevo comprobante para continuar!',
              1002,
              oneDayBefore
            );
          }
        } else if (daysLeft === 1 || daysLeft === 0) {
           await this.insertDbNotificationIfNotExists(
            userId,
            '🚨 ¡Tu membresía vence mañana!',
            'Tu acceso premium expira mañana. ¡Sube un nuevo comprobante para continuar!'
          );
        }
      } catch (err) {
        console.error('Error handling student expiration notifications:', err);
      }
    }
  }
};
