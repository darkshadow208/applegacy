-- 1. Alter users_profiles table
ALTER TABLE public.users_profiles
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS telegram VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;

-- 2. Alter subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;

-- 3. Alter user_contributions table
ALTER TABLE public.user_contributions
ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'General';

-- 4. Add pending_renewal to subscription_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'subscription_status' AND e.enumlabel = 'pending_renewal') THEN
        ALTER TYPE subscription_status ADD VALUE 'pending_renewal';
    END IF;
END
$$;

-- 5. Update the handle_new_user trigger
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
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
