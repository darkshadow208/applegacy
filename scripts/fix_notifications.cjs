const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'lib', 'notifications.ts');
let content = fs.readFileSync(filePath, 'utf8');

// We will add a global flag at the top of the file
if (!content.includes('let hasCheckedExpirations = false;')) {
  content = content.replace(
    /export const notificationService = \{/,
    `let hasCheckedExpirations = false;\n\nexport const notificationService = {`
  );
}

// We will replace the user branch of checkAndScheduleExpirationNotifications
const startStr = "    } else {\n      // 2. Fetch current student's subscription";
const endStr = "      } catch (err) {\n        console.error('Error handling student expiration notifications:', err);\n      }\n    }\n  },";

const originalRegex = new RegExp(
  startStr.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&') + 
  '[\\s\\S]*?' + 
  endStr.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&')
);

const newLogic = `    } else {
      // 2. Fetch current student's subscription
      if (hasCheckedExpirations) return;
      hasCheckedExpirations = true;
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
  },`;

if (originalRegex.test(content)) {
  content = content.replace(originalRegex, newLogic);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated notifications.ts');
} else {
  console.error('Could not find the target block in notifications.ts');
}
