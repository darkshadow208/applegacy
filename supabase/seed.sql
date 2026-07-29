-- 1. Insertar Categorías de Cursos
INSERT INTO public.course_categories (name, description) VALUES
('Marketing Digital', 'Estrategias de ventas, embudos y publicidad online.'),
('Desarrollo Personal', 'Crecimiento integral, liderazgo y productividad.'),
('Inversiones', 'Criptomonedas, bolsa de valores y finanzas personales.'),
('Negocios', 'Creación de empresas, gestión y emprendimiento.');

-- 2. Insertar Cursos de Prueba (Usaremos categorías genéricas, asegurándonos de que coincidan)
-- Nota: Para los uuid de las categorías, usaremos subconsultas para no tener que adivinarlos
INSERT INTO public.courses (category_id, title, description, image_url, drive_url, is_active) VALUES
(
  (SELECT id FROM public.course_categories WHERE name = 'Marketing Digital' LIMIT 1),
  'Masterclass en Estrategia Digital',
  'Aprende a crear embudos de venta de alta conversión desde cero. Ideal para principiantes y expertos.',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800&auto=format&fit=crop',
  'https://drive.google.com/drive/folders/ejemplo1',
  true
),
(
  (SELECT id FROM public.course_categories WHERE name = 'Desarrollo Personal' LIMIT 1),
  'Hábitos de Alta Productividad',
  'Cómo organizar tu día para lograr el doble de resultados en la mitad del tiempo.',
  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=800&auto=format&fit=crop',
  'https://drive.google.com/drive/folders/ejemplo2',
  true
),
(
  (SELECT id FROM public.course_categories WHERE name = 'Inversiones' LIMIT 1),
  'De Cero a Criptoinversor',
  'Entiende la tecnología blockchain y aprende a armar un portafolio sólido.',
  'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?q=80&w=800&auto=format&fit=crop',
  'https://drive.google.com/drive/folders/ejemplo3',
  true
);

-- 3. Insertar Bonos (Globales)
INSERT INTO public.bonuses (title, description, image_url, drive_url, is_global, is_active) VALUES
('Plantilla de Presupuesto Mensual', 'Un excel automatizado para controlar tus finanzas.', 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=400&auto=format&fit=crop', 'https://drive.google.com/file/d/ejemplo', true, true),
('Lista de Herramientas AI', 'Más de 50 herramientas de inteligencia artificial para ahorrar tiempo.', 'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=400&auto=format&fit=crop', 'https://drive.google.com/file/d/ejemplo2', true, true);

-- 4. Insertar Noticias / Novedades
INSERT INTO public.news_posts (title, content, type, is_active) VALUES
('¡Bienvenido a Legacy Academy!', 'Estamos muy emocionados de lanzar nuestra nueva plataforma web y móvil. Explora los cursos y aprovecha los bonos.', 'news', true),
('Mantenimiento Programado', 'El próximo domingo de 2am a 4am realizaremos actualizaciones en la base de datos.', 'announcement', true),
('5 Tips para estudiar mejor', 'Te dejamos en este post las mejores estrategias para que absorbas todo el conocimiento de los cursos.', 'blog', true);
