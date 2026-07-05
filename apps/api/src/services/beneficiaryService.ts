// =============================================================================
// Beneficiary Service — saved payout recipients
// =============================================================================

import { supabaseAdmin } from '../utils/supabase.js';
import type { Beneficiary, BeneficiaryType } from '@vpay/types';

export interface CreateBeneficiaryParams {
  user_id: string;
  nickname?: string;
  beneficiary_type: BeneficiaryType;
  account_name?: string;
  account_number?: string;
  bank_name?: string;
  bank_code?: string;
  country?: string;
  currency?: string;
  routing_number?: string;
  swift_code?: string;
  mobile_number?: string;
  mobile_provider?: string;
  crypto_address?: string;
  crypto_network?: string;
}

export interface UpdateBeneficiaryParams {
  nickname?: string;
  is_favourite?: boolean;
}

export class BeneficiaryService {
  async list(userId: string): Promise<Beneficiary[]> {
    const { data, error } = await supabaseAdmin
      .from('beneficiaries')
      .select('*')
      .eq('user_id', userId)
      .order('is_favourite', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as Beneficiary[];
  }

  async create(params: CreateBeneficiaryParams): Promise<Beneficiary> {
    const { data, error } = await supabaseAdmin
      .from('beneficiaries')
      .insert(params)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to create beneficiary: ${error?.message}`);
    return data as Beneficiary;
  }

  async update(id: string, userId: string, params: UpdateBeneficiaryParams): Promise<Beneficiary> {
    const { data, error } = await supabaseAdmin
      .from('beneficiaries')
      .update(params)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) throw new Error('Beneficiary not found');
    return data as Beneficiary;
  }

  async remove(id: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('beneficiaries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  }
}

export const beneficiaryService = new BeneficiaryService();
