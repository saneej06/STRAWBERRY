import { api } from "./api";

export async function fetchAllUserData() {
  return api.get<any>("/api/data");
}

export async function createRecord(table: string, data: Record<string, unknown>) {
  const res = await api.post<{ data: any }>(`/api/data?table=${encodeURIComponent(table)}`, data);
  return res?.data;
}

export async function updateRecord(table: string, id: string, data: Record<string, unknown>) {
  const res = await api.patch<{ data: any }>(
    `/api/data?table=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}`,
    data
  );
  return res?.data;
}

export async function deleteRecord(table: string, id: string) {
  await api.del(`/api/data?table=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}`);
}

export async function fetchProfile() {
  return api.get<any>("/api/user");
}