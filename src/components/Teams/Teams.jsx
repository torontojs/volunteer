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
    return <div>Loading...</div>;
  }

  // If error encountered
  if (teamsError) {
    return <div>An error occurred!</div>;
  }

  // If team data is loaded but empty data returned
  if (isLoadedTeamsData && !teamsError && (!teamsData || teamsData.length === 0)) {
    return <div>No data found!</div>;
  }

  // Render data
  if(!teamsError && teamsData.length > 0) {
    return (
      <section>
        {teamsData.map((team, index) => {
          return (
            <div key={index} className="team">
              <div className="team-header">
                <h2>{team.name}</h2>
                <p>{team.description}</p>
              </div>

              <div className="team-body">              
                {(!teamMembersData || teamMembersData.length <= 0) && (
                  <div>No Team Members Found!</div>
                )}                
                {teamMembersData.length > 0 &&
                  teamMembersData.map((member, index) => (
                    <TeamMember key={index} member={member} />
                  ))}
              </div>
            </div>
          );
        })}
      </section>
    );
  }
};

export default Teams;
