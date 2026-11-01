import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';
import type { PluginListenerHandle } from '@capacitor/core';
import { PushLifecycle, nextNotificationId } from './pushLifecycle';

const bindingKey = 'legacy_push_device';
const pushLifecycle = new PushLifecycle(async (token, platform) => {
  await supabase.rpc('register_push_device', { p_token: token, p_platform: platform }).throwOnError();
  const { data } = await supabase.auth.getSession();
  if (data.session) localStorage.setItem(bindingKey, JSON.stringify({ userId: data.session.user.id, token }));
}, async token => {
  await supabase.rpc('unregister_push_device', { p_token: token }).throwOnError();
});
let pushListeners: PluginListenerHandle[] = [];
let registrationTask: Promise<void> = Promise.resolve();
let reminderInterval: ReturnType<typeof setInterval> | undefined;
let expirationUser: string | null = null;
async function removePushListeners() {
  const previous = pushListeners; pushListeners = [];
  await Promise.all(previous.map(listener => listener.remove()));
}


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

  registerPushNotifications(userId: string) {
    const generation = pushLifecycle.start(userId);
    registrationTask = registrationTask.catch(() => {}).then(async () => {
      await removePushListeners();
      if (!pushLifecycle.isCurrent(generation)) return;
      if (Capacitor.isNativePlatform()) {
        const onToken = await PushNotifications.addListener('registration', token => {
          void pushLifecycle.bind(generation, token.value, 'native')
            .catch(error => console.error('No se pudo registrar el dispositivo:', error));
        });
        const onError = await PushNotifications.addListener('registrationError', error => {
          console.warn('No se pudo registrar push:', error);
        });
        const onAction = await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
          if (!pushLifecycle.isCurrent(generation)) return;
          const url = notification.notification.data?.url;
          if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
            window.dispatchEvent(new CustomEvent('push-navigate', { detail: url }));
          }
        });
        pushListeners = [onToken, onError, onAction];
        if (!pushLifecycle.isCurrent(generation)) { await removePushListeners(); return; }
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === 'prompt') permission = await PushNotifications.requestPermissions();
        if (permission.receive === 'granted' && pushLifecycle.isCurrent(generation)) await PushNotifications.register();
      } else {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
        const firebaseConfig = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID
        };
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!firebaseConfig.apiKey || !firebaseConfig.messagingSenderId || !vapidKey) return;
        if (await Notification.requestPermission() !== 'granted' || !pushLifecycle.isCurrent(generation)) return;
        const registration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js?' + new URLSearchParams(firebaseConfig), { scope: '/' });
        const { initializeApp, getApps } = await import('firebase/app');
        const { getMessaging, getToken } = await import('firebase/messaging');
        const app = getApps()[0] ?? initializeApp(firebaseConfig);
        const token = await getToken(getMessaging(app), { serviceWorkerRegistration: registration, vapidKey });
        if (token) await pushLifecycle.bind(generation, token, 'web');
      }
    }).catch(error => console.warn('No se pudo habilitar push:', error));
    return registrationTask;
  },

  stopPushNotifications() {
    pushLifecycle.stop();
    void registrationTask.then(removePushListeners);
  },

  async unregisterPushNotifications(userId: string) {
    pushLifecycle.stop();
    await registrationTask;
    await removePushListeners();
    let token: string | undefined;
    const cached = localStorage.getItem(bindingKey);
    if (cached) {
      try { const binding = JSON.parse(cached); if (binding.userId === userId) token = binding.token; }
      catch { localStorage.removeItem(bindingKey); }
    }
    await pushLifecycle.unlink(token);
    localStorage.removeItem(bindingKey);
    expirationUser = null;
    if (reminderInterval) clearInterval(reminderInterval);
    reminderInterval = undefined;
    await this.clearAll();
    if (Capacitor.isNativePlatform()) await PushNotifications.removeAllDeliveredNotifications();
  },

  async schedule(title: string, body: string, id: number = nextNotificationId(), scheduleAt?: Date) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      if (!Capacitor.isNativePlatform()) {
        if (!scheduleAt && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
        return;
      }
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

      // Web Fallback for Desktop Notifications (only in non-native browser)
      if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'Notification' in window) {
        if (reminderInterval) clearInterval(reminderInterval);
        
        if (times.length > 0) {
          reminderInterval = setInterval(() => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            const reminderKey = new Date().toLocaleDateString('en-CA') + ':' + currentTime;
            const lastNotified = localStorage.getItem('last_study_reminder');
            if (times.includes(currentTime) && lastNotified !== reminderKey) {
               localStorage.setItem('last_study_reminder', reminderKey);
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
                 } catch { /* El aviso visual ya se mostró; el audio es opcional. */ }
               }
            }
          }, 15000); // Check every 15 seconds
        }
      }

      if (!Capacitor.isNativePlatform()) return;
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

  async cancelExpirationNotifications() {
    try {
      if (!Capacitor.isNativePlatform()) return;
      const pending = await LocalNotifications.getPending();
      const expirationNotifs = pending.notifications.filter(n => n.id >= 1000 && n.id < 2000);
      if (expirationNotifs.length > 0) {
        await LocalNotifications.cancel({ notifications: expirationNotifs });
      }
    } catch (err) {
      console.warn('LocalNotifications cancelExpirationNotifications failed:', err);
    }
  },

  async clearAll() {
    try {
      if (!Capacitor.isNativePlatform()) return;
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
        }).throwOnError();
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
          // Clear previous admin expiration notifications to avoid clutter
          await this.cancelExpirationNotifications();
          
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
      if (expirationUser === userId) return;
      expirationUser = userId;
      
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

        await this.cancelExpirationNotifications();

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
