import { DBTables, generateBaseDBfields } from '../../utils/db.ts';
import type {
	AudienceProfile,
	CreateEmailCampaign,
	EmailCampaignAudience,
	EmailCampaignStatus,
	EmailCampaignSummary
} from './validation.ts';

type DatabaseAudienceProfile = Omit<AudienceProfile, 'canJoinLocalEvents' | 'isBasedOnGTA' | 'teamIds'> & {
	canJoinLocalEvents: number,
	isBasedOnGTA: number,
	teamIds: string
};

export interface CampaignRecipient {
	id: string;
	profileId: string;
	email: string;
	name: string;
}

const ERROR_MESSAGE_MAX_LENGTH = 1000;

function transformAudienceProfile(profile: DatabaseAudienceProfile): AudienceProfile {
	return {
		...profile,
		canJoinLocalEvents: Boolean(profile.canJoinLocalEvents),
		isBasedOnGTA: Boolean(profile.isBasedOnGTA),
		teamIds: JSON.parse(profile.teamIds) as string[]
	};
}

const audienceProfileSelect = `
	SELECT
		profile.id,
		profile.name,
		access.email,
		access.accessLevel,
		access.profileStatus,
		profile.isBasedOnGTA,
		profile.canJoinLocalEvents,
		(
			SELECT json_group_array(role.teamId)
			FROM ${DBTables.ROLE} AS role
			INNER JOIN ${DBTables.TEAM} AS team ON team.id = role.teamId
			WHERE
				role.profileId = profile.id
				AND role.deletedAt IS NULL
				AND team.deletedAt IS NULL
		) AS teamIds
	FROM ${DBTables.PROFILE} AS profile
	INNER JOIN ${DBTables.ACCESS} AS access ON access.id = profile.id
`;

export async function getAudienceOptions(database: D1Database) {
	const [profilesResult, teamsResult] = await database.batch([
		database.prepare(`
			${audienceProfileSelect}
			WHERE access.activatedAt IS NOT NULL AND access.deletedAt IS NULL
			ORDER BY profile.name COLLATE NOCASE
		`),
		database.prepare(`
			SELECT
				team.id,
				team.name,
				COUNT(DISTINCT CASE
					WHEN role.deletedAt IS NULL AND access.activatedAt IS NOT NULL AND access.deletedAt IS NULL
					THEN role.profileId
				END) AS memberCount
			FROM ${DBTables.TEAM} AS team
			LEFT JOIN ${DBTables.ROLE} AS role ON role.teamId = team.id
			LEFT JOIN ${DBTables.ACCESS} AS access ON access.id = role.profileId
			WHERE team.deletedAt IS NULL
			GROUP BY team.id, team.name
			ORDER BY team.name COLLATE NOCASE
		`)
	]);

	return {
		profiles: (profilesResult?.results as DatabaseAudienceProfile[] | undefined ?? []).map(transformAudienceProfile),
		teams: teamsResult?.results as { id: string, name: string, memberCount: number }[] | undefined ?? []
	};
}

function placeholders(values: unknown[]) {
	return new Array(values.length).fill('?').join(', ');
}

export async function resolveAudience(database: D1Database, audience: EmailCampaignAudience): Promise<AudienceProfile[]> {
	const whereClauses = [
		'access.activatedAt IS NOT NULL',
		'access.deletedAt IS NULL'
	];
	const bindings: unknown[] = [];

	if (audience.mode === 'selected') {
		const selectedClauses: string[] = [];

		if (audience.profileIds.length > 0) {
			selectedClauses.push(`profile.id IN (${placeholders(audience.profileIds)})`);
			bindings.push(...audience.profileIds);
		}

		if (audience.teamIds.length > 0) {
			selectedClauses.push(`EXISTS (
				SELECT 1
				FROM ${DBTables.ROLE} AS selectedRole
				INNER JOIN ${DBTables.TEAM} AS selectedTeam ON selectedTeam.id = selectedRole.teamId
				WHERE
					selectedRole.profileId = profile.id
					AND selectedRole.teamId IN (${placeholders(audience.teamIds)})
					AND selectedRole.deletedAt IS NULL
					AND selectedTeam.deletedAt IS NULL
			)`);
			bindings.push(...audience.teamIds);
		}

		whereClauses.push(`(${selectedClauses.join(' OR ')})`);
	}

	if (audience.accessLevels.length > 0) {
		whereClauses.push(`access.accessLevel IN (${placeholders(audience.accessLevels)})`);
		bindings.push(...audience.accessLevels);
	}

	if (audience.profileStatuses.length > 0) {
		whereClauses.push(`access.profileStatus IN (${placeholders(audience.profileStatuses)})`);
		bindings.push(...audience.profileStatuses);
	}

	if (audience.isBasedOnGTA !== undefined) {
		whereClauses.push('profile.isBasedOnGTA = ?');
		bindings.push(Number(audience.isBasedOnGTA));
	}

	if (audience.canJoinLocalEvents !== undefined) {
		whereClauses.push('profile.canJoinLocalEvents = ?');
		bindings.push(Number(audience.canJoinLocalEvents));
	}

	const { results } = await database.prepare(`
		${audienceProfileSelect}
		WHERE ${whereClauses.join('\n\t\t\tAND ')}
		ORDER BY profile.name COLLATE NOCASE
	`).bind(...bindings).run<DatabaseAudienceProfile>();

	return results.map(transformAudienceProfile);
}

export async function getCampaignByIdempotencyKey(database: D1Database, idempotencyKey: string) {
	return database.prepare(`
		SELECT
			campaign.id,
			campaign.subject,
			campaign.status,
			campaign.recipientCount,
			campaign.sentCount,
			campaign.failedCount,
			campaign.insertedAt,
			campaign.sentAt,
			profile.name AS createdByName
		FROM ${DBTables.EMAIL_CAMPAIGN} AS campaign
		INNER JOIN ${DBTables.PROFILE} AS profile ON profile.id = campaign.createdBy
		WHERE campaign.idempotencyKey = ?
		LIMIT 1
	`).bind(idempotencyKey).first<EmailCampaignSummary>();
}

export async function insertCampaign(
	database: D1Database,
	createdBy: string,
	data: CreateEmailCampaign,
	recipients: AudienceProfile[]
) {
	const { id: campaignId, schemaVersion, happenedAt, insertedAt } = generateBaseDBfields();
	const recipientRows: CampaignRecipient[] = recipients.map(({ id: profileId, email, name }) => ({
		id: crypto.randomUUID(),
		profileId,
		email,
		name
	}));

	await database.batch([
		database.prepare(`
			INSERT INTO ${DBTables.EMAIL_CAMPAIGN} (
				id, schemaVersion, createdBy, subject, message, audienceCriteria,
				idempotencyKey, status, recipientCount, happenedAt, insertedAt
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, 'sending', ?, ?, ?)
		`).bind(
			campaignId,
			schemaVersion,
			createdBy,
			data.subject,
			data.message,
			JSON.stringify(data.audience),
			data.idempotencyKey,
			recipients.length,
			happenedAt,
			insertedAt
		),
		...recipientRows.map(({ id, profileId, email }) =>
			database.prepare(`
			INSERT INTO ${DBTables.EMAIL_CAMPAIGN_RECIPIENT} (
				id, campaignId, profileId, email, status, insertedAt
			)
			VALUES (?, ?, ?, ?, 'pending', ?)
		`).bind(id, campaignId, profileId, email, insertedAt)
		)
	]);

	return { campaignId, recipients: recipientRows };
}

export async function updateRecipientDelivery(
	database: D1Database,
	recipientId: string,
	status: 'failed' | 'sent',
	providerMessageId?: string,
	errorMessage?: string
) {
	return database.prepare(`
		UPDATE ${DBTables.EMAIL_CAMPAIGN_RECIPIENT}
		SET status = ?, providerMessageId = ?, errorMessage = ?, attemptedAt = ?
		WHERE id = ?
		`).bind(status, providerMessageId ?? null, errorMessage?.slice(0, ERROR_MESSAGE_MAX_LENGTH) ?? null, new Date().toISOString(), recipientId).run();
}

export async function finishCampaign(
	database: D1Database,
	campaignId: string,
	status: EmailCampaignStatus,
	sentCount: number,
	failedCount: number
) {
	return database.prepare(`
		UPDATE ${DBTables.EMAIL_CAMPAIGN}
		SET status = ?, sentCount = ?, failedCount = ?, sentAt = ?
		WHERE id = ?
	`).bind(status, sentCount, failedCount, new Date().toISOString(), campaignId).run();
}

export async function getRecentCampaigns(database: D1Database) {
	const { results } = await database.prepare(`
		SELECT
			campaign.id,
			campaign.subject,
			campaign.status,
			campaign.recipientCount,
			campaign.sentCount,
			campaign.failedCount,
			campaign.insertedAt,
			campaign.sentAt,
			profile.name AS createdByName
		FROM ${DBTables.EMAIL_CAMPAIGN} AS campaign
		INNER JOIN ${DBTables.PROFILE} AS profile ON profile.id = campaign.createdBy
		ORDER BY campaign.insertedAt DESC
		LIMIT 20
	`).run<EmailCampaignSummary>();

	return results;
}
