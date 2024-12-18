import './TeamMemberCard.css';

const TeamMemberCard = ({ member }) => {
  return (
    <article className="team-member-card">
      <a
        href={member.socialLinks.linkedin}
        target="_blank"
        className="team-member-profile-link"
      >
        <div className="team-member-profile">
          <picture>
            <img
              className="avatar"
              src={member.avatar || "/default-avatar.png"}
              alt={`Team ${member.name} Avatar`}
            />
          </picture>
          <header>
            <h3 className="team-member-card-heading">{member.name}</h3>
          </header>
          <div className="social-media-links">
            <ul aria-label="Social Media Links">
              <li>linkedin</li>
            </ul>
          </div>
        </div>
      </a>
    </article>
  );
}

export default TeamMemberCard;
