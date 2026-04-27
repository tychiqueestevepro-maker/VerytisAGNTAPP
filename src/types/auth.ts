export type Role = 'owner' | 'admin' | 'member';

export type Profile = {
  id: string;
  client_id: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
};

export type UserWithProfile = {
  id: string;
  email?: string;
  profile: Profile | null;
};
