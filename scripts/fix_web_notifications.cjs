const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'lib', 'notifications.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Update requestPermissions to fallback to Web API
content = content.replace(
  /async requestPermissions\(\) \{[\s\S]*?try \{[\s\S]*?const \{ display \} = await LocalNotifications\.requestPermissions\(\);[\s\S]*?return display === 'granted';[\s\S]*?\} catch \(err\) \{[\s\S]*?console\.warn\('LocalNotifications requesting permissions not supported in this environment:', err\);[\s\S]*?return false;[\s\S]*?\}/,
  `async requestPermissions() {
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
    }`
);

// Update scheduleDailyReminders to include Web Poller
content = content.replace(
  /async scheduleDailyReminders\(times: string\[\]\) \{[\s\S]*?try \{[\s\S]*?const hasPermission = await this\.requestPermissions\(\);[\s\S]*?if \(!hasPermission\) return;/,
  `async scheduleDailyReminders(times: string[]) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      // Web Fallback for Desktop Notifications
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if ((window as any).webReminderInterval) clearInterval((window as any).webReminderInterval);
        
        if (times.length > 0) {
          (window as any).webReminderInterval = setInterval(() => {
            const now = new Date();
            const currentTime = \`\${now.getHours().toString().padStart(2, '0')}:\${now.getMinutes().toString().padStart(2, '0')}\`;
            
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
      }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed Web Notifications logic in notifications.ts');
