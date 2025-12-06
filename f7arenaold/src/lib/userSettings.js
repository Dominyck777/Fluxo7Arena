import { supabase } from '@/lib/supabase';

// Helpers para ler/gravar configurações de UI por usuário/escopo
// scope pode ser algo como 'compras:123' ou 'produtos:123'

export async function getUserUISettings({ userId, scope }) {
  if (!userId || !scope) return null;
  try {
    const { data, error } = await supabase
      .from('user_ui_settings')
      .select('settings')
      .eq('user_id', userId)
      .eq('scope', scope)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[user_ui_settings] getUserUISettings:error', error);
      return null;
    }

    return data?.settings || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[user_ui_settings] getUserUISettings:exception', err);
    return null;
  }
}

export async function saveUserUISettings({ userId, scope, settings }) {
  if (!userId || !scope) return;
  try {
    const payload = {
      user_id: userId,
      scope,
      settings: settings || {},
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_ui_settings')
      .upsert(payload, { onConflict: 'user_id,scope' });

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[user_ui_settings] saveUserUISettings:error', error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[user_ui_settings] saveUserUISettings:exception', err);
  }
}
