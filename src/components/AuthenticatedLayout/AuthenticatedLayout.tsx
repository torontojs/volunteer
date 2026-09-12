import { type ReactNode, useState } from 'react';
import './AuthenticatedLayout.css';
import { useAuth } from '../../context/AuthContext.tsx';
import { handleLogOut } from '../../utilities/handleLogOut.ts';

type ActivePage = 'community' | 'notifications' | 'profile' | 'teams' | 'volunteer';

interface Props {
	activePage?: ActivePage;
	children: ReactNode;
	className?: string;
	mainClassName?: string;
}

const navItems: {
	id: ActivePage,
	href: string,
	icon?: string,
	label: string
}[] = [
	{
		id: 'community',
		href: '/pages/home',
		icon: '/community-icon.png',
		label: 'Community'
	},
	{
		id: 'profile',
		href: '/pages/protected-profile/',
		icon: '/person-icon-white.png',
		label: 'My Profile'
	},
	{
		id: 'teams',
		href: '/pages/teams',
		label: 'Teams'
	},
	{
		id: 'volunteer',
		href: '/pages/volunteer/',
		label: 'Volunteer'
	}
];

const AuthenticatedLayout = ({ activePage, children, className, mainClassName }: Props): React.JSX.Element => {
	const [menuOpen, setMenuOpen] = useState<boolean>(false);
	const { avatar } = useAuth();

	const navLinks = navItems.map((item) => (
		<a href={item.href} data-active={item.id === activePage} key={item.id}>
			{item.id === 'teams' || item.id === 'volunteer' ?
				(
					<svg className='teams-nav-icon' aria-hidden='true' viewBox='0 0 24 24'>
						<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
						<circle cx='9' cy='7' r='4' />
						<path d='M22 21v-2a4 4 0 0 0-3-3.87' />
						<path d='M16 3.13a4 4 0 0 1 0 7.75' />
					</svg>
				) :
				<img className={item.id === 'profile' ? 'profile-nav-icon' : undefined} src={item.icon} alt={`${item.label} Icon`} />}
			<span>{item.label}</span>
		</a>
	));
	const signOutButton = (
		<button className='sign-out-button' type='button' onClick={handleLogOut}>
			<svg aria-hidden='true' viewBox='0 0 24 24'>
				<path d='M10 17l5-5-5-5M15 12H3M21 3v18h-8' />
			</svg>
			<span>Sign out</span>
		</button>
	);

	return (
		<>
			<div className={['authenticated-layout', className].filter(Boolean).join(' ')}>
				<header className='main-header'>
					<button className='hamburger-menu' onClick={() => setMenuOpen(true)} aria-label='Open navigation menu'>
						<img src='/hamburger-menu.svg' alt='' />
					</button>
					<a href='/pages/home'>
						<img className='torontojs-logo' src='/torontojs-logo.png' alt='Small Toronto JS Logo' />
					</a>
					<div className='inner-header'>
						<img className='small-avatar' src={avatar} alt='Small User Avatar' />
						<a
							className='notification-link'
							href='/pages/notifications/'
							aria-label='Notifications'
							aria-current={activePage === 'notifications' ? 'page' : undefined}
						>
							<img className='notification-bell' src='/notification-bell.png' alt='' />
						</a>
					</div>
				</header>
				<nav className='sidebar-left' aria-label='Primary navigation'>
					<div className='sidebar-left-container'>
						{navLinks}
						{signOutButton}
					</div>
				</nav>
				<main className={mainClassName}>
					{children}
				</main>
			</div>
			{menuOpen && (
				<>
					<div
						className='mobile-nav-overlay'
						role='button'
						tabIndex={0}
						aria-label='Close navigation menu'
						onClick={() => setMenuOpen(false)}
						onKeyDown={(e) => {
							if (e.key === 'Escape' || e.key === 'Enter') { setMenuOpen(false); }
						}}
					/>
					<nav className='mobile-nav-drawer' aria-label='Mobile navigation'>
						<div className='mobile-nav-drawer-header'>
							<img src='/torontojs-logo.png' alt='TorontoJS Logo' />
							<button className='mobile-nav-close' onClick={() => setMenuOpen(false)} aria-label='Close navigation menu'>
								x
							</button>
						</div>
						<div className='mobile-nav-links'>
							{navLinks}
						</div>
						{signOutButton}
					</nav>
				</>
			)}
		</>
	);
};

export default AuthenticatedLayout;
