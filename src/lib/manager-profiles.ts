export type ManagerProfile = {
  id: string;
  name: string;
  phone?: string;
  photo?: string;
  telegram?: string;
};

export type CrmAgent = {
  id: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
};

export type ResolvedManager = {
  id: string;
  name: string;
  phone: string | null;
  photo: string | null;
  telegram?: string;
};

const managerProfiles: Record<string, ManagerProfile> = {
  "296892": {
    id: "296892",
    name: "Аянот Елена",
    phone: "+7 (949) 537-55-65",
    photo: "/managers/ayanot-elena-card.webp",
    telegram: "https://t.me/Lena_Katan",
  },
  "296881": {
    id: "296881",
    name: "Банитюк Юлия",
    phone: "+7 (949) 578-09-33",
    photo: "/managers/banityuk-yulia-card.webp",
    telegram: "https://t.me/Lia_banituk",
  },
  "297093": {
    id: "297093",
    name: "Мельник Сергей",
    phone: "+7 (949) 647-72-56",
    photo: "/managers/melnik-sergey-card.webp",
    telegram: "https://t.me/sergeymcv",
  },
  "298110": {
    id: "298110",
    name: "Хаджинова Алина",
    phone: "+7 (949) 400-92-74",
    photo: "/managers/khadzhinova-alina-card.webp",
    telegram: "https://t.me/alin_ka160",
  },
  "297092": {
    id: "297092",
    name: "Антонович Виталий",
  },
};

export function getManagerProfile(agentId: string | null | undefined): ManagerProfile | undefined {
  if (!agentId) {
    return undefined;
  }

  return managerProfiles[agentId];
}

export function resolveManager(agent: CrmAgent | null | undefined): ResolvedManager | undefined {
  const profile = getManagerProfile(agent?.id);

  if (!agent || !profile) {
    return undefined;
  }

  return {
    id: profile.id,
    name: profile.name,
    phone: profile.phone ?? agent.phone,
    photo: profile.photo ?? agent.photoUrl,
    ...(profile.telegram ? { telegram: profile.telegram } : {}),
  };
}
