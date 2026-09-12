import { expect, test } from '@playwright/test';

const teamId = '22222222-2222-4222-8222-222222222222';
const profileId = '11111111-1111-4111-8111-111111111111';

const audienceOptions = {
	profiles: [{
		id: profileId,
		name: 'Ada Lovelace',
		email: 'ada@example.com',
		accessLevel: 'volunteer',
		profileStatus: 'profile-completed',
		isBasedOnGTA: true,
		canJoinLocalEvents: true,
		teamIds: [teamId]
	}],
	teams: [{ id: teamId, name: 'Website Team', memberCount: 1 }]
};

test.beforeEach(async ({ page }) => {
	await page.route('**/api/auth/heartbeat', async (route) =>
		route.fulfill({
			json: {
				access: 'organizer',
				status: 'profile-completed'
			}
		}));
});

test('organizers can select, preview, confirm, and send an email notification', async ({ page }) => {
	let submittedCampaign: Record<string, unknown> | undefined;

	await page.route('**/api/email-campaigns/audience-options', async (route) => route.fulfill({ json: audienceOptions }));
	await page.route('**/api/email-campaigns/preview', async (route) =>
		route.fulfill({
			json: { count: 1, recipients: [{ id: profileId, name: 'Ada Lovelace', email: 'ada@example.com' }] }
		}));
	await page.route('**/api/email-campaigns', async (route) => {
		if (route.request().method() === 'GET') {
			await route.fulfill({ json: { data: [] } });
			return;
		}

		submittedCampaign = route.request().postDataJSON() as Record<string, unknown>;
		await route.fulfill({
			status: 201,
			json: {
				id: crypto.randomUUID(),
				subject: 'Volunteer update',
				status: 'sent',
				recipientCount: 1,
				sentCount: 1,
				failedCount: 0,
				insertedAt: new Date().toISOString(),
				sentAt: new Date().toISOString(),
				createdByName: 'Organizer'
			}
		});
	});

	await page.goto('/pages/notifications/');
	await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible();
	await page.getByLabel('Subject').fill('Volunteer update');
	await page.getByLabel('Email message').fill('Please review this community update.');
	await page.getByLabel('Selected teams and individuals').check();
	await page.getByLabel(/Website Team/u).check();
	await page.getByLabel(/Ada Lovelace/u).check();
	await page.getByLabel('Volunteer', { exact: true }).check();
	await page.getByRole('button', { name: 'Preview audience' }).click();

	await expect(page.getByText('1 eligible recipient')).toBeVisible();
	await expect(page.getByLabel('Preview and send').getByText('ada@example.com')).toBeVisible();
	await page.getByLabel(/I have reviewed the audience/u).check();
	await page.getByRole('button', { name: 'Send notification to 1' }).click();

	await expect(page.getByText('1 sent.')).toBeVisible();
	expect(submittedCampaign).toMatchObject({
		subject: 'Volunteer update',
		message: 'Please review this community update.',
		audience: {
			mode: 'selected',
			teamIds: [teamId],
			profileIds: [profileId],
			accessLevels: ['volunteer']
		}
	});
});

test('volunteers see the protected notifications page without campaign controls', async ({ page }) => {
	await page.route('**/api/auth/heartbeat', async (route) =>
		route.fulfill({
			json: {
				access: 'volunteer',
				status: 'profile-completed'
			}
		}));

	await page.goto('/pages/notifications/');

	await expect(page.getByRole('heading', { name: 'Email notifications' })).toBeVisible();
	await expect(page.getByText(/only be created by organizers and administrators/u)).toBeVisible();
	await expect(page.getByRole('button', { name: /send notification/iu })).toHaveCount(0);
});
