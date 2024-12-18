import './TeamMemberCard.css';
import type { TeamMemberProfile } from '../Teams/Teams';

const TeamMemberCard = (props: TeamMemberProfile) => (
	<article className='team-member-card'>
		<a
			href={props.socialLinks ? props.socialLinks['linkedin'] : '#'}
			target='_blank'
			className='team-member-profile-link'
		>
			<div className='team-member-profile'>
				<picture>
					<img
						className='avatar'
						src={props.avatar ?? '/default-avatar.png'}
						alt={`Team ${props.name} Avatar`}
					/>
				</picture>
				<header>
					<h3 className='team-member-card-heading'>{props.name}</h3>
				</header>
				<div className='social-media-links'>
					<ul aria-label='Social Media Links'>
						<li>linkedin</li>
					</ul>
				</div>
			</div>
		</a>
	</article>
);

export default TeamMemberCard;
