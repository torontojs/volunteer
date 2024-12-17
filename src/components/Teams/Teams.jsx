import { useEffect, useState } from "react";
import TeamMember from "../TeamMember/TeamMember";

const Teams = () => {
  const [isLoadedTeamsData, setIsLoadedTeamsData] = useState(false);
  const [teamsData, setTeamsData] = useState([]);
  const [teamMembersData, setTeamMembersData] = useState([]);
  const [teamsError, setTeamsError] = useState(null);

  useEffect(() => {
  
    //TODO: Add abort controller when fetching from API

    setIsLoadedTeamsData(false);
    // Fetch data from the JSON file in the public directory
    async function fetchData () {
      try {
        const [responseTeams, responseMembers] =  await Promise.all([fetch("/teams.json"), fetch("/members.json")]);
        // Check if both responses are successful
        if (!responseTeams.ok || !responseMembers.ok) {
          setTeamsError('Failed to fetch data!');
        };
        const dataTeams = await responseTeams.json();
        const dataMembers = await responseMembers.json();

        setTeamsData(dataTeams);
        setTeamMembersData(dataMembers);
      } catch (error) {
        setTeamsError(error);
        console.error("Error fetching data:", error);
      } finally {
        setIsLoadedTeamsData(true);
      }
    }
    fetchData();
    
    //TODO: Add cleanup function for abort controller when fetching from API
    
  }, []);

  // If data not yet loaded
  if (!isLoadedTeamsData) {
    return <div aria-live="polite" role="status">Loading teams...</div>;
  }

  // If error encountered
  if (teamsError) {
    return <div>Unable to load teams. Please try refreshing the page.</div>;
  }

  // If team data is loaded but empty data returned
  if (isLoadedTeamsData && !teamsError && (!teamsData || teamsData.length === 0)) {
    return <div>No data found!</div>;
  }

  // Render data
  if(!teamsError && teamsData.length > 0) {
    return (
      <main>
        {teamsData.map((team, index) => {
          return (
            <article key={index} className="team">
              <header className="team-header">
                <h2>{team.name}</h2>
              </header>

              <div className="team-body">
                <p>{team.description}</p>
         
                {(!teamMembersData || teamMembersData.length <= 0) && (
                  <div>This team has no active members.</div>
                )}                
                {teamMembersData.length > 0 && (
                  <h3 id="team-members-label-{index}">Team members</h3>
                  <ul aria-labeled-by="team-members-label-{index}">
                  {teamMembersData.map((member, index) => (
                    <li><TeamMember key={index} member={member} /></li>
                  ))}
                  </ul>
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
