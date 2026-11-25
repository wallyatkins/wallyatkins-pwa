export function capabilities(profile, ownerSubject) {
  const roles = Array.isArray(profile.roles) ? profile.roles : [];
  return {
    assistant: Boolean(ownerSubject && profile.sub === ownerSubject),
    football: roles.includes('football-player'),
    mud: roles.includes('mud-player'),
    tasks: roles.includes('tasks-user'),
    account: true
  };
}
export const terminalStatuses = new Set(['completed','failed','cancelled','interrupted']);
