export function capabilities(profile, allowedSubjects) {
  const roles = Array.isArray(profile.roles) ? profile.roles : [];
  const hasAssistant = allowedSubjects instanceof Set
    ? Boolean(profile.sub && allowedSubjects.has(profile.sub))
    : Boolean(allowedSubjects && profile.sub === allowedSubjects);
  return {
    assistant: hasAssistant,
    football: roles.includes('football-player'),
    mud: roles.includes('mud-player'),
    tasks: roles.includes('tasks-user'),
    account: true
  };
}
export const terminalStatuses = new Set(['completed','failed','cancelled','interrupted']);
