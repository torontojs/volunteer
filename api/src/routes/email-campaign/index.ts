import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { sendCommunityNotificationEmail } from '../../email/index.ts';
import { authorizeOrganizer } from '../../middleware/access.ts';
import { authMiddleware } from '../../middleware/auth.ts';
import { bodySizeCheck } from '../../middleware/body-size.ts';
import { getSession } from '../../utils/auth.ts';
import {
	StatusCodes,
	type StatusResponse,
	statusResponseFormatter,
	StatusResponseSchema
} from '../../utils/responses.ts';
import {
	finishCampaign,
	getAudienceOptions,
	getCampaignByIdempotencyKey,
	getRecentCampaigns,
	insertCampaign,
	resolveAudience,
	updateRecipientDelivery
} from './data.ts';
import {
	AudienceOptionsSchema,
	CreateEmailCampaignSchema,
	EmailCampaignPreviewSchema,
	type EmailCampaignStatus,
	EmailCampaignSummarySchema,
	PreviewEmailCampaignSchema
} from './validation.ts';

const MAX_CONCURRENT_EMAILS = 5;
// Each recipient costs ~2 subrequests (send + status write). 400 keeps a campaign
// well under the Worker's 1000-subrequest-per-request limit, so it finishes in one
// request without a queue. Revisit if the community outgrows this.
const MAX_RECIPIENTS_PER_CAMPAIGN = 400;

export const emailCampaignRoutes = new OpenAPIHono<EnvironmentBindings>({
	defaultHook: statusResponseFormatter
});

emailCampaignRoutes.openapi(
	createRoute({
		method: 'get',
		path: '/audience-options',
		operationId: 'List email campaign audience options',
		summary: 'List eligible email recipients and teams',
		description: 'Lists active community members and teams available to organizers when composing an email campaign.',
		tags: ['Email Campaigns'],
		responses: {
			[StatusCodes.OKAY]: {
				description: 'Successful response',
				content: { 'application/json': { schema: AudienceOptionsSchema } }
			},
			[StatusCodes.UNAUTHORIZED]: {
				description: 'Authentication required',
				content: { 'application/json': { schema: StatusResponseSchema } }
			},
			[StatusCodes.FORBIDDEN]: {
				description: 'Organizer access required',
				content: { 'application/json': { schema: StatusResponseSchema } }
			}
		},
		middleware: [authMiddleware, authorizeOrganizer] as const
	}),
	async (context) => context.json(await getAudienceOptions(context.env.Database), StatusCodes.OKAY)
);

emailCampaignRoutes.openapi(
	createRoute({
		method: 'post',
		path: '/preview',
		operationId: 'Preview email campaign audience',
		summary: 'Resolve and preview campaign recipients',
		description: 'Returns the exact deduplicated recipients matching the selected audience and filters.',
		tags: ['Email Campaigns'],
		request: {
			body: { content: { 'application/json': { schema: PreviewEmailCampaignSchema } }, required: true }
		},
		responses: {
			[StatusCodes.OKAY]: {
				description: 'Successful response',
				content: { 'application/json': { schema: EmailCampaignPreviewSchema } }
			},
			[StatusCodes.UNAUTHORIZED]: {
				description: 'Authentication required',
				content: { 'application/json': { schema: StatusResponseSchema } }
			},
			[StatusCodes.FORBIDDEN]: {
				description: 'Organizer access required',
				content: { 'application/json': { schema: StatusResponseSchema } }
			}
		},
		middleware: [bodySizeCheck, authMiddleware, authorizeOrganizer] as const
	}),
	async (context) => {
		const recipients = await resolveAudience(context.env.Database, context.req.valid('json').audience);

		return context.json({
			count: recipients.length,
			recipients: recipients.map(({ id, name, email }) => ({ id, name, email }))
		}, StatusCodes.OKAY);
	}
);

emailCampaignRoutes.openapi(
	createRoute({
		method: 'get',
		path: '/',
		operationId: 'List recent email campaigns',
		summary: 'List recent email campaigns',
		description: 'Lists the twenty most recent community email campaigns.',
		tags: ['Email Campaigns'],
		responses: {
			[StatusCodes.OKAY]: {
				description: 'Successful response',
				content: { 'application/json': { schema: z.object({ data: z.array(EmailCampaignSummarySchema) }) } }
			},
			[StatusCodes.UNAUTHORIZED]: {
				description: 'Authentication required',
				content: { 'application/json': { schema: StatusResponseSchema } }
			},
			[StatusCodes.FORBIDDEN]: {
				description: 'Organizer access required',
				content: { 'application/json': { schema: StatusResponseSchema } }
			}
		},
		middleware: [authMiddleware, authorizeOrganizer] as const
	}),
	async (context) => context.json({ data: await getRecentCampaigns(context.env.Database) }, StatusCodes.OKAY)
);

emailCampaignRoutes.openapi(
	createRoute({
		method: 'post',
		path: '/',
		operationId: 'Send email campaign',
		summary: 'Send a community email campaign',
		description: 'Snapshots the selected recipients, sends an individual email to each one, and stores each result.',
		tags: ['Email Campaigns'],
		request: {
			body: { content: { 'application/json': { schema: CreateEmailCampaignSchema } }, required: true }
		},
		responses: {
			[StatusCodes.CREATED]: {
				description: 'Campaign sent',
				content: { 'application/json': { schema: EmailCampaignSummarySchema } }
			},
			[StatusCodes.OKAY]: {
				description: 'A campaign with the same idempotency key was already submitted',
				content: { 'application/json': { schema: EmailCampaignSummarySchema } }
			},
			[StatusCodes.UNPROCESSABLE_CONTENT]: {
				description: 'No eligible recipients matched the audience',
				content: { 'application/json': { schema: StatusResponseSchema } }
			},
			[StatusCodes.UNAUTHORIZED]: {
				description: 'Authentication required',
				content: { 'application/json': { schema: StatusResponseSchema } }
			},
			[StatusCodes.FORBIDDEN]: {
				description: 'Organizer access required',
				content: { 'application/json': { schema: StatusResponseSchema } }
			}
		},
		middleware: [bodySizeCheck, authMiddleware, authorizeOrganizer] as const
	}),
	async (context) => {
		const data = context.req.valid('json');
		const existingCampaign = await getCampaignByIdempotencyKey(context.env.Database, data.idempotencyKey);

		if (existingCampaign) {
			return context.json(existingCampaign, StatusCodes.OKAY);
		}

		const recipients = await resolveAudience(context.env.Database, data.audience);

		if (recipients.length === 0) {
			return context.json(
				{ message: 'No active community members match the selected audience.' } satisfies StatusResponse,
				StatusCodes.UNPROCESSABLE_CONTENT
			);
		}

		if (recipients.length > MAX_RECIPIENTS_PER_CAMPAIGN) {
			return context.json(
				{ message: `This audience has ${recipients.length} recipients. Please narrow it to ${MAX_RECIPIENTS_PER_CAMPAIGN} or fewer.` } satisfies StatusResponse,
				StatusCodes.UNPROCESSABLE_CONTENT
			);
		}

		const { id: createdBy } = getSession(context);
		const { campaignId, recipients: campaignRecipients } = await insertCampaign(context.env.Database, createdBy, data, recipients);
		let sentCount = 0;
		let failedCount = 0;

		try {
			for (let index = 0; index < campaignRecipients.length; index += MAX_CONCURRENT_EMAILS) {
				const recipientBatch = campaignRecipients.slice(index, index + MAX_CONCURRENT_EMAILS);

				const batchResults = await Promise.all(recipientBatch.map(async (recipient) => {
					let providerMessageId: string | undefined;
					let errorMessage: string | undefined;

					try {
						const response = await sendCommunityNotificationEmail(context, {
							apiKey: context.env.RESEND_API_KEY,
							email: recipient.email,
							message: data.message,
							senderEmail: context.env.SENDER_EMAIL,
							subject: data.subject
						});

						providerMessageId = response.data?.id;
						if (response.error || !providerMessageId) {
							errorMessage = response.error?.message ?? 'Email provider did not return a message ID.';
						}
					} catch (error) {
						errorMessage = error instanceof Error ? error.message : 'Unknown email provider error.';
					}

					// The status write is guarded too: a failed DB update must not abort the whole batch.
					try {
						if (errorMessage) {
							await updateRecipientDelivery(context.env.Database, recipient.id, 'failed', undefined, errorMessage);
							return false;
						}

						await updateRecipientDelivery(context.env.Database, recipient.id, 'sent', providerMessageId);
						return true;
					} catch {
						return false;
					}
				}));

				sentCount += batchResults.filter(Boolean).length;
				failedCount += batchResults.filter((wasSent) => !wasSent).length;
			}
		} finally {
			// Always finalize so a campaign never stays stuck in 'sending', even if the loop throws.
			let status: EmailCampaignStatus = 'partially-failed';
			if (failedCount === 0 && sentCount > 0) {
				status = 'sent';
			} else if (sentCount === 0) {
				status = 'failed';
			}
			await finishCampaign(context.env.Database, campaignId, status, sentCount, failedCount);
		}
		const campaign = await getCampaignByIdempotencyKey(context.env.Database, data.idempotencyKey);

		if (!campaign) {
			throw new Error('Campaign was sent but its summary could not be loaded.');
		}

		return context.json(campaign, StatusCodes.CREATED);
	}
);
