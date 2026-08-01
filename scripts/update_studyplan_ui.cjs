const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'user', 'StudyPlan.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add state for new schedule block
content = content.replace(
  /const \[newReminderTime, setNewReminderTime\] = useState\('18:00'\);/,
  `const [newReminderTime, setNewReminderTime] = useState('18:00');
  const [newScheduleDay, setNewScheduleDay] = useState('Lunes');
  const [newScheduleTime, setNewScheduleTime] = useState('18:00');`
);

// Add handleAddScheduleSlot
content = content.replace(
  /const handleDeleteReminderTime = async \(time: string\) => \{[\s\S]*?\};/,
  `const handleDeleteReminderTime = async (time: string) => {
    const updated = reminderTimes.filter((t: string) => t !== time);
    setStudyProfile({...studyProfile, reminder_times: updated} as any);
    if (user) await supabase.from('student_study_profile').update({ reminder_times: updated }).eq('user_id', user.id);
  };

  const handleAddScheduleSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const slot = \`\${newScheduleDay} \${newScheduleTime}\`;
    if (schedule.includes(slot)) {
      notificationService.addNotification('Ya tienes este horario reservado.');
      return;
    }
    const updated = [...schedule, slot];
    setSchedule(updated);
    notificationService.addNotification(\`Bloque de estudio añadido: \${slot}\`);
  };

  const handleRemoveScheduleSlot = async (slot: string) => {
    const updated = schedule.filter((s: string) => s !== slot);
    setSchedule(updated);
    notificationService.addNotification(\`Bloque eliminado: \${slot}\`);
  };`
);

// Replace UI for Horarios de Estudio
content = content.replace(
  /<p className="text-xs text-gray-500 leading-relaxed">[\s\S]*?Elige tus bloques fijos para forjar consistencia semanal\.[\s\S]*?<\/p>[\s\S]*?<div className="flex flex-col gap-2 mt-1">[\s\S]*?\{\['Lunes 18:00', 'Miércoles 20:00', 'Viernes 18:00', 'Sábado 10:00'\]\.map\(\(slot\) => \{[\s\S]*?return \([\s\S]*?<button[\s\S]*?key=\{slot\}[\s\S]*?onClick=\{[\s\S]*?\}[\s\S]*?className=\{[\s\S]*?\}[\s\S]*?>[\s\S]*?<span>\{slot\}<\/span>[\s\S]*?<span className="text-\[10px\] uppercase font-bold tracking-wider">\{isSelected \? 'Bloque de estudio' : 'Reservar'\}<\/span>[\s\S]*?<\/button>[\s\S]*?\);[\s\S]*?\}\)\}[\s\S]*?<\/div>/,
  `<p className="text-xs text-gray-500 leading-relaxed">
              Elige tus bloques fijos de estudio para forjar consistencia durante la semana.
            </p>

            <form onSubmit={handleAddScheduleSlot} className="flex gap-2">
              <select 
                value={newScheduleDay} 
                onChange={(e) => setNewScheduleDay(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="Lunes">Lunes</option>
                <option value="Martes">Martes</option>
                <option value="Miércoles">Miércoles</option>
                <option value="Jueves">Jueves</option>
                <option value="Viernes">Viernes</option>
                <option value="Sábado">Sábado</option>
                <option value="Domingo">Domingo</option>
              </select>
              <input 
                type="time" 
                value={newScheduleTime}
                onChange={(e) => setNewScheduleTime(e.target.value)}
                className="flex-1 text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-gray-700"
              />
              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0 flex items-center gap-1">
                <Plus size={14} /> Añadir
              </button>
            </form>

            <div className="flex flex-col gap-2 mt-2">
              {schedule.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No has asignado bloques de estudio. ¡Empieza hoy!</p>
              ) : (
                schedule.map((slot: string) => (
                  <div
                    key={slot}
                    className="flex items-center justify-between p-3 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 shadow-sm transition-all hover:shadow-md"
                  >
                    <span className="text-xs font-bold">{slot}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase font-bold tracking-wider">Bloque Reservado</span>
                      <button
                        onClick={() => handleRemoveScheduleSlot(slot)}
                        className="text-purple-400 hover:text-red-500 hover:bg-white p-1 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>`
);

// Add notifications for handleToggleGoal
content = content.replace(
  /if \(updatedCompleted\) awardXP\(100\);/g,
  `if (updatedCompleted) {
      awardXP(100);
      notificationService.addNotification('🎯 ¡Meta lograda! +100 XP', 'success');
    }`
);

// Add notifications for handleToggleTask
content = content.replace(
  /if \(updatedCompleted\) awardXP\(10\);/g,
  `if (updatedCompleted) {
      awardXP(10);
      notificationService.addNotification('✅ Tarea completada +10 XP', 'success');
    }`
);

// Add notifications for handleToggleHabit
content = content.replace(
  /if \(completed_today\) awardXP\(50\);/g,
  `if (completed_today) {
      awardXP(50);
      notificationService.addNotification('🔥 ¡Hábito cumplido! +50 XP y racha mantenida', 'success');
    }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated StudyPlan UI and added notifications');
