import { supabase } from './supabase';

export type CourseStatus = 'pending' | 'progress' | 'completed';
export type CoursePriority = 'low' | 'medium' | 'high';

export async function saveCourseProgress(userId: string, courseId: string, status: CourseStatus) {
  // El conflicto es la pareja usuario/curso en ambas versiones históricas del esquema.
  // No escribir priority aquí: cambiar el progreso no debe borrar la prioridad elegida.
  const { data } = await supabase.from('course_student_configs')
    .upsert({ user_id: userId, course_id: courseId, status }, { onConflict: 'user_id,course_id' })
    .select('status, priority').single().throwOnError();
  return data;
}
