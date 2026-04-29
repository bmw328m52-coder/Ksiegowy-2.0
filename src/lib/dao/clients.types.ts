export type ClientType = "company" | "individual";

export type Client = {
  id: string;
  user_id: string;
  type: ClientType;
  name: string;
  nip: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientInput = {
  type: ClientType;
  name: string;
  nip?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};
