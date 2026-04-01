import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { parseEmailWebhookPayload } from 'npm:@lovable.dev/email-js'
import { WebhookError, verifyWebhookRequest } from 'npm:@lovable.dev/webhooks-js'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited",
  magiclink: 'Your login link',
  recovery: 'Reset your password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
}

// Template mapping
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

function normalizeEmailType(rawType: unknown): string {
  const value = String(rawType ?? '').toLowerCase().trim()

  if (value === 'magic_link') return 'magiclink'
  if (value === 'email_change_current' || value === 'email_change_new') return 'email_change'

  return value
}

function buildSupabaseConfirmationUrl(payload: any, emailType: string): string {
  const emailData = payload?.email_data ?? {}

  const directUrl =
    emailData?.url ??
    emailData?.confirmation_url ??
    emailData?.action_link ??
    emailData?.verification_url ??
    payload?.url

  if (typeof directUrl === 'string' && directUrl.length > 0) {
    return directUrl
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const tokenHash = emailData?.token_hash ?? emailData?.hashed_token ?? emailData?.token

  if (!supabaseUrl || !tokenHash || !emailType) {
    return ''
  }

  const params = new URLSearchParams({
    token_hash: String(tokenHash),
    type: emailType,
  })

  const redirectTo = emailData?.redirect_to ?? payload?.redirect_to
  if (redirectTo) {
    params.set('redirect_to', String(redirectTo))
  }

  const email = payload?.user?.email ?? emailData?.email
  if (email) {
    params.set('email', String(email))
  }

  return `${supabaseUrl}/auth/v1/verify?${params.toString()}`
}

// Configuration
const SITE_NAME = "SideLine"
const SENDER_DOMAIN = "notify.sidelineassist.club"
const ROOT_DOMAIN = "sidelineassist.club"
const FROM_DOMAIN = "notify.sidelineassist.club" // Domain shown in From address (may be root or sender subdomain)

// Sample data for preview mode ONLY (not used in actual email sending).
// URLs are baked in at scaffold time from the project's real data.
// The sample email uses a fixed placeholder (RFC 6761 .test TLD) so the Go backend
// can always find-and-replace it with the actual recipient when sending test emails,
// even if the project's domain has changed since the template was scaffolded.
const SAMPLE_PROJECT_URL = "https://sideline-assist.lovable.app"
const SAMPLE_EMAIL = "user@example.test"
const SAMPLE_DATA: Record<string, object> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: '123456',
  },
}

// Preview endpoint handler - returns rendered HTML without sending email
async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const authHeader = req.headers.get('Authorization')

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]

  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = SAMPLE_DATA[type] || {}
  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))

  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Webhook handler - verifies signature and sends email
async function handleWebhook(req: Request): Promise<Response> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')

  if (!apiKey) {
    console.error('LOVABLE_API_KEY not configured')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Parse either Lovable-signed webhooks or Supabase Auth-hook calls.
  let run_id = ''
  let emailType = ''
  let recipientEmail = ''
  let confirmationUrl = ''
  let token: string | undefined
  let newEmail: string | undefined

  const hasLovableSignatureHeaders =
    req.headers.has('x-lovable-signature') || req.headers.has('x-lovable-timestamp')

  if (hasLovableSignatureHeaders) {
    let payload: any
    try {
      const verified = await verifyWebhookRequest({
        req,
        secret: apiKey,
        parser: parseEmailWebhookPayload,
      })
      payload = verified.payload
      run_id = payload.run_id
    } catch (error) {
      if (error instanceof WebhookError) {
        switch (error.code) {
          case 'invalid_signature':
          case 'missing_timestamp':
          case 'invalid_timestamp':
          case 'stale_timestamp':
            console.error('Invalid webhook signature', { error: error.message })
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          case 'invalid_payload':
          case 'invalid_json':
            console.error('Invalid webhook payload', { error: error.message })
            return new Response(
              JSON.stringify({ error: 'Invalid webhook payload' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
      }

      console.error('Webhook verification failed', { error })
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!run_id) {
      console.error('Webhook payload missing run_id')
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (payload.version !== '1') {
      console.error('Unsupported payload version', { version: payload.version, run_id })
      return new Response(
        JSON.stringify({ error: `Unsupported payload version: ${payload.version}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    emailType = normalizeEmailType(payload?.data?.action_type)
    recipientEmail = payload?.data?.email
    confirmationUrl = payload?.data?.url
    token = payload?.data?.token
    newEmail = payload?.data?.new_email
  } else {
    if (!hookSecret) {
      console.error('SEND_EMAIL_HOOK_SECRET not configured for Supabase hook auth')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const authorization = req.headers.get('authorization')
    if (authorization !== `Bearer ${hookSecret}`) {
      console.error('Supabase auth hook missing/invalid authorization token')
      return new Response(
        JSON.stringify({ error: 'Hook requires authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    let payload: any
    try {
      payload = await req.json()
    } catch (error) {
      console.error('Invalid Supabase auth hook payload JSON', { error })
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const rawEmailType =
      payload?.email_data?.email_action_type ??
      payload?.email_data?.action_type ??
      payload?.email_action_type ??
      payload?.action_type

    emailType = normalizeEmailType(rawEmailType)
    recipientEmail = payload?.user?.email ?? payload?.email_data?.email ?? ''
    confirmationUrl = buildSupabaseConfirmationUrl(payload, emailType)
    token = payload?.email_data?.token ?? payload?.token
    newEmail = payload?.email_data?.new_email ?? payload?.new_email
    run_id = `supabase-hook-${crypto.randomUUID()}`
  }

  if (!emailType || !recipientEmail) {
    console.error('Webhook payload missing required email fields', {
      emailType,
      hasRecipientEmail: Boolean(recipientEmail),
      run_id,
    })
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (emailType !== 'reauthentication' && !confirmationUrl) {
    console.error('Webhook payload missing confirmation URL', { emailType, run_id })
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  console.log('Received auth event', { emailType, email: recipientEmail, run_id })

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType, run_id })
    return new Response(
      JSON.stringify({ error: `Unknown email type: ${emailType}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Build template props from payload.data (HookData structure)
  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: recipientEmail,
    confirmationUrl,
    token,
    email: recipientEmail,
    newEmail,
  }

  // Render React Email to HTML and plain text
  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), {
    plainText: true,
  })

  // Enqueue email for async processing by the dispatcher (process-email-queue).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const messageId = crypto.randomUUID()

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: recipientEmail,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      run_id,
      message_id: messageId,
      to: recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: EMAIL_SUBJECTS[emailType] || 'Notification',
      html,
      text,
      purpose: 'transactional',
      label: emailType,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue auth email', { error: enqueueError, run_id, emailType })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: recipientEmail,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Auth email enqueued', { emailType, email: recipientEmail, run_id })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Handle CORS preflight for main endpoint
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Route to preview handler for /preview path
  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  // Main webhook handler
  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
