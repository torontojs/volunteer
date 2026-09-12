import { applyD1Migrations, env } from 'cloudflare:test';
import { assert, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
	finishCampaign,
	getAudienceOptions,
	getCampaignByIdempotencyKey,
	insertCampaign,
	resolveAudience,
	updateRecipientDelivery
} from './data.ts';

const DEFAULT_TEAM_ID = 'b3410598-ecbc-41be-9f68-925da74bc613';
const ORGANIZER_ID = '3c5123c0-8548-4a02-a83c-32e9ce67eae8';
const SECOND_TEAM_ID = '70ca1ff2-6ab6-4533-ae79-203f5b08742c';

beforeAll(async () => {
	await applyD1Migrations(env.Database, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
	await env.Database.exec(env.SEED_SQL);
});

describe('Email campaign data', () => {
	test('lists only active audience profiles and active teams', async () => {
		const options = await getAudienceOptions(env.Database);

		expect(options.profiles.length).toBeGreaterThan(0);
		expect(options.teams.length).toBeGreaterThan(0);
		expect(options.profiles.some(({ email }) => email === 'mrs.bun@whizzo.choc')).toBe(false);
		expect(options.profiles.some(({ email }) => email === 'knight.ni@forestsayni.com')).toBe(false);
		expect(options.profiles.every(({ teamIds }) => Array.isArray(teamIds))).toBe(true);
	});

	test('deduplicates people who belong to more than one selected team', async () => {
		const recipients = await resolveAudience(env.Database, {
			mode: 'selected',
			teamIds: [DEFAULT_TEAM_ID, SECOND_TEAM_ID],
			profileIds: [],
			accessLevels: [],
			profileStatuses: []
		});
		const recipientIds = recipients.map(({ id }) => id);

		expect(new Set(recipientIds).size).toBe(recipientIds.length);
	});

	test('narrows recipients using access, status, and location filters', async () => {
		const recipients = await resolveAudience(env.Database, {
			mode: 'all',
			teamIds: [],
			profileIds: [],
			accessLevels: ['volunteer'],
			profileStatuses: ['tos-accepted'],
			isBasedOnGTA: true,
			canJoinLocalEvents: true
		});

		expect(recipients.length).toBeGreaterThan(0);
		expect(recipients.every((profile) =>
			profile.accessLevel === 'volunteer' &&
			profile.profileStatus === 'tos-accepted' &&
			profile.isBasedOnGTA &&
			profile.canJoinLocalEvents
		)).toBe(true);
	});

	test('stores a campaign recipient snapshot and delivery result', async () => {
		const audience = {
			mode: 'selected' as const,
			teamIds: [],
			profileIds: [ORGANIZER_ID],
			accessLevels: [],
			profileStatuses: []
		};
		const recipients = await resolveAudience(env.Database, audience);
		const idempotencyKey = crypto.randomUUID();
		const { campaignId, recipients: campaignRecipients } = await insertCampaign(env.Database, ORGANIZER_ID, {
			subject: 'Test campaign',
			message: 'Test message',
			audience,
			idempotencyKey
		}, recipients);

		expect(campaignRecipients).toHaveLength(1);
		const [campaignRecipient] = campaignRecipients;
		assert(campaignRecipient, 'Campaign recipient should exist.');
		await updateRecipientDelivery(env.Database, campaignRecipient.id, 'sent', 'provider-message-id');
		await finishCampaign(env.Database, campaignId, 'sent', 1, 0);

		const summary = await getCampaignByIdempotencyKey(env.Database, idempotencyKey);
		const recipient = await env.Database.prepare('SELECT email, status, providerMessageId FROM email_campaign_recipient WHERE campaignId = ?')
			.bind(campaignId)
			.first<{ email: string, status: string, providerMessageId: string }>();

		expect(summary).toMatchObject({ id: campaignId, recipientCount: 1, sentCount: 1, failedCount: 0, status: 'sent' });
		expect(recipient).toEqual({
			email: 'king.arthur@camelot.uk',
			status: 'sent',
			providerMessageId: 'provider-message-id'
		});
	});
});
