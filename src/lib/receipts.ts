import { supabase } from './supabase';

/** Acepta rutas nuevas y URLs públicas históricas del mismo bucket. */
export function receiptPath(value: string): string {
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    const base = new URL(supabase.storage.from('payment_receipts').getPublicUrl('').data.publicUrl);
    const prefix = '/storage/v1/object/public/payment_receipts/';
    if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) {
      throw new Error('El comprobante no pertenece al almacenamiento de Legacy Academy.');
    }
    path = decodeURIComponent(url.pathname.slice(prefix.length));
  }
  if (!path || path.startsWith('/') || path.split('/').some(part => !part || part === '..' || part === '.')) {
    throw new Error('Ruta de comprobante no válida.');
  }
  return path;
}

export async function signedReceiptUrl(value: string): Promise<string> {
  const { data, error } = await supabase.storage.from('payment_receipts')
    .createSignedUrl(receiptPath(value), 120);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No se pudo abrir el comprobante.');
  return data.signedUrl;
}
