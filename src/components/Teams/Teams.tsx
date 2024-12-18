import { useEffect, useState } from 'react';
import './Teams.css';
import TeamMemberCard from '../TeamMemberCard/TeamMemberCard';

interface Team {
	id: string;
	name: string;
	description: string;
}

export interface TeamMemberProfile {
	id: string;
	name: string;
	avatar?: string;
	socialLinks?: Record<string, string>;
}

const Teams = () => {
	const [isLoadedTeamsData, setIsLoadedTeamsData] = useState(false);
	const [isLoadedTeamMembersData, setIsLoadedTeamMembersData] = useState(false);
	const [teamsData, setTeamsData] = useState([]);
	const [teamMembersData, setTeamMembersData] = useState([]);
	const [teamsDataError, setTeamsDataError] = useState<string | null>(null);
	const [teamMembersDataError, setTeamMembersDataError] = useState<string | null>(null);

	useEffect(() => {
		setIsLoadedTeamsData(false);
		// Fetch data from the JSON file in the public directory
		const fetchTeamsData = async (): Promise<void> => {
			try {
				const responseTeams = await fetch('/teams.json');
				if (!responseTeams.ok) {
					setTeamsDataError(
						'Failed to fetch teams data! Please refresh the page or try later.'
					);
				}
				setTeamsData(await responseTeams.json());
			} catch (error) {
				setTeamsDataError(error);
				console.error('Error fetching teams data:', error);
			} finally {
				setIsLoadedTeamsData(true);
			}
		};
		void fetchTeamsData();
	}, []);

	useEffect(() => {
		setIsLoadedTeamMembersData(false);
		// Fetch data from the JSON file in the public directory
		const fetchTeamMembersData = async (): Promise<void> => {
			try {
				const responseTeamMemebers = await fetch('/members.json');
				if (!responseTeamMemebers.ok) {
					setTeamMembersDataError(
						'Failed to fetch teams data! Please refresh the page or try later.'
					);
				}
				setTeamMembersData(await responseTeamMemebers.json());
			} catch (error) {
				setTeamMembersDataError(error);
				console.error('Error fetching team members data:', error);
			} finally {
				setIsLoadedTeamMembersData(true);
			}
		};
		// Load Team Members Data if Team Data is Loaded
		if (isLoadedTeamsData) {
			void fetchTeamMembersData();
		}
	}, [isLoadedTeamsData]);

	// If data not yet loaded
	if (!isLoadedTeamsData) {
		return <div aria-live='polite' role='status'>Loading teams...</div>;
	}

	// If error encountered
	if (teamsDataError) {
		return (
			<div aria-live='polite' role='status'>
				Unable to load teams. Please try refreshing the page.
			</div>
		);
	}

	// If team data is loaded but empty data returned
	if (isLoadedTeamsData && !teamsDataError && (!teamsData || teamsData.length === 0)) {
		return (
			<div aria-live='polite' role='status'>
				There were no teams found. Please try refreshing the page or contact an administrator.
			</div>
		);
	}

	// Render data
	if (!teamsDataError && teamsData.length > 0) {
		return (
			<main>
				<h1>The volunteer clans of TorontoJS!</h1>
				{teamsData.map((team: Team, index) => (
					<article key={index} className='team'>
						<header className='team-header'>
							<h2>{team.name}</h2>
						</header>
						<div className='team-body'>
							<p>{team.description}</p>
							{isLoadedTeamMembersData && teamMembersDataError && (
								<div aria-live='polite' role='status'>
									Unable to load team members. Please try refreshing the page.
								</div>
							)}

							{isLoadedTeamMembersData &&
								!teamMembersDataError &&
								(!teamMembersData || teamMembersData.length <= 0) && (
								<div aria-live='polite' role='status'>
									This team has no active members at the moment.
								</div>
							)}
							{isLoadedTeamMembersData &&
								!teamMembersDataError &&
								teamMembersData.length > 0 && (
								<>
									<h3 id={`team-members-label-${index}`}>Team members</h3>
									<ul
										aria-labelledby={`team-members-label-${index}`}
										className='team-members-list'
									>
										{teamMembersData.map((member: TeamMemberProfile, indexMember: number) => (
											<li key={indexMember}>
												<TeamMemberCard {...member} />
											</li>
										))}
									</ul>
								</>
							)}
						</div>
					</article>
				))}
			</main>
		);
	}

	// Default fallback
	return (
		<div aria-live='polite' role='status'>
			Unable to load the page. Please try refreshing the page.
		</div>
	);
};

export default Teams;
