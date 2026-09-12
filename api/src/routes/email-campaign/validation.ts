import { z } from 'zod';
import { LONG_TEXT_SIZE_IN_CHAR } from '../../middleware/body-size.ts';
import { AccessLevelSchema } from '../../utils/auth.ts';
import { IdSchema } from '../../utils/db.ts';
import { ProfileStatusSchema } from '../auth/validation.ts';
import { ProfileSchema } from '../profile/validation.ts';

const SUBJECT_MAX_LENGTH = 200;
// Bounds the SQL `IN (...)` clause built from these arrays; a normal UI selection never approaches this.
const MAX_AUDIENCE_IDS = 500;

export const EmailCampaignAudienceSchema = z.object({
	mode: z.enum(['all', 'selected']),
	teamIds: z.array(IdSchema).max(MAX_AUDIENCE_IDS).default([]),
	profileIds: z.array(IdSchema).max(MAX_AUDIENCE_IDS).default([]),
	accessLevels: z.array(AccessLevelSchema).default([]),
	profileStatuses: z.array(ProfileStatusSchema).default([]),
	isBasedOnGTA: z.boolean().optional(),
	canJoinLocalEvents: z.boolean().optional()
}).refine(
	({ mode, profileIds, teamIds }) => mode === 'all' || profileIds.length > 0 || teamIds.length > 0,
	{ message: 'Select at least one team or individual volunteer.', path: ['mode'] }
);

export type EmailCampaignAudience = z.infer<typeof EmailCampaignAudienceSchema>;

export const PreviewEmailCampaignSchema = z.object({ audience: EmailCampaignAudienceSchema });

export const CreateEmailCampaignSchema = z.object({
	subject: z.string().trim().min(1, 'Subject is required.').max(SUBJECT_MAX_LENGTH),
	message: z.string().trim().min(1, 'Message is required.').max(LONG_TEXT_SIZE_IN_CHAR),
	audience: EmailCampaignAudienceSchema,
	idempotencyKey: z.uuid()
});

export type CreateEmailCampaign = z.infer<typeof CreateEmailCampaignSchema>;

export const AudienceProfileSchema = z.object({
	id: IdSchema,
	name: ProfileSchema.shape.name,
	email: ProfileSchema.shape.email,
	accessLevel: AccessLevelSchema,
	profileStatus: ProfileStatusSchema,
	isBasedOnGTA: z.boolean(),
	canJoinLocalEvents: z.boolean(),
	teamIds: z.array(IdSchema)
});

export type AudienceProfile = z.infer<typeof AudienceProfileSchema>;

export const AudienceTeamSchema = z.object({
	id: IdSchema,
	name: z.string(),
	memberCount: z.number().int().nonnegative()
});

export const AudienceOptionsSchema = z.object({
	profiles: z.array(AudienceProfileSchema),
	teams: z.array(AudienceTeamSchema)
});

export const EmailCampaignPreviewSchema = z.object({
	count: z.number().int().nonnegative(),
	recipients: z.array(AudienceProfileSchema.pick({ id: true, name: true, email: true }))
});

export const EmailCampaignStatusSchema = z.enum(['sending', 'sent', 'partially-failed', 'failed']);

export type EmailCampaignStatus = z.infer<typeof EmailCampaignStatusSchema>;

export const EmailCampaignSummarySchema = z.object({
	id: IdSchema,
	subject: z.string(),
	status: EmailCampaignStatusSchema,
	recipientCount: z.number().int().nonnegative(),
	sentCount: z.number().int().nonnegative(),
	failedCount: z.number().int().nonnegative(),
	insertedAt: z.iso.datetime({ offset: true }),
	sentAt: z.iso.datetime({ offset: true }).nullable().optional(),
	createdByName: z.string()
});

export type EmailCampaignSummary = z.infer<typeof EmailCampaignSummarySchema>;
