// Team members: managed in the admin, shown on /team.

export type TeamFact = { label: string; value: string };

export type PublicTeamMember = {
  id: number;
  name: string;
  role: string;
  /** The personal story. Blank lines separate paragraphs. */
  bio: string;
  quote: string;
  photo: string | null;
  facts: TeamFact[];
};

export type AdminTeamMember = PublicTeamMember & {
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
