import { applyD1Migrations, env } from 'cloudflare:test';
import { assert, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type * as EmailModule from '../../email/index.ts';
import { StatusCodes } from '../../utils/responses.ts';

// Force the provider to fail so the delivery/finalize paths are exercised. Local mode
// (ARE_EMAILS_LOCAL_ONLY) otherwise always "succeeds", so failures can't happen without this.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('../../email/index.ts', async (importOriginal) => ({
	...(await importOriginal<typeof EmailModule>()),
	sendCommunityNotificationEmail: sendMock
}));

// Imported after vi.mock so the route picks up the mocked email module.
const { app } = await import('../../index.ts');

const ORGANIZER_ID = '3c5123c0-8548-4a02-a83c-32e9ce67eae8';

beforeAll(async () => {
	await applyD1Migrations(env.Database, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
	await env.Database.exec(env.SEED_SQL);
	const sessionKeys = await env.SessionTokens.list();
	await Promise.all(sessionKeys.keys.map(async ({ name }) => env.SessionTokens.delete(name)));
	sendMock.mockReset();
});

async function signIn(email: string, password: string) {
	const response = await app.request('/api/auth/sign-in', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	}, env);
	const setCookie = response.headers.get('set-cookie');

	expect(response.status).toBe(StatusCodes.OKAY);
	assert(setCookie, 'Sign-in response should include a cookie.');
	const [cookie] = setCookie.split(';');
	assert(cookie, 'Session cookie should exist.');
	return cookie;
}

function sendCampaign(cookie: string, audience: unknown) {
	return app.request('/api/email-campaigns', {
		method: 'POST',
		headers: { 'Cookie': cookie, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			subject: 'Community update',
			message: 'This is a test community notification.',
			audience,
			idempotencyKey: crypto.randomUUID()
		})
	}, env);
}

describe('Email campaign failure handling', () => {
	test('marks a campaign failed (never stuck on sending) when every send fails', async () => {
		sendMock.mockResolvedValue({ data: null, error: { message: 'Simulated provider failure' } });
		const cookie = await signIn('king.arthur@camelot.uk', 'H0lyGr@il42!L0rd');

		const response = await sendCampaign(cookie, { mode: 'selected', profileIds: [ORGANIZER_ID] });
		const campaign = await response.json<{ status: string, sentCount: number, failedCount: number }>();

		expect(response.status).toBe(StatusCodes.CREATED);
		expect(campaign).toMatchObject({ status: 'failed', sentCount: 0, failedCount: 1 });
		expect(campaign.status).not.toBe('sending');
	});

	test('marks a campaign partially-failed when some sends fail', async () => {
		let call = 0;
		sendMock.mockImplementation(() => {
			call += 1;
			return Promise.resolve(
				call % 2 === 0 ?
					{ data: null, error: { message: 'Simulated provider failure' } } :
					{ data: { id: crypto.randomUUID() }, error: null }
			);
		});
		const cookie = await signIn('king.arthur@camelot.uk', 'H0lyGr@il42!L0rd');

		const response = await sendCampaign(cookie, { mode: 'all' });
		const campaign = await response.json<{ status: string, sentCount: number, failedCount: number }>();

		expect(response.status).toBe(StatusCodes.CREATED);
		expect(campaign.status).toBe('partially-failed');
		expect(campaign.sentCount).toBeGreaterThan(0);
		expect(campaign.failedCount).toBeGreaterThan(0);
	});

	test('records a failed recipient even if the provider throws', async () => {
		sendMock.mockRejectedValue(new Error('Network down'));
		const cookie = await signIn('king.arthur@camelot.uk', 'H0lyGr@il42!L0rd');

		const response = await sendCampaign(cookie, { mode: 'selected', profileIds: [ORGANIZER_ID] });
		const campaign = await response.json<{ id: string, status: string }>();
		const recipient = await env.Database
			.prepare('SELECT status, errorMessage FROM email_campaign_recipient WHERE campaignId = ?')
			.bind(campaign.id)
			.first<{ status: string, errorMessage: string }>();

		expect(campaign.status).toBe('failed');
		expect(recipient?.status).toBe('failed');
		expect(recipient?.errorMessage).toBe('Network down');
	});
});
