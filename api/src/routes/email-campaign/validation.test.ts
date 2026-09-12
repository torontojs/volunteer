import { describe, expect, test } from 'vitest';
import { CreateEmailCampaignSchema, EmailCampaignAudienceSchema } from './validation.ts';

const TEAM_ID = '70ca1ff2-6ab6-4533-ae79-203f5b08742c';

describe('Email campaign validation', () => {
	test('accepts all active community members with optional filters', () => {
		const result = EmailCampaignAudienceSchema.safeParse({
			mode: 'all',
			accessLevels: ['volunteer'],
			isBasedOnGTA: true
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.teamIds).toEqual([]);
			expect(result.data.profileIds).toEqual([]);
		}
	});

	test('requires a team or individual for a selected audience', () => {
		const result = EmailCampaignAudienceSchema.safeParse({ mode: 'selected' });

		expect(result.success).toBe(false);
	});

	test('accepts one or more selected teams', () => {
		const result = EmailCampaignAudienceSchema.safeParse({
			mode: 'selected',
			teamIds: [TEAM_ID]
		});

		expect(result.success).toBe(true);
	});

	test('rejects an audience with too many selected ids', () => {
		const profileIds = Array.from({ length: 501 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
		const result = EmailCampaignAudienceSchema.safeParse({ mode: 'selected', profileIds });

		expect(result.success).toBe(false);
	});

	test('requires a subject and message', () => {
		const result = CreateEmailCampaignSchema.safeParse({
			subject: ' ',
			message: '',
			audience: { mode: 'all' },
			idempotencyKey: crypto.randomUUID()
		});

		expect(result.success).toBe(false);
	});

	test('accepts a complete campaign', () => {
		const result = CreateEmailCampaignSchema.safeParse({
			subject: 'Community update',
			message: 'Hello volunteers!',
			audience: { mode: 'selected', teamIds: [TEAM_ID] },
			idempotencyKey: crypto.randomUUID()
		});

		expect(result.success).toBe(true);
	});
});
