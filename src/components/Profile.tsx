import { useEffect, useState } from 'react';

interface VolunteerProfile {
	id: string;
	email: string;
	name: string;
	description?: string;
	avatar?: string;
	happenedAt?: string;
	insertedAt: string;
	socialLinks?: Record<string, string>;
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', { dateStyle: 'long' }).format;

const ProfileList = () => {
	const [profileData, setProfileData] = useState<VolunteerProfile[]>([]);

	useEffect(() => {
		// Fetch data from the JSON file in the public directory
		fetch('/profiles.json')
			.then(async (response) => response.json())
			.then((data) => setProfileData(data))
			.catch((error) => console.error('Error fetching data:', error));
	}, []);

	if (profileData.length === 0) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			{profileData.map((profile, index) => (
				<div key={index} className='card'>
					<div className='card-header'>
						<h3>Volunteer Profile</h3>
					</div>
					<div className='card-body'>
						<div className='profile-header'>
							<img
								className='avatar'
								src={profile.avatar ?? '/default-avatar.png'}
								alt='Avatar'
							/>
							<div>
								<p>
									<strong>ID:</strong> {profile.id}
								</p>
								<p>
									<strong>Email:</strong> {profile.email}
								</p>
								<p>
									<strong>Name:</strong> {profile.name}
								</p>
								<p>
									<strong>Description:</strong> {profile.description ?? 'No description available'}
								</p>
								<p>
									<strong>Created At:</strong> {profile.happenedAt ? dateFormatter(new Date(profile.happenedAt)) : 'Not available'}
								</p>
								<p>
									<strong>Inserted At:</strong> {dateFormatter(new Date(profile.insertedAt))}
								</p>
							</div>
						</div>
						<div className='social-links'>
							{profile.socialLinks &&
								Object.entries(profile.socialLinks).map(([platform, url]) => (
									<a
										key={platform}
										href={url}
										target='_blank'
										rel='noopener noreferrer'
									>
										{platform.charAt(0).toUpperCase() + platform.slice(1)}
									</a>
								))}
						</div>
					</div>
				</div>
			))}
		</div>
	);
};

export default ProfileList;
