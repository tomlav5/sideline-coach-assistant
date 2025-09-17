import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Button,
  Img,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface ConfirmationEmailProps {
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
  user_name?: string
}

export const ConfirmationEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
  user_name = 'Coach',
}: ConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to SideLine - Confirm your email to get started</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <div style={logoContainer}>
            <Text style={logoText}>⚽ SideLine</Text>
          </div>
          <Text style={tagline}>Football coaching made simple</Text>
        </Section>

        {/* Main Content */}
        <Section style={content}>
          <Heading style={h1}>Welcome to SideLine!</Heading>
          
          <Text style={text}>
            Hi {user_name},
          </Text>
          
          <Text style={text}>
            Thank you for joining SideLine! We're excited to help you manage your teams, 
            track matches, and analyze player performance like never before.
          </Text>

          <Text style={text}>
            To get started, please confirm your email address by clicking the button below:
          </Text>

          <Section style={buttonContainer}>
            <Button
              href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
              style={button}
            >
              Confirm Email Address
            </Button>
          </Section>

          <Text style={text}>
            Or copy and paste this link into your browser:
          </Text>
          
          <Text style={linkText}>
            {`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`}
          </Text>

          <Section style={features}>
            <Text style={featuresTitle}>What you can do with SideLine:</Text>
            <Text style={featureItem}>✅ Manage multiple teams and players</Text>
            <Text style={featureItem}>⚽ Track live match events and substitutions</Text>
            <Text style={featureItem}>📊 Generate detailed player and team reports</Text>
            <Text style={featureItem}>📱 Access everything from your mobile device</Text>
          </Section>
        </Section>

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            If you didn't create an account with SideLine, you can safely ignore this email.
          </Text>
          <Text style={footerText}>
            <Link href="#" style={footerLink}>
              SideLine Team
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ConfirmationEmail

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const header = {
  backgroundColor: '#22c55e',
  padding: '20px 0',
  textAlign: 'center' as const,
}

const logoContainer = {
  margin: '0 auto',
}

const logoText = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0',
  textAlign: 'center' as const,
}

const tagline = {
  color: '#ffffff',
  fontSize: '16px',
  margin: '8px 0 0 0',
  textAlign: 'center' as const,
}

const content = {
  padding: '40px 48px',
}

const h1 = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
}

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#22c55e',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
}

const linkText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '16px 0',
  wordBreak: 'break-all' as const,
}

const features = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '24px',
  margin: '32px 0',
}

const featuresTitle = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 16px 0',
}

const featureItem = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
}

const footer = {
  borderTop: '1px solid #e5e7eb',
  padding: '20px 48px',
  textAlign: 'center' as const,
}

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '8px 0',
}

const footerLink = {
  color: '#22c55e',
  textDecoration: 'none',
}