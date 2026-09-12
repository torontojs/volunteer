-- Migration number: 0008

CREATE TABLE IF NOT EXISTS email_campaign (
	id TEXT NOT NULL UNIQUE COLLATE BINARY,
	schemaVersion INTEGER NOT NULL DEFAULT 1,
	createdBy TEXT NOT NULL COLLATE BINARY,
	subject TEXT NOT NULL,
	message TEXT NOT NULL,
	audienceCriteria TEXT NOT NULL,
	idempotencyKey TEXT NOT NULL UNIQUE COLLATE BINARY,
	status TEXT NOT NULL DEFAULT 'sending' CHECK(status IN ('sending', 'sent', 'partially-failed', 'failed')),
	recipientCount INTEGER NOT NULL DEFAULT 0,
	sentCount INTEGER NOT NULL DEFAULT 0,
	failedCount INTEGER NOT NULL DEFAULT 0,
	happenedAt DATETIME NOT NULL,
	insertedAt DATETIME NOT NULL,
	sentAt DATETIME DEFAULT NULL,

	PRIMARY KEY (id),
	FOREIGN KEY (createdBy) REFERENCES profile(id)
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_created_by ON email_campaign (createdBy);
CREATE INDEX IF NOT EXISTS idx_email_campaign_inserted_at ON email_campaign (insertedAt);

CREATE TABLE IF NOT EXISTS email_campaign_recipient (
	id TEXT NOT NULL UNIQUE COLLATE BINARY,
	campaignId TEXT NOT NULL COLLATE BINARY,
	profileId TEXT NOT NULL COLLATE BINARY,
	email TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
	providerMessageId TEXT DEFAULT NULL,
	errorMessage TEXT DEFAULT NULL,
	insertedAt DATETIME NOT NULL,
	attemptedAt DATETIME DEFAULT NULL,

	PRIMARY KEY (id),
	FOREIGN KEY (campaignId) REFERENCES email_campaign(id),
	FOREIGN KEY (profileId) REFERENCES profile(id),
	UNIQUE(campaignId, profileId)
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_recipient_campaign ON email_campaign_recipient (campaignId);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipient_profile ON email_campaign_recipient (profileId);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipient_status ON email_campaign_recipient (campaignId, status);
