import { useAuth } from '../../context/AuthContext.tsx';
import AuthenticatedLayout from '../AuthenticatedLayout/AuthenticatedLayout.tsx';
import EmailCampaignComposer from '../EmailCampaignComposer/EmailCampaignComposer.tsx';

const Notifications = (): React.JSX.Element => {
	const { accessLevel } = useAuth();
	const canSendNotifications = accessLevel === 'admin' || accessLevel === 'organizer';

	return (
		<AuthenticatedLayout activePage='notifications' mainClassName='notifications-page'>
			<nav className='notifications-breadcrumb' aria-label='Breadcrumb'>
				<a href='/pages/home'>Community</a>
				<span>Notifications</span>
			</nav>
			<header className='notifications-header'>
				<h1>Notifications</h1>
				<p>Send email updates to the TorontoJS community.</p>
			</header>
			{canSendNotifications ?
				<EmailCampaignComposer /> :
				(
					<section className='notifications-unavailable'>
						<h2>Email notifications</h2>
						<p>Community email notifications can only be created by organizers and administrators.</p>
					</section>
				)}
		</AuthenticatedLayout>
	);
};

export default Notifications;
