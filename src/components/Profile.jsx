import { useEffect, useState } from 'react';
import '../App.css';  // Include any additional CSS here
import 'open-props';  // Import Open Props styles (CDN or package)

const ProfileList = () => {
  const [profileData, setProfileData] = useState([]);

  useEffect(() => {
    // Fetch data from the JSON file in the public directory
    fetch('/profiles.json')
      .then(response => response.json())
      .then(data => setProfileData(data))
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  if (profileData.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {profileData.map((profile, index) => (
        <div key={index} className="card">
          <div className="card-header">
            <h3>Volunteer Profile</h3>
          </div>
          <div className="card-body">
            <div className="profile-header">
              <img
                className="avatar"
                src={profile.avatar || '/default-avatar.png'}
                alt="Avatar"
              />
              <div>
                <p><strong>ID:</strong> {profile.id}</p>
                <p><strong>Email:</strong> {profile.email}</p>
                <p><strong>Name:</strong> {profile.name}</p>
                <p><strong>Description:</strong> {profile.description || 'No description available'}</p>
                <p><strong>Created At:</strong> {profile.happenedAt || 'Not available'}</p>
                <p><strong>Inserted At:</strong> {profile.insertedAt}</p>
              </div>
            </div>
            <div className="social-links">
              {profile.socialLinks &&
                Object.keys(profile.socialLinks).map((platform) => (
                  <a
                    key={platform}
                    href={profile.socialLinks[platform]}
                    target="_blank"
                    rel="noopener noreferrer"
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
