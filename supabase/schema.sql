-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- App Settings (for global variables if needed)
CREATE TABLE public.app_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Users Profiles
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'suspended');
CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TABLE public.users_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role user_role DEFAULT 'user',
  status user_status DEFAULT 'pending',
  phone VARCHAR(50),
  telegram VARCHAR(100),
  payment_receipt_url TEXT,
  avatar_url TEXT,
  read_global_notifs UUID[] DEFAULT '{}'::uuid[],
  deleted_global_notifs UUID[] DEFAULT '{}'::uuid[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Subscriptions
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'pending', 'suspended', 'pending_renewal');

CREATE TABLE public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  status subscription_status DEFAULT 'pending',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  payment_receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Payments
CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2),
  payment_date DATE NOT NULL,
  receipt_url TEXT NOT NULL,
  notes TEXT,
  status payment_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Course Categories
CREATE TABLE public.course_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Courses
CREATE TABLE public.courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  drive_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bonuses
CREATE TABLE public.bonuses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  drive_url TEXT,
  is_global BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User Specific Bonuses
CREATE TABLE public.user_bonuses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  bonus_id UUID REFERENCES public.bonuses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, bonus_id)
);

-- News / Announcements
CREATE TYPE news_type AS ENUM ('news', 'blog', 'announcement');

CREATE TABLE public.news_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type news_type DEFAULT 'news',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User Contributions
CREATE TYPE contribution_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.user_contributions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  link_url TEXT,
  contribution_type VARCHAR(100), -- course_link, book, tip, etc.
  category VARCHAR(100) DEFAULT 'General',
  status contribution_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users_profiles(id) ON DELETE CASCADE, -- null for global
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_profiles (id, email, full_name, role, status, phone, telegram, payment_receipt_url)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    'user', 
    'pending',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'telegram',
    new.raw_user_meta_data->>'payment_receipt_url'
  );
  
  -- Create initial pending subscription
  INSERT INTO public.subscriptions (user_id, status, start_date, payment_receipt_url)
  VALUES (
    new.id, 
    'pending', 
    CASE 
      WHEN new.raw_user_meta_data->>'start_date' IS NOT NULL THEN (new.raw_user_meta_data->>'start_date')::TIMESTAMP WITH TIME ZONE
      ELSE NULL
    END,
    new.raw_user_meta_data->>'payment_receipt_url'
  );

  -- Create initial pending payment record for auditing history
  IF new.raw_user_meta_data->>'payment_receipt_url' IS NOT NULL THEN
    INSERT INTO public.payments (user_id, amount, payment_date, receipt_url, notes, status)
    VALUES (
      new.id,
      0.00,
      CURRENT_DATE,
      new.raw_user_meta_data->>'payment_receipt_url',
      'Comprobante de registro inicial',
      'pending'
    );
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Row Level Security (RLS) Setup
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Examples of RLS Policies

-- Users Profiles: Users can read their own, Admin can read/write all
CREATE POLICY "Users can view own profile" ON public.users_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users_profiles FOR UPDATE USING (auth.uid() = id);

-- Courses: Anyone authenticated can view active courses (further filtering by subscription logic in app)
CREATE POLICY "Authenticated can view active courses" ON public.courses FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

-- Payments: Users can view and create their own, Admin all
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- News: Public/Auth can view active news
CREATE POLICY "Anyone can view active news" ON public.news_posts FOR SELECT USING (is_active = true);

-- User Contributions: Users can insert and view their own, and view approved ones
CREATE POLICY "Users can insert contributions" ON public.user_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own or approved contributions" ON public.user_contributions FOR SELECT USING (auth.uid() = user_id OR status = 'approved');

-- Notifications: Users view their own or global (user_id IS NULL)
CREATE POLICY "Users can view own or global notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Storage Buckets (Execute in Supabase SQL editor)
-- insert into storage.buckets (id, name, public) values ('payment_receipts', 'payment_receipts', false);
-- insert into storage.buckets (id, name, public) values ('public_assets', 'public_assets', true);
