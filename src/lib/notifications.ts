import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from './supabase';

export const notificationService = {
  async requestPermissions() {
    try {
      const { display } = await LocalNotifications.requestPermissions();
      return display === 'granted';
    } catch (err) {
      console.warn('LocalNotifications requesting permissions not supported in this environment:', err);
      return false;
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

        // Schedule 3 days before
        const threeDaysBefore = new Date(endDate);
        threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
        if (threeDaysBefore > now) {
          await this.schedule(
            'Tu membresía va a expirar',
            'Faltan 3 días para el vencimiento de tu plan. Envía tu comprobante para renovar.',
            1001,
            threeDaysBefore
          );
        } else {
          // If we are already within the 3 day window, make sure it is in the database notifications
          await this.insertDbNotificationIfNotExists(
            userId,
            '⏳ Tu membresía vence pronto',
            'Faltan menos de 3 días para el vencimiento de tu plan. Envía tu comprobante para renovar.'
          );
        }

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
        } else {
          // If we are already within the 1 day window, make sure it is in the database notifications
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
