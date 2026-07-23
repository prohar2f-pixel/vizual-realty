import { findManagerProfileByName, getManagerProfile, type ManagerProfile } from "../manager-profiles";

export function resolveTopnlabManager(entity: any): ManagerProfile | undefined {
  const user = entity?.user ?? entity?.agent;
  const id = entity?.user_id ?? entity?.agent_id ?? user?.id;
  const profileById = getManagerProfile(id == null ? undefined : String(id));

  if (profileById) {
    return profileById;
  }

  const name = user?.name ?? [user?.agent_lastname, user?.agent_name].filter(Boolean).join(" ");
  return findManagerProfileByName(name);
}
