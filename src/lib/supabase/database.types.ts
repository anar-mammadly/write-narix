// Hand-authored to match supabase/migrations/*.sql. Once a real Supabase
// project exists, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
// and reconcile any drift.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "user";
export type PriceType = "fixed" | "percentage";
export type DiscountType = "member" | "early_order" | "referral" | "promo";
export type ReferralStatus = "pending_approval" | "approved" | "rejected";
export type ReferralBenefitType = "referrer_reward" | "referred_discount";
export type ReferralBenefitStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "consumed"
  | "expired";
export type FileCategory =
  | "client_upload"
  | "admin_request"
  | "working_file"
  | "final_delivery"
  | "revision";
export type RequestStatus = "pending" | "fulfilled" | "cancelled";
export type PaymentRequestStatus = "pending" | "paid" | "cancelled";

interface Table<Row, Insert, Update = Partial<Insert>> {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          full_name: string | null;
          phone: string | null;
          university: string | null;
          academic_level: string | null;
          country: string | null;
          language: string | null;
          timezone: string | null;
          role: UserRole;
          email_verified: boolean;
          referral_code: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          university?: string | null;
          country?: string | null;
          language?: string | null;
          timezone?: string | null;
          academic_level?: string | null;
          role?: UserRole;
        }
      >;
      site_settings: Table<
        { key: string; value: Json; updated_at: string; updated_by: string | null },
        { key: string; value: Json }
      >;
      service_categories: Table<
        {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          display_order: number;
          is_active: boolean;
          translations: Json;
          created_at: string;
          updated_at: string;
        },
        { name: string; slug: string; description?: string | null; display_order?: number; is_active?: boolean }
      >;
      services: Table<
        {
          id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          display_order: number;
          is_active: boolean;
          translations: Json;
          created_at: string;
          updated_at: string;
        },
        { category_id?: string | null; name: string; slug: string; description?: string | null; display_order?: number; is_active?: boolean }
      >;
      academic_levels: Table<
        { id: string; name: string; slug: string; display_order: number; is_active: boolean; translations: Json; created_at: string; updated_at: string },
        { name: string; slug: string; display_order?: number; is_active?: boolean }
      >;
      deadline_options: Table<
        {
          id: string;
          label: string;
          duration_hours: number;
          multiplier: number;
          fixed_fee: number;
          display_order: number;
          is_active: boolean;
          translations: Json;
          created_at: string;
          updated_at: string;
        },
        { label: string; duration_hours: number; multiplier?: number; fixed_fee?: number; display_order?: number; is_active?: boolean }
      >;
      word_count_options: Table<
        {
          id: string;
          label: string;
          word_count: number;
          page_count: number;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        { label: string; word_count: number; page_count: number; display_order?: number; is_active?: boolean }
      >;
      languages: Table<
        { id: string; name: string; code: string; extra_fee: number; display_order: number; is_active: boolean; translations: Json; created_at: string; updated_at: string },
        { name: string; code: string; extra_fee?: number; display_order?: number; is_active?: boolean }
      >;
      citation_styles: Table<
        { id: string; name: string; extra_fee: number; display_order: number; is_active: boolean; created_at: string; updated_at: string },
        { name: string; extra_fee?: number; display_order?: number; is_active?: boolean }
      >;
      additional_services: Table<
        {
          id: string;
          name: string;
          description: string | null;
          price_type: PriceType;
          price_value: number;
          is_plagiarism_addon: boolean;
          display_order: number;
          is_active: boolean;
          translations: Json;
          created_at: string;
          updated_at: string;
        },
        { name: string; description?: string | null; price_type: PriceType; price_value: number; display_order?: number; is_active?: boolean }
      >;
      pricing_rules: Table<
        {
          id: string;
          service_id: string;
          academic_level_id: string;
          base_price: number;
          price_per_page: number;
          price_per_word: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        { service_id: string; academic_level_id: string; base_price: number; price_per_page?: number; price_per_word?: number; is_active?: boolean }
      >;
      service_pricing_rules: Table<
        {
          service_id: string;
          pricing_type: "progressive" | "per_page";
          base_pages: number | null;
          base_mode: "flat" | "linear" | null;
          base_price: number | null;
          additional_page_price: number | null;
          price_per_page: number | null;
          minimum_pages: number | null;
          updated_at: string;
        },
        {
          service_id: string;
          pricing_type: "progressive" | "per_page";
          base_pages?: number | null;
          base_mode?: "flat" | "linear" | null;
          base_price?: number | null;
          additional_page_price?: number | null;
          price_per_page?: number | null;
          minimum_pages?: number | null;
        }
      >;
      service_deadline_options: Table<
        {
          service_id: string;
          deadline_option_id: string;
          surcharge_percent: number;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          service_id: string;
          deadline_option_id: string;
          surcharge_percent?: number;
          is_default?: boolean;
        }
      >;
      order_statuses: Table<
        {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          color: string;
          icon: string | null;
          display_order: number;
          is_active: boolean;
          is_terminal: boolean;
          created_at: string;
          updated_at: string;
        },
        { name: string; slug: string; description?: string | null; color?: string; icon?: string | null; display_order?: number; is_active?: boolean; is_terminal?: boolean }
      >;
      orders: Table<
        {
          id: string;
          order_number: string;
          user_id: string | null;
          guest_name: string | null;
          guest_email: string | null;
          guest_phone: string | null;
          guest_token_hash: string | null;
          claimed_at: string | null;
          service_id: string;
          academic_level_id: string;
          deadline_option_id: string;
          word_count_option_id: string | null;
          word_count: number | null;
          page_count: number | null;
          language_id: string | null;
          citation_style_id: string | null;
          subject: string | null;
          topic: string | null;
          description: string | null;
          university: string | null;
          college: string | null;
          base_price: number;
          discount_source: DiscountType | null;
          discount_percentage: number;
          discount_amount: number;
          final_price: number;
          reviewed_price: number | null;
          original_price: number | null;
          paid_amount: number;
          remaining_amount: number;
          is_fully_paid: boolean;
          status_id: string;
          assigned_to: string | null;
          locked: boolean;
          created_at: string;
          updated_at: string;
        },
        never,
        { status_id?: string; assigned_to?: string | null }
      >;
      order_pricing_snapshots: Table<
        { id: string; order_id: string; snapshot: Json; config_version: string; created_at: string },
        never
      >;
      order_additional_services: Table<
        { order_id: string; additional_service_id: string; name_at_order: string; price_at_order: number },
        never
      >;
      order_status_history: Table<
        {
          id: string;
          order_id: string;
          from_status_id: string | null;
          to_status_id: string;
          changed_by: string | null;
          note: string | null;
          created_at: string;
        },
        never
      >;
      order_requests: Table<
        {
          id: string;
          order_id: string;
          title: string;
          description: string | null;
          requires_file: boolean;
          due_date: string | null;
          status: RequestStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        { order_id: string; title: string; description?: string | null; requires_file?: boolean; due_date?: string | null; created_by?: string | null },
        { status?: RequestStatus }
      >;
      files: Table<
        {
          id: string;
          order_id: string;
          uploaded_by: string | null;
          category: FileCategory;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          order_request_id: string | null;
          created_at: string;
        },
        {
          order_id: string;
          uploaded_by?: string | null;
          category: FileCategory;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          order_request_id?: string | null;
        }
      >;
      messages: Table<
        {
          id: string;
          order_id: string;
          sender_id: string | null;
          sender_is_admin: boolean;
          body: string | null;
          attachment_file_id: string | null;
          read_at: string | null;
          created_at: string;
        },
        { order_id: string; sender_id?: string | null; sender_is_admin?: boolean; body?: string | null; attachment_file_id?: string | null },
        { read_at?: string | null }
      >;
      payment_requests: Table<
        {
          id: string;
          order_id: string;
          amount: number;
          description: string | null;
          due_date: string | null;
          status: PaymentRequestStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        { order_id: string; amount: number; description?: string | null; due_date?: string | null; created_by?: string | null },
        { status?: PaymentRequestStatus }
      >;
      payments: Table<
        {
          id: string;
          order_id: string;
          payment_request_id: string | null;
          amount: number;
          method: string | null;
          note: string | null;
          recorded_by: string;
          paid_at: string;
          created_at: string;
        },
        { order_id: string; payment_request_id?: string | null; amount: number; method?: string | null; note?: string | null; recorded_by: string; paid_at?: string }
      >;
      notifications: Table<
        {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          related_order_id: string | null;
          is_read: boolean;
          created_at: string;
        },
        never,
        { is_read?: boolean }
      >;
      discounts: Table<
        {
          id: string;
          type: DiscountType;
          name: string;
          percentage: number | null;
          fixed_amount: number | null;
          active: boolean;
          start_date: string | null;
          end_date: string | null;
          usage_limit: number | null;
          minimum_order: number | null;
          maximum_discount: number | null;
          conditions: Json;
          created_at: string;
          updated_at: string;
        },
        { type: DiscountType; name: string; percentage?: number | null; fixed_amount?: number | null; active?: boolean; start_date?: string | null; end_date?: string | null; minimum_order?: number | null; maximum_discount?: number | null }
      >;
      promo_codes: Table<
        {
          id: string;
          code: string;
          discount_id: string;
          max_total_uses: number;
          current_uses: number;
          active: boolean;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
        },
        { code: string; discount_id: string; max_total_uses?: number; active?: boolean; expires_at?: string | null; created_by?: string | null }
      >;
      referral_codes: Table<
        {
          id: string;
          code: string;
          owner_user_id: string | null;
          max_total_uses: number;
          current_uses: number;
          active: boolean;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
        },
        { code: string; owner_user_id?: string | null; max_total_uses?: number; active?: boolean; expires_at?: string | null; created_by?: string | null }
      >;
      referrals: Table<
        {
          id: string;
          referral_code_id: string;
          referrer_user_id: string;
          referred_user_id: string;
          order_id: string;
          status: ReferralStatus;
          approved_by: string | null;
          approved_at: string | null;
          rejected_reason: string | null;
          created_at: string;
        },
        never
      >;
      referral_benefits: Table<
        {
          id: string;
          referral_id: string;
          beneficiary_user_id: string;
          benefit_type: ReferralBenefitType;
          percentage: number;
          status: ReferralBenefitStatus;
          approved_by: string | null;
          approved_at: string | null;
          consumed_order_id: string | null;
          consumed_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        },
        never
      >;
      promo_code_requests: Table<
        {
          id: string;
          promo_code_id: string;
          order_id: string;
          user_id: string | null;
          percentage: number | null;
          status: ReferralStatus;
          approved_by: string | null;
          approved_at: string | null;
          rejected_reason: string | null;
          created_at: string;
        },
        never
      >;
      discount_applications: Table<
        {
          id: string;
          order_id: string;
          discount_source: DiscountType;
          reference_id: string | null;
          percentage_considered: number;
          amount_considered: number;
          applied: boolean;
          reason: string | null;
          created_at: string;
        },
        never
      >;
      faqs: Table<
        { id: string; question: string; answer: string; display_order: number; is_active: boolean; translations: Json; created_at: string; updated_at: string },
        { question: string; answer: string; display_order?: number; is_active?: boolean; translations?: Json }
      >;
      samples: Table<
        {
          id: string;
          title: string;
          service_id: string | null;
          academic_level_id: string | null;
          excerpt: string | null;
          file_id: string | null;
          display_order: number;
          is_active: boolean;
          translations: Json;
          created_at: string;
          updated_at: string;
        },
        { title: string; service_id?: string | null; academic_level_id?: string | null; excerpt?: string | null; display_order?: number; is_active?: boolean }
      >;
      testimonials: Table<
        {
          id: string;
          author_name: string;
          author_context: string | null;
          quote: string;
          rating: number | null;
          display_order: number;
          is_active: boolean;
          translations: Json;
          created_at: string;
          updated_at: string;
        },
        { author_name: string; author_context?: string | null; quote: string; rating?: number | null; display_order?: number; is_active?: boolean }
      >;
      pages: Table<
        { id: string; slug: string; title: string; content: Json; translations: Json; is_active: boolean; updated_at: string },
        { slug: string; title: string; content?: Json; is_active?: boolean }
      >;
      email_templates: Table<
        { id: string; key: string; subject: string; body_html: string; body_text: string | null; updated_at: string },
        { key: string; subject: string; body_html: string; body_text?: string | null },
        { subject?: string; body_html?: string; body_text?: string | null }
      >;
      notification_jobs: Table<
        {
          id: string;
          channel: "in_app" | "email";
          event_type: string;
          idempotency_key: string;
          recipient_email: string | null;
          recipient_user_id: string | null;
          template_key: string | null;
          payload: Json;
          status: "pending" | "processing" | "sent" | "failed";
          attempts: number;
          max_attempts: number;
          next_attempt_at: string;
          last_error: string | null;
          sent_at: string | null;
          created_at: string;
        },
        never,
        { status?: "pending" | "processing" | "sent" | "failed"; attempts?: number; next_attempt_at?: string; last_error?: string | null; sent_at?: string | null }
      >;
      audit_logs: Table<
        {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before: Json | null;
          after: Json | null;
          created_at: string;
        },
        never
      >;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      owns_order: { Args: { target_order_id: string }; Returns: boolean };
      preview_price: {
        Args: {
          p_service_id: string;
          p_academic_level_id: string;
          p_deadline_option_id: string;
          p_word_count: number | null;
          p_page_count: number | null;
          p_language_id: string | null;
          p_citation_style_id: string | null;
          p_additional_service_ids: string[] | null;
          p_promo_code: string | null;
        };
        Returns: Json;
      };
      validate_promo_code: { Args: { p_code: string }; Returns: Json };
      create_order: { Args: { p_payload: Json }; Returns: Json };
      get_order_by_token: { Args: { p_token: string }; Returns: Json };
      claim_guest_order: { Args: { p_order_number: string; p_token: string }; Returns: Json };
      approve_referral: { Args: { p_referral_id: string }; Returns: Json };
      reject_referral: { Args: { p_referral_id: string; p_reason: string | null }; Returns: Json };
      approve_referral_with_percentage: { Args: { p_referral_id: string; p_percentage: number }; Returns: Json };
      approve_promo_request: { Args: { p_request_id: string; p_percentage: number }; Returns: Json };
      reject_promo_request: { Args: { p_request_id: string; p_reason: string | null }; Returns: Json };
      change_order_status: { Args: { p_order_id: string; p_new_status_id: string; p_note: string | null }; Returns: Json };
      unlock_order: { Args: { p_order_id: string }; Returns: void };
      get_order_contact: { Args: { p_order_id: string }; Returns: Json };
      set_order_reviewed_price: { Args: { p_order_id: string; p_amount: number }; Returns: Json };
    };
  };
}
