const TeamMember = ({ member }) => {
  return (
    <article className="team-member-card">
      <a
        href={member.socialLinks.linkedin}
        target="_blank"
        className="team-member-profile"
      >
        <picture>
          <img
            className="avatar"
            src={member.avatar || "/default-avatar.png"}
            alt={`Team ${member.name} Avatar`}
          />
        </picture>
        <header className="team-member-card-text">
          <h3 className="team-member-card-heading">{member.name}</h3>
        </header>
        <div className="social-media-links">
          <ul aria-label="Social Media Links">
            <li><a>linkedin</a></li>
          </ul>
        </div>
      </a>
    </article>
  );
}

export default TeamMember;
