import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AccessLevel, ProfileStatus } from '../../types/index.ts';
import Button from '../Button/Button.tsx';
import EmptyIcon from '../EmptyIcon/EmptyIcon.tsx';
import HelperMessageComponent from '../HelperMessageComponent/HelperMessageComponent.tsx';
import NotificationBox from '../NotificationBox/NotificationBox.tsx';
import TextInputComponent from '../TextInputComponent/TextInputComponent.tsx';
import './EmailCampaignComposer.css';

interface AudienceProfile {
	id: string;
	name: string;
	email: string;
	accessLevel: AccessLevel;
	profileStatus: ProfileStatus;
	isBasedOnGTA: boolean;
	canJoinLocalEvents: boolean;
	teamIds: string[];
}

interface AudienceTeam {
	id: string;
	name: string;
	memberCount: number;
}

interface AudienceOptions {
	profiles: AudienceProfile[];
	teams: AudienceTeam[];
}

interface AudienceSelection {
	mode: 'all' | 'selected';
	teamIds: string[];
	profileIds: string[];
	accessLevels: AccessLevel[];
	profileStatuses: ProfileStatus[];
	isBasedOnGTA?: boolean;
	canJoinLocalEvents?: boolean;
}

interface PreviewRecipient {
	id: string;
	name: string;
	email: string;
}

interface CampaignSummary {
	id: string;
	subject: string;
	status: 'failed' | 'partially-failed' | 'sending' | 'sent';
	recipientCount: number;
	sentCount: number;
	failedCount: number;
	insertedAt: string;
	sentAt?: string | null;
	createdByName: string;
}

type BooleanFilter = 'any' | 'no' | 'yes';

const ACCESS_LEVELS: AccessLevel[] = ['volunteer', 'organizer', 'admin'];
const PROFILE_STATUSES: ProfileStatus[] = ['activated', 'tos-accepted', 'social-handle-provided', 'profile-completed'];
const PREVIEW_DISPLAY_LIMIT = 10;

function toBooleanFilter(value: BooleanFilter): boolean | undefined {
	if (value === 'any') { return undefined; }
	return value === 'yes';
}

function toggleSelection<T>(values: T[], value: T): T[] {
	return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function formatLabel(value: string) {
	return value.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function getResponseMessage(data: unknown, fallback: string) {
	if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
		return data.message;
	}
	return fallback;
}

// State from the four form sections is coordinated here so every audience change invalidates the send confirmation.
// eslint-disable-next-line complexity
const EmailCampaignComposer = (): React.JSX.Element => {
	const [options, setOptions] = useState<AudienceOptions | null>(null);
	const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
	const [mode, setMode] = useState<'all' | 'selected'>('all');
	const [teamIds, setTeamIds] = useState<string[]>([]);
	const [profileIds, setProfileIds] = useState<string[]>([]);
	const [accessLevels, setAccessLevels] = useState<AccessLevel[]>([]);
	const [profileStatuses, setProfileStatuses] = useState<ProfileStatus[]>([]);
	const [isBasedOnGTA, setIsBasedOnGTA] = useState<BooleanFilter>('any');
	const [canJoinLocalEvents, setCanJoinLocalEvents] = useState<BooleanFilter>('any');
	const [profileSearch, setProfileSearch] = useState('');
	const [subject, setSubject] = useState('');
	const [message, setMessage] = useState('');
	const [previewRecipients, setPreviewRecipients] = useState<PreviewRecipient[] | null>(null);
	const [confirmed, setConfirmed] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [feedback, setFeedback] = useState<{ title: string, message: string, variant: 'error' | 'success' } | null>(null);
	const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

	const loadData = useCallback(async (): Promise<void> => {
		try {
			const [optionsResponse, campaignsResponse] = await Promise.all([
				fetch('/api/email-campaigns/audience-options', { credentials: 'include' }),
				fetch('/api/email-campaigns', { credentials: 'include' })
			]);

			if (!optionsResponse.ok || !campaignsResponse.ok) {
				throw new Error('Unable to load notification data.');
			}

			const [audienceOptions, campaignData] = await Promise.all([
				optionsResponse.json() as Promise<AudienceOptions>,
				campaignsResponse.json() as Promise<{ data: CampaignSummary[] }>
			]);
			setOptions(audienceOptions);
			setCampaigns(campaignData.data);
		} catch (error) {
			console.error('Error loading notification data:', error);
			setFeedback({
				title: 'Unable to load notifications',
				message: 'Please refresh the page and try again.',
				variant: 'error'
			});
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const audience = useMemo<AudienceSelection>(() => ({
		mode,
		teamIds: mode === 'selected' ? teamIds : [],
		profileIds: mode === 'selected' ? profileIds : [],
		accessLevels,
		profileStatuses,
		isBasedOnGTA: toBooleanFilter(isBasedOnGTA),
		canJoinLocalEvents: toBooleanFilter(canJoinLocalEvents)
	}), [accessLevels, canJoinLocalEvents, isBasedOnGTA, mode, profileIds, profileStatuses, teamIds]);

	const clearPreview = (): void => {
		setPreviewRecipients(null);
		setConfirmed(false);
		setFeedback(null);
	};

	const updateAudience = (update: () => void): void => {
		update();
		clearPreview();
	};

	const filteredProfiles = useMemo(() => {
		const search = profileSearch.trim().toLocaleLowerCase();
		if (!search) { return options?.profiles ?? []; }
		return (options?.profiles ?? []).filter(({ email, name }) => `${name} ${email}`.toLocaleLowerCase().includes(search));
	}, [options, profileSearch]);

	const canPreview = mode === 'all' || teamIds.length > 0 || profileIds.length > 0;

	const previewAudience = async (): Promise<void> => {
		if (!canPreview) {
			setFeedback({ title: 'Select recipients', message: 'Select at least one team or individual volunteer.', variant: 'error' });
			return;
		}

		setIsPreviewing(true);
		setFeedback(null);
		setConfirmed(false);

		try {
			const response = await fetch('/api/email-campaigns/preview', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ audience })
			});
			const data = await response.json() as { count?: number, recipients?: PreviewRecipient[], message?: string };

			if (!response.ok || !data.recipients) {
				throw new Error(getResponseMessage(data, 'Unable to preview the selected audience.'));
			}

			setPreviewRecipients(data.recipients);
		} catch (error) {
			setPreviewRecipients(null);
			setFeedback({
				title: 'Audience preview failed',
				message: error instanceof Error ? error.message : 'Please try again.',
				variant: 'error'
			});
		} finally {
			setIsPreviewing(false);
		}
	};

	const sendCampaign = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
		event.preventDefault();

		if (!previewRecipients || previewRecipients.length === 0 || !confirmed) {
			setFeedback({ title: 'Confirm recipients', message: 'Preview the audience and confirm the recipient list before sending.', variant: 'error' });
			return;
		}

		setIsSending(true);
		setFeedback(null);

		try {
			const response = await fetch('/api/email-campaigns', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subject, message, audience, idempotencyKey })
			});
			const data = await response.json() as CampaignSummary | { message?: string };

			if (!response.ok || !('recipientCount' in data)) {
				throw new Error(getResponseMessage(data, 'Unable to send this email campaign.'));
			}

			const result = data;
			setCampaigns((current) => [result, ...current.filter(({ id }) => id !== result.id)]);
			setFeedback({
				title: result.failedCount === 0 ? 'Notification sent' : 'Notification partially sent',
				message: `${result.sentCount} sent${result.failedCount > 0 ? ` and ${result.failedCount} failed` : ''}.`,
				variant: result.failedCount === 0 ? 'success' : 'error'
			});
			setSubject('');
			setMessage('');
			setPreviewRecipients(null);
			setConfirmed(false);
			setIdempotencyKey(crypto.randomUUID());
		} catch (error) {
			setFeedback({
				title: 'Notification not sent',
				message: error instanceof Error ? error.message : 'Please try again.',
				variant: 'error'
			});
		} finally {
			setIsSending(false);
		}
	};

	if (isLoading) {
		return <div className='email-campaign-status' role='status' aria-live='polite'>Loading notification tools...</div>;
	}

	return (
		<div className='email-campaign-content'>
			{feedback && (
				<NotificationBox title={feedback.title} variant={feedback.variant} onDismiss={() => setFeedback(null)}>
					<p>{feedback.message}</p>
				</NotificationBox>
			)}

			<form
				className='email-campaign-form'
				onSubmit={(event) => {
					sendCampaign(event).catch((error: unknown) => console.error('Error sending notification:', error));
				}}
			>
				<section className='email-campaign-card' aria-labelledby='message-heading'>
					<h2 id='message-heading'>Message</h2>
					{/* TextInputComponent is uncontrolled, so the key remounts it when a successful send clears the form. */}
					<TextInputComponent
						key={idempotencyKey}
						id='campaign-subject'
						label='Subject'
						maxLength={200}
						required
						value={subject}
						onChange={(event) => setSubject(event.target.value)}
					/>
					<div className='text-input-component-container email-campaign-field'>
						<span className='input-label-container'>
							<label htmlFor='campaign-message'>Email message</label>
						</span>
						<textarea
							id='campaign-message'
							maxLength={16_384}
							required
							rows={8}
							value={message}
							onChange={(event) => setMessage(event.target.value)}
						/>
						<HelperMessageComponent labelText='Plain text is used to keep community emails safe and accessible.' />
					</div>
				</section>

				<section className='email-campaign-card' aria-labelledby='audience-heading'>
					<h2 id='audience-heading'>Recipients</h2>
					<p className='email-campaign-help'>Choose the starting audience. Filters below narrow this selection.</p>
					<fieldset className='email-campaign-choice-group'>
						<legend className='sr-only'>Audience type</legend>
						<label>
							<input
								type='radio'
								name='audience-mode'
								checked={mode === 'all'}
								onChange={() => updateAudience(() => setMode('all'))}
							/>
							All active community members ({options?.profiles.length ?? 0})
						</label>
						<label>
							<input
								type='radio'
								name='audience-mode'
								checked={mode === 'selected'}
								onChange={() => updateAudience(() => setMode('selected'))}
							/>
							Selected teams and individuals
						</label>
					</fieldset>

					{mode === 'selected' && (
						<div className='email-campaign-selection-grid'>
							<fieldset>
								<legend>Teams</legend>
								<div className='email-campaign-option-list'>
									{options?.teams.map((team) => (
										<label key={team.id}>
											<input
												type='checkbox'
												checked={teamIds.includes(team.id)}
												onChange={() => updateAudience(() => setTeamIds((current) => toggleSelection(current, team.id)))}
											/>
											<span>{team.name}</span>
											<small>{team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}</small>
										</label>
									))}
								</div>
							</fieldset>

							<fieldset>
								<legend>Individual volunteers</legend>
								<label className='email-campaign-search'>
									<span className='sr-only'>Search volunteers</span>
									<input
										type='search'
										placeholder='Search by name or email'
										value={profileSearch}
										onChange={(event) => setProfileSearch(event.target.value)}
									/>
								</label>
								<div className='email-campaign-option-list'>
									{filteredProfiles.map((profile) => (
										<label key={profile.id}>
											<input
												type='checkbox'
												checked={profileIds.includes(profile.id)}
												onChange={() => updateAudience(() => setProfileIds((current) => toggleSelection(current, profile.id)))}
											/>
											<span>{profile.name}</span>
											<small>{profile.email}</small>
										</label>
									))}
								</div>
							</fieldset>
						</div>
					)}
				</section>

				<section className='email-campaign-card' aria-labelledby='filters-heading'>
					<h2 id='filters-heading'>Optional filters</h2>
					<p className='email-campaign-help'>Selections within a filter are combined; different filters narrow the audience.</p>
					<div className='email-campaign-filter-grid'>
						<fieldset>
							<legend>Access level</legend>
							{ACCESS_LEVELS.map((level) => (
								<label key={level}>
									<input
										type='checkbox'
										checked={accessLevels.includes(level)}
										onChange={() => updateAudience(() => setAccessLevels((current) => toggleSelection(current, level)))}
									/>
									{formatLabel(level)}
								</label>
							))}
						</fieldset>

						<fieldset>
							<legend>Profile status</legend>
							{PROFILE_STATUSES.map((status) => (
								<label key={status}>
									<input
										type='checkbox'
										checked={profileStatuses.includes(status)}
										onChange={() => updateAudience(() => setProfileStatuses((current) => toggleSelection(current, status)))}
									/>
									{formatLabel(status)}
								</label>
							))}
						</fieldset>

						<div className='email-campaign-filter-selects'>
							<label htmlFor='campaign-gta'>Based in the GTA</label>
							<select id='campaign-gta' value={isBasedOnGTA} onChange={(event) => updateAudience(() => setIsBasedOnGTA(event.target.value as BooleanFilter))}>
								<option value='any'>Any</option>
								<option value='yes'>Yes</option>
								<option value='no'>No</option>
							</select>
							<label htmlFor='campaign-local'>Available for local events</label>
							<select
								id='campaign-local'
								value={canJoinLocalEvents}
								onChange={(event) => updateAudience(() => setCanJoinLocalEvents(event.target.value as BooleanFilter))}
							>
								<option value='any'>Any</option>
								<option value='yes'>Yes</option>
								<option value='no'>No</option>
							</select>
						</div>
					</div>
				</section>

				<section className='email-campaign-card email-campaign-preview' aria-labelledby='preview-heading'>
					<div className='email-campaign-section-heading'>
						<div>
							<h2 id='preview-heading'>Preview and send</h2>
							<p className='email-campaign-help'>The recipient list is recalculated whenever the audience changes.</p>
						</div>
						<Button
							type='button'
							size='small'
							hasOutline
							onClick={async () => previewAudience().catch((error: unknown) => console.error('Error previewing audience:', error))}
							disabled={isPreviewing || !canPreview}
						>
							{isPreviewing ? 'Loading preview...' : 'Preview audience'}
						</Button>
					</div>

					{previewRecipients && (
						<div className='email-campaign-preview-result' aria-live='polite'>
							<strong>{previewRecipients.length} eligible recipient{previewRecipients.length === 1 ? '' : 's'}</strong>
							{previewRecipients.length === 0 ?
								<p>No active community members match these selections.</p> :
								(
									<>
										<ul>
											{previewRecipients.slice(0, PREVIEW_DISPLAY_LIMIT).map((recipient) => (
												<li key={recipient.id}>
													{recipient.name} <span>{recipient.email}</span>
												</li>
											))}
										</ul>
										{previewRecipients.length > PREVIEW_DISPLAY_LIMIT && <p>And {previewRecipients.length - PREVIEW_DISPLAY_LIMIT} more.</p>}
										<label className='email-campaign-confirmation'>
											<input type='checkbox' checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
											I have reviewed the audience and confirm this email should be sent.
										</label>
									</>
								)}
						</div>
					)}

					<Button
						type='submit'
						isPrimary
						disabled={isSending || !confirmed || !previewRecipients?.length || !subject.trim() || !message.trim()}
					>
						{isSending ? 'Sending notification...' : `Send notification${previewRecipients?.length ? ` to ${previewRecipients.length}` : ''}`}
					</Button>
				</section>
			</form>

			<section className='email-campaign-card email-campaign-history' aria-labelledby='history-heading'>
				<h2 id='history-heading'>Recent email notifications</h2>
				{campaigns.length === 0 ?
					(
						<div className='email-campaign-empty-state'>
							<EmptyIcon />
							<p>No email notifications have been sent yet.</p>
						</div>
					) :
					(
						<ul>
							{campaigns.map((campaign) => (
								<li key={campaign.id}>
									<div>
										<strong>{campaign.subject}</strong>
										<span>Sent by {campaign.createdByName} on {new Date(campaign.insertedAt).toLocaleString('en-CA')}</span>
									</div>
									<span className='email-campaign-history-result' data-status={campaign.status}>
										{campaign.sentCount}/{campaign.recipientCount} sent{campaign.failedCount > 0 ? ` · ${campaign.failedCount} failed` : ''}
									</span>
								</li>
							))}
						</ul>
					)}
			</section>
		</div>
	);
};

export default EmailCampaignComposer;
