import { describe, expect, it } from "vitest";
import { calculateStandings, generateRoundRobin } from "./fixtures";
import type { Fixture, Team } from "../types";

const teams: Team[] = [
  { id:"a", name:"Alpha", season_id:"s", manager_name:null, ign:null, logo_url:null, created_at:"", updated_at:"" },
  { id:"b", name:"Bravo", season_id:"s", manager_name:null, ign:null, logo_url:null, created_at:"", updated_at:"" },
  { id:"c", name:"Charlie", season_id:"s", manager_name:null, ign:null, logo_url:null, created_at:"", updated_at:"" },
  { id:"d", name:"Delta", season_id:"s", manager_name:null, ign:null, logo_url:null, created_at:"", updated_at:"" }
];
function fixture(id:string,home:string,away:string,hs:number|null,as:number|null,status:Fixture["status"]="completed"):Fixture{
  return {id,season_id:"s",matchday:1,home_team_id:home,away_team_id:away,scheduled_at:null,status,home_score:hs,away_score:as,notes:null,created_at:id,updated_at:id};
}
describe("round-robin generation",()=>{
  it("generates n(n-1)/2 fixtures for an even team count",()=>{
    expect(generateRoundRobin(teams).length).toBe(6);
  });
  it("handles byes for odd team counts",()=>{
    expect(generateRoundRobin(teams.slice(0,3)).length).toBe(3);
  });
  it("never schedules a team against itself and pairs each team once",()=>{
    const result=generateRoundRobin(teams);
    expect(result.every(f=>f.home_team_id!==f.away_team_id)).toBe(true);
    expect(new Set(result.map(f=>[f.home_team_id,f.away_team_id].sort().join(":"))).size).toBe(6);
  });
  it("generates reversed pairings for double round-robin",()=>{
    const result=generateRoundRobin(teams,true);
    expect(result.length).toBe(12);
    expect(result.some(f=>f.home_team_id==="a"&&f.away_team_id==="b")).toBe(true);
    expect(result.some(f=>f.home_team_id==="b"&&f.away_team_id==="a")).toBe(true);
  });
});
describe("standings",()=>{
  it("calculates wins, draws, losses, goal difference and points",()=>{
    const results=[fixture("1","a","b",2,0),fixture("2","c","a",1,1),fixture("3","b","c",3,2)];
    const table=calculateStandings(teams,results);
    expect(table.find(t=>t.team_id==="a")).toMatchObject({played:2,won:1,drawn:1,lost:0,goals_for:3,goals_against:1,goal_difference:2,points:4});
    expect(table.find(t=>t.team_id==="b")).toMatchObject({played:2,won:1,lost:1,points:3});
  });
  it("ignores scheduled, postponed and cancelled fixtures",()=>{
    const table=calculateStandings(teams,[fixture("1","a","b",5,0,"scheduled"),fixture("2","a","c",2,0,"postponed"),fixture("3","a","d",1,0,"cancelled")]);
    expect(table.find(t=>t.team_id==="a")?.played).toBe(0);
  });
  it("recalculates from the current result set without double counting edits",()=>{
    const edited=[fixture("1","a","b",0,1)];
    expect(calculateStandings(teams,edited).find(t=>t.team_id==="b")?.points).toBe(3);
    edited[0]=fixture("1","a","b",2,2);
    const recalculated=calculateStandings(teams,edited);
    expect(recalculated.find(t=>t.team_id==="b")?.points).toBe(1);
    expect(recalculated.find(t=>t.team_id==="b")?.played).toBe(1);
  });
});
