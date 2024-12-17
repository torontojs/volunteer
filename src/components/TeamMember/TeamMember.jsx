const TeamMember = ({ member }) => {
  return (
    <div className="team-member-card">
      <a href={member.socialLinks.linkedin} target="_blank">
        <div className="team-member-profile">
          <img
            className="avatar"
            src={member.avatar || "/default-avatar.png"}
            alt={`Team ${member.name} Avatar`}
          />
          <div className="team-member-card-text">
            <h3 className="team-member-card-heading">{member.name}</h3>
            <span>linkedin</span>
          </div>
        </div>
      </a>
    </div>
  );
}

export default TeamMember;
