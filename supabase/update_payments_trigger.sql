-- Update handle_new_user() trigger function to automatically log the registration receipt inside the payments history table
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile
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
