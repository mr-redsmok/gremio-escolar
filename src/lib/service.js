import { isSupabaseConfigured } from './supabase.js'
import * as demoService from './demoService.js'
import * as supabaseService from './supabaseService.js'

const demoPorEnv = String(import.meta.env.VITE_DEMO ?? '').toLowerCase() === 'true'

export const serviceMode = demoPorEnv
  ? 'demo'
  : isSupabaseConfigured
    ? 'supabase'
    : 'unconfigured'

export const isDemo = serviceMode === 'demo'
export const isConfigured = serviceMode !== 'unconfigured'

export const service =
  serviceMode === 'demo'
    ? demoService
    : serviceMode === 'supabase'
      ? supabaseService
      : null
