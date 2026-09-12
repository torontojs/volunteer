import type { Context } from 'hono';
import { type CreateEmailResponse, Resend } from 'resend';
import { generateCommunityNotificationHtml } from './templates/community-notification.ts';

interface EmailSendingParams {
	apiKey: string;
	from: string;
	to: string;
	subject: string;
	html: string;
	text?: string;
}

export async function sendEmail(context: Context<EnvironmentBindings>, { apiKey, from, to, subject, text, html }: EmailSendingParams) {
	if (context.env.ARE_EMAILS_LOCAL_ONLY === 'true') {
		/* eslint-disable no-console */
		console.log(`[📨] You got mail!`);
		console.log({ from, to, subject, html, text });
		/* eslint-enable no-console */

		return {
			data: { id: crypto.randomUUID() },
			error: null
		} satisfies CreateEmailResponse;
	}

	const resend = new Resend(apiKey);
	const emailResponse = await resend.emails.send({ from, to, subject, text, html });

	return emailResponse;
}

const HTML_ENTITIES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#039;'
};

function escapeHtml(value: string) {
	return value.replace(/[&<>"']/gu, (character) => HTML_ENTITIES[character] ?? character);
}

interface CommunityNotificationEmailParams {
	email: string;
	message: string;
	apiKey: string;
	senderEmail: string;
	subject: string;
}

export async function sendCommunityNotificationEmail(context: Context<EnvironmentBindings>, {
	email,
	message,
	apiKey,
	senderEmail,
	subject
}: CommunityNotificationEmailParams) {
	const escapedMessage = escapeHtml(message).replace(/\n/gu, '<br>');
	const logoUrl = new URL('/torontojs-logo.png', context.env.FRONTEND_URL).toString();

	return sendEmail(context, {
		apiKey,
		from: senderEmail,
		to: email,
		subject,
		text: message,
		html: generateCommunityNotificationHtml(logoUrl, escapeHtml(subject), escapedMessage)
	});
}

interface AccountConfirmationEmailParams {
	token: string;
	email: string;
	apiKey: string;
	senderEmail: string;
}

export async function sendAccountConfirmationEmail(context: Context<EnvironmentBindings>, {
	token,
	email,
	apiKey,
	senderEmail
}: AccountConfirmationEmailParams) {
	const activationUrl = new URL(`/pages/confirm-account/?token=${token}`, context.env.FRONTEND_URL).toString();

	return sendEmail(context, {
		apiKey,
		from: senderEmail,
		to: email,
		subject: '[TorontoJS] Confirm your account',
		text: `You are now one of us!\n\nPlease activate your account by visiting: ${activationUrl}`,
		html: `
			<h2>You are now one of us!</h2>
			<p>Please activate your account by visiting the link below</p>
			<p><a href="${activationUrl}">${activationUrl}</a></p>
		`
	});
}

interface PasswordResetEmailParams {
	token: string;
	email: string;
	apiKey: string;
	senderEmail: string;
}

export async function sendPasswordResetEmail(context: Context<EnvironmentBindings>, {
	token,
	email,
	apiKey,
	senderEmail
}: PasswordResetEmailParams) {
	const resetUrl = new URL(`/pages/reset-password?token=${token}`, context.env.FRONTEND_URL).toString();

	return sendEmail(context, {
		apiKey,
		from: senderEmail,
		to: email,
		subject: '[TorontoJS] Reset your password',
		text: `You requested a password reset.\n\nPlease reset your password by visiting: ${resetUrl}`,
		html: `
			<h2>You requested a password reset</h2>
			<p>Please reset your password by visiting the link below</p>
			<p><a href="${resetUrl}">${resetUrl}</a></p>
		`
	});
}
