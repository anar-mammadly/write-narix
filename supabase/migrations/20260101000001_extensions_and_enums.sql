-- Narix Academy — extensions and enum types
create extension if not exists pgcrypto;

create type user_role as enum ('admin', 'user');
create type price_type as enum ('fixed', 'percentage');
create type discount_type as enum ('member', 'early_order', 'referral', 'promo');
create type referral_status as enum ('pending_approval', 'approved', 'rejected');
create type referral_benefit_type as enum ('referrer_reward', 'referred_discount');
create type referral_benefit_status as enum ('pending_approval', 'approved', 'rejected', 'consumed', 'expired');
create type file_category as enum ('client_upload', 'admin_request', 'working_file', 'final_delivery', 'revision');
create type request_status as enum ('pending', 'fulfilled', 'cancelled');
create type payment_request_status as enum ('pending', 'paid', 'cancelled');
create type notification_channel as enum ('in_app', 'email');
create type job_status as enum ('pending', 'processing', 'sent', 'failed');
