import { useEffect, useState } from "react";
import './Teams.css';
import TeamMemberCard from "../TeamMemberCard/TeamMemberCard";

const Teams = () => {
  const [isLoadedTeamsData, setIsLoadedTeamsData] = useState(false);
  const [isLoadedTeamMembersData, setIsLoadedTeamMembersData] = useState(false);
  const [teamsData, setTeamsData] = useState([]);
  const [teamMembersData, setTeamMembersData] = useState([]);
  const [teamsDataError, setTeamsDataError] = useState(null);
  const [teamMembersDataError, setTeamMembersDataError] = useState(null);

  useEffect(() => {
    setIsLoadedTeamsData(false);
    // Fetch data from the JSON file in the public directory
    async function fetchTeamsData () {
      try {
        const responseTeams = await fetch("/teams.json");
        if (!responseTeams.ok) {
          setTeamsDataError('Failed to fetch teams data! Please refresh the page or try later.');
        };
        setTeamsData(await responseTeams.json());
        
      } catch (error) {
        setTeamsDataError(error);
        console.error("Error fetching teams data:", error);
      } finally {
        setIsLoadedTeamsData(true);
      }
    }
    fetchTeamsData();
  }, []);

  useEffect(() => {
    setIsLoadedTeamMembersData(false);
    // Fetch data from the JSON file in the public directory
    async function fetchTeamMembersData () {
      try {
        const responseTeamMemebers = await fetch("/members.json");
        if (!responseTeamMemebers.ok) {
          setTeamMembersDataError(
            "Failed to fetch teams data! Please refresh the page or try later."
          );
        };
        setTeamMembersData(await responseTeamMemebers.json());
        
      } catch (error) {
        setTeamMembersDataError(error);
        console.error("Error fetching team members data:", error);
      } finally {
        setIsLoadedTeamMembersData(true);
      }
    }
    // Load Team Members Data if Team Data is Loaded
    if(isLoadedTeamsData) fetchTeamMembersData();
  }, [isLoadedTeamsData]);

  // If data not yet loaded
  if (!isLoadedTeamsData) {
    return <div aria-live="polite" role="status">Loading teams...</div>;
  }

  // If error encountered
  if (teamsDataError) {
    return <div>Unable to load teams. Please try refreshing the page.</div>;
  }

  // If team data is loaded but empty data returned
  if (isLoadedTeamsData && !teamsDataError && (!teamsData || teamsData.length === 0)) {
    return <div>There were no teams found. Please try refreshing the page or contact an administrator.</div>;
  }

  // Render data
  if(!teamsDataError && teamsData.length > 0) {
    return (
      <main>
        <h1>The volunteer clans of TorontoJS!</h1>
        {teamsData.map((team, index) => {
          return (
            <article key={index} className="team">
              <header className="team-header">
                <h2>{team.name}</h2>
              </header>
              <div className="team-body">
                <p>{team.description}</p>
                {isLoadedTeamMembersData && teamMembersDataError && (
                  <div>
                    Unable to load team members. Please try refreshing the page.
                  </div>
                )}

                {!teamMembersDataError &&
                  (!teamMembersData || teamMembersData.length <= 0) && (
                    <div>This team has no active members at the moment.</div>
                  )}
                {isLoadedTeamMembersData &&
                  !teamMembersDataError &&
                  teamMembersData.length > 0 && (
                    <>
                      <h3 id={`team-members-label-${index}`}>Team members</h3>
                      <ul
                        aria-labelledby={`team-members-label-${index}`}
                        className="team-members-list"
                      >
                        {teamMembersData.map((member, index) => (
                          <li key={index}>
                            <TeamMemberCard member={member} />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
              </div>
            </article>
          );
        })}
      </main>
    );
  }
};

export default Teams;
